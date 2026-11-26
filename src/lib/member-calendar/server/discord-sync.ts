/**
 * Discord work from RSVPs made in Google Calendar (PRD 014, R3.1, R6).
 *
 * `syncRecentEvents` diffs attendee status snapshots. Site RSVPs write their
 * own snapshots, so these diffs are Google-side changes only. Each diff becomes
 * a queued job:
 *  - a Yes/Maybe from anything else: join the series' thread (R6.1, D12);
 *  - removed from the event: leave the thread if nothing upcoming is left (R6.2);
 *  - every change: refresh the series' summary.
 *
 * Edits to an event's title, time or place, and cancellations, also queue a
 * refresh, which posts the change notice (R3.1, R5). For that, the sync keeps
 * a small hash of what it last saw for each upcoming event with a thread.
 *
 * The jobs live in a Redis set, not just in memory. The snapshots are written
 * before Discord runs, so a job left over from a busy run wouldn't show up in
 * the next run's diff; the queue keeps it. Each run takes at most 20 series,
 * one at a time (R6.3, D7).
 */
import { waitUntil } from "@vercel/functions";
import { requestThreadRefresh } from "./discord-refresh";
import { joinSeriesThread, leaveSeriesThread } from "./discord-rsvp";
import { getThreadRecords, seriesKey } from "./discord-threads";
import { listedSignature, parseWatchEntry, SIGNATURES_KEY, type WatchEntry } from "./discord-watch";
import { memberEnv } from "./env";
import { getCalendarEvent, type GoogleEvent } from "./google-api";
import { eventEndMs, normalizeEmail, rsvpAvailability, statusOf } from "./logic";
import { REMOVED, type SnapshotStatus } from "./records";
import { getRedis } from "./store";

const QUEUE_KEY = "discord-sync-jobs";
const QUEUE_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Series handled per sync run (D7). */
export const SERIES_PER_RUN = 20;

export type DiscordSyncJob =
  | { kind: "join"; seriesKey: string; eventId: string; email: string }
  | { kind: "leave"; seriesKey: string; email: string }
  | { kind: "refresh"; seriesKey: string };

const GOING = (status: SnapshotStatus | undefined) =>
  status === "accepted" || status === "tentative";

/**
 * Jobs for one event's snapshot changes. Ended events are skipped: their
 * summary already says so, and nobody needs to join their thread. Events the
 * site can't RSVP to get no thread from Google-side RSVPs either.
 */
export function jobsForEvent(input: {
  event: GoogleEvent;
  calendarId: string;
  previous: Map<string, SnapshotStatus>;
  updates: { email: string; status: SnapshotStatus }[];
  nowMs: number;
}): DiscordSyncJob[] {
  const { event, previous, updates, nowMs } = input;
  if (updates.length === 0 || eventEndMs(event) <= nowMs) return [];

  const key = seriesKey(event);
  const jobs: DiscordSyncJob[] = [];
  const canRsvp = rsvpAvailability(event, input.calendarId).allowed;
  for (const { email, status } of updates) {
    const member = normalizeEmail(email);
    if (status === REMOVED) {
      jobs.push({ kind: "leave", seriesKey: key, email: member });
    } else if (canRsvp && GOING(status) && !GOING(previous.get(email))) {
      jobs.push({ kind: "join", seriesKey: key, eventId: event.id, email: member });
    }
  }
  jobs.push({ kind: "refresh", seriesKey: key });
  return jobs;
}

/* --- Event changes (R3.1, R5) ---------------------------------------------- */

/**
 * Refresh jobs for upcoming events with a thread whose title, time or place
 * changed since the last sync, or that dropped out of the listing (cancelled,
 * deleted, or moved out of range: the refresh reads Google to tell which).
 * An event seen for the first time is only recorded. Best effort.
 */
export async function eventChangeJobs(
  events: GoogleEvent[],
  nowMs = Date.now(),
): Promise<DiscordSyncJob[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const upcoming = events.filter((event) => eventEndMs(event) > nowMs);
    const threads = await getThreadRecords(upcoming.map(seriesKey));
    const watched = new Map<string, WatchEntry>();
    for (const event of upcoming) {
      const key = seriesKey(event);
      if (threads.has(key)) watched.set(event.id, { s: listedSignature(event), k: key });
    }
    const listed = new Set(events.map((event) => event.id));

    const stored = ((await redis.hgetall(SIGNATURES_KEY)) ?? {}) as Record<string, unknown>;
    const refresh = new Set<string>();
    const drop: string[] = [];
    for (const [eventId, value] of Object.entries(stored)) {
      const before = parseWatchEntry(value);
      const now = watched.get(eventId);
      if (now) {
        if (before && before.s !== now.s) refresh.add(now.k);
        continue;
      }
      drop.push(eventId);
      // Gone from the listing entirely, not just ended or threadless.
      if (before && !listed.has(eventId)) refresh.add(before.k);
    }

    const writes: Record<string, string> = {};
    for (const [eventId, value] of watched) {
      if (parseWatchEntry(stored[eventId])?.s !== value.s) writes[eventId] = JSON.stringify(value);
    }
    if (Object.keys(writes).length > 0) await redis.hset(SIGNATURES_KEY, writes);
    if (drop.length > 0) await redis.hdel(SIGNATURES_KEY, ...(drop as [string, ...string[]]));

    return [...refresh].map((key) => ({ kind: "refresh", seriesKey: key }));
  } catch (error) {
    console.error("[discord] checking events for changes failed:", error);
    return [];
  }
}

/* --- Queue ---------------------------------------------------------------- */

function encode(job: DiscordSyncJob): string {
  switch (job.kind) {
    case "join":
      return JSON.stringify({ t: "join", k: job.seriesKey, e: job.eventId, m: job.email });
    case "leave":
      return JSON.stringify({ t: "leave", k: job.seriesKey, m: job.email });
    case "refresh":
      return JSON.stringify({ t: "refresh", k: job.seriesKey });
  }
}

function decode(value: unknown): DiscordSyncJob | null {
  let data: unknown = value;
  if (typeof value === "string") {
    try {
      data = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const { t, k, e, m } = data as Record<string, unknown>;
  if (typeof k !== "string" || !k) return null;
  if (t === "refresh") return { kind: "refresh", seriesKey: k };
  if (t === "join" && typeof e === "string" && typeof m === "string") {
    return { kind: "join", seriesKey: k, eventId: e, email: m };
  }
  if (t === "leave" && typeof m === "string") return { kind: "leave", seriesKey: k, email: m };
  return null;
}

export async function queueDiscordSyncJobs(jobs: DiscordSyncJob[]): Promise<void> {
  const redis = getRedis();
  if (!redis || jobs.length === 0) return;
  const [first, ...rest] = [...new Set(jobs.map(encode))];
  await redis.sadd(QUEUE_KEY, first, ...rest);
  await redis.expire(QUEUE_KEY, QUEUE_TTL_SECONDS);
}

/** Leaves, then joins, then one refresh, so the summary includes them. Nothing here throws. */
async function runSeries(key: string, jobs: DiscordSyncJob[]): Promise<void> {
  const calendarId = memberEnv.calendarId();
  for (const job of jobs) {
    // leaveSeriesThread re-reads Google, so someone who's back to Yes stays.
    if (job.kind === "leave") await leaveSeriesThread(key, job.email);
  }
  for (const job of jobs) {
    if (job.kind !== "join") continue;
    try {
      const event = await getCalendarEvent(calendarId, job.eventId);
      // They may have changed their answer again since the sync saw it.
      if (!event || !GOING(statusOf(event, job.email, calendarId))) continue;
      await joinSeriesThread(event, job.email);
    } catch (error) {
      console.error(`[discord] Google-side join for ${key} failed:`, error);
    }
  }
  await requestThreadRefresh(key);
}

/**
 * Works through up to `limit` series from the queue. Each series' jobs are
 * removed once handled, whether or not Discord succeeded: failures are logged,
 * and the next RSVP to the series retries the summary.
 */
export async function processDiscordSyncQueue(limit = SERIES_PER_RUN): Promise<number> {
  const redis = getRedis();
  if (!redis || !memberEnv.discordEnabled()) return 0;

  const raw = (await redis.smembers(QUEUE_KEY)) as unknown[];
  const bySeries = new Map<string, { raw: string[]; jobs: DiscordSyncJob[] }>();
  const junk: string[] = [];
  for (const value of raw) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const job = decode(value);
    if (!job) {
      junk.push(text);
      continue;
    }
    const entry = bySeries.get(job.seriesKey) ?? { raw: [], jobs: [] };
    entry.raw.push(text);
    entry.jobs.push(job);
    bySeries.set(job.seriesKey, entry);
  }
  if (junk.length > 0) await redis.srem(QUEUE_KEY, ...(junk as [string, ...string[]]));

  let handled = 0;
  for (const [key, entry] of bySeries) {
    if (handled >= limit) break;
    await runSeries(key, entry.jobs);
    await redis.srem(QUEUE_KEY, ...(entry.raw as [string, ...string[]]));
    handled++;
  }
  return handled;
}

/**
 * Queues the jobs, plus refreshes for changed events among `events` (the
 * sync's listing), and works through the queue after the sync returns, so the
 * webhook's 204 and the cron's response don't wait on Discord.
 */
export function scheduleDiscordSync(jobs: DiscordSyncJob[], events: GoogleEvent[] = []): void {
  if (!memberEnv.discordEnabled() || !getRedis()) return;
  waitUntil(
    (async () => {
      await queueDiscordSyncJobs([...jobs, ...(await eventChangeJobs(events))]);
      await processDiscordSyncQueue();
    })().catch((error) => {
      console.error("[discord] Google-side sync work failed:", error);
    }),
  );
}
