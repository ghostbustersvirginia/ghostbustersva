/**
 * Keeps each thread's starter message a live summary (PRD 014, R3).
 *
 * `requestThreadRefresh` takes a per-series lock. A request that finds the
 * lock held sets a dirty flag instead, and the holder refreshes once more
 * before letting go, so a burst of RSVPs causes at most two edits. Edits to one
 * message are spaced at least 3 seconds apart, and an edit that wouldn't
 * change the text is skipped. Nothing here throws.
 */
import { DiscordErrorCode, isDiscordError, postMessage, renameThread } from "./discord";
import {
  CANCELLED_NOTICE,
  changeNotice,
  decodeSignature,
  encodeSignature,
  eventSignature,
  renderSummary,
  SERIES_ROWS,
  type SummaryInput,
} from "./discord-summary";
import {
  forgetThreadRecord,
  getThreadRecord,
  updateThreadRecord,
  writeStarterMessage,
  type ThreadRecord,
} from "./discord-threads";
import { watchEvents } from "./discord-watch";
import { memberEnv } from "./env";
import { getCalendarEvent, listEventInstances, type GoogleEvent } from "./google-api";
import { eventStartMs, rsvpCounts } from "./logic";
import { getRedis } from "./store";

const LOCK_TTL_MS = 30_000;
const DIRTY_TTL_SECONDS = 5 * 60;
/** Minimum gap between edits to one message (R3.3). */
export const EDIT_SPACING_MS = 3_000;
const LAST_EDIT_TTL_SECONDS = 60;
/** How far ahead to look for a series' upcoming instances. */
const SERIES_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;
/** Bounds the refresh loop if requests keep arriving. */
const MAX_PASSES = 5;

const lockKey = (key: string) => `discord-refresh-lock:${key}`;
const dirtyKey = (key: string) => `discord-refresh-dirty:${key}`;
const lastEditKey = (key: string) => `discord-refresh-last:${key}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type RefreshResult = "updated" | "unchanged" | "no-thread" | "archived" | "failed";

/* --- Reading the event (R3.6) ------------------------------------------- */

/**
 * The summary's input for a series key, or null if Google has no such event.
 * A one-off key is the event itself; a series key is the master, whose
 * instances supply the rows. A cancelled event or series renders as
 * cancelled (R1.6).
 */
export async function loadSummaryInput(
  key: string,
  nowMs = Date.now(),
): Promise<SummaryInput | null> {
  const calendarId = memberEnv.calendarId();
  const excluded = memberEnv.groupAddresses();
  const event = await getCalendarEvent(calendarId, key, { includeCancelled: true });
  if (!event) return null;
  const cancelled = event.status === "cancelled";

  if (!event.recurrence?.length) {
    return { kind: "one-off", event, counts: rsvpCounts(event, calendarId, excluded), cancelled };
  }
  if (cancelled) return { kind: "series", master: event, upcoming: [], cancelled };

  const instances = await listEventInstances(
    calendarId,
    key,
    new Date(nowMs).toISOString(),
    new Date(nowMs + SERIES_WINDOW_MS).toISOString(),
  );
  const upcoming = [...instances]
    .sort((a, b) => eventStartMs(a) - eventStartMs(b))
    .slice(0, SERIES_ROWS)
    .map((instance: GoogleEvent) => ({
      event: instance,
      counts: rsvpCounts(instance, calendarId, excluded),
    }));
  return { kind: "series", master: event, upcoming };
}

/* --- Change and cancellation posts (R5) ----------------------------------- */

/**
 * Posts a notice when the event was cancelled, or its title, time or place
 * changed since the signature last stored, and renames the thread for a new
 * title. The first refresh of a thread only stores the signature. Posting
 * reopens an archived thread, which is fine for a notice (R5.4), and lets the
 * summary edit that follows go through.
 *
 * The new signature is stored only after the notice is posted, so a failed
 * post is retried by the next refresh. Throws Discord errors to the caller.
 */
export async function announceChanges(
  key: string,
  record: ThreadRecord,
  input: SummaryInput,
): Promise<ThreadRecord> {
  if (input.cancelled) {
    if (record.cancelledPosted) return record;
    await postMessage(record.threadId, CANCELLED_NOTICE);
    return (await updateThreadRecord(key, record.threadId, { cancelledPosted: true })) ?? record;
  }

  const signature = eventSignature(input);
  const stored = encodeSignature(signature);
  // Back from cancelled: forget the notice, so a second cancellation is announced.
  const reset = record.cancelledPosted ? { cancelledPosted: undefined } : {};
  const previous = decodeSignature(record.eventSignature);
  if (previous) {
    const notice = changeNotice(previous, signature, input.kind);
    if (notice) {
      await postMessage(record.threadId, notice);
      if (previous.title !== signature.title && signature.title) {
        try {
          await renameThread(record.threadId, signature.title);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[discord] renaming the thread for ${key} failed: ${message}`);
        }
      }
    }
  }
  if (record.eventSignature === stored && !record.cancelledPosted) return record;
  return (
    (await updateThreadRecord(key, record.threadId, { eventSignature: stored, ...reset })) ?? record
  );
}

/* --- One refresh -------------------------------------------------------- */

/** The listed events a summary covers: the event itself, or a series' upcoming dates. */
function watchedEvents(input: SummaryInput): GoogleEvent[] {
  return input.kind === "one-off" ? [input.event] : input.upcoming.map((row) => row.event);
}

async function waitForSpacing(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const last = Number(await redis.get(lastEditKey(key)));
  const wait = Number.isFinite(last) && last > 0 ? last + EDIT_SPACING_MS - Date.now() : 0;
  if (wait > 0) await sleep(wait);
}

async function markEdited(key: string): Promise<void> {
  await getRedis()?.set(lastEditKey(key), String(Date.now()), { ex: LAST_EDIT_TTL_SECONDS });
}

/**
 * Renders the series' summary and writes it if it changed. Runs without the
 * lock; callers use requestThreadRefresh.
 */
export async function refreshThreadNow(key: string): Promise<RefreshResult> {
  let record = await getThreadRecord(key);
  if (!record) return "no-thread";

  try {
    const input = await loadSummaryInput(key);
    if (!input) {
      // Not a cancellation: Google returns those. Leave the message as it is.
      console.error(`[discord] event ${key} not found; summary left unchanged`);
      return "failed";
    }
    // Before the hash check: a series' time of day isn't in its summary text.
    record = await announceChanges(key, record, input);
    // So the sync notices if the event is deleted before it next runs (R5.6).
    if (!input.cancelled) await watchEvents(key, watchedEvents(input));
    const { content, hash } = renderSummary(input);
    if (record.messageId && record.contentHash === hash) return "unchanged";

    await waitForSpacing(key);
    const written = await writeStarterMessage(key, record, content);
    await markEdited(key);
    await updateThreadRecord(key, written.threadId, { contentHash: hash });
    return "updated";
  } catch (error) {
    if (isDiscordError(error, DiscordErrorCode.UnknownChannel)) {
      // Deleted in Discord: drop it. Only the next Yes/Maybe makes a new one (R7.3).
      await forgetThreadRecord(key, record.threadId);
      return "no-thread";
    }
    if (isDiscordError(error, DiscordErrorCode.ThreadArchived)) {
      // A summary edit doesn't reopen a thread (D11). The hash isn't stored, so
      // the first refresh after it reopens writes the summary.
      return "archived";
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[discord] refreshing the summary for ${key} failed: ${message}`);
    return "failed";
  }
}

/* --- Lock and dirty flag (R3.2) ----------------------------------------- */

/**
 * Refreshes the series' summary, merging overlapping requests. Returns
 * "queued" when another request holds the lock and will pick this one up.
 */
export async function requestThreadRefresh(key: string): Promise<RefreshResult | "queued"> {
  if (!memberEnv.discordEnabled()) return "no-thread";
  const redis = getRedis();
  if (!redis) return "no-thread";

  let result: RefreshResult | "queued" = "queued";
  try {
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const owner = crypto.randomUUID();
      const acquired =
        (await redis.set(lockKey(key), owner, { nx: true, px: LOCK_TTL_MS })) === "OK";
      if (!acquired) {
        await redis.set(dirtyKey(key), "1", { ex: DIRTY_TTL_SECONDS });
        return result;
      }
      try {
        do {
          await redis.del(dirtyKey(key));
          result = await refreshThreadNow(key);
          // A failed or archived refresh isn't retried now; the next trigger tries again.
          if (result !== "updated" && result !== "unchanged") return result;
        } while (await redis.get(dirtyKey(key)));
      } finally {
        if ((await redis.get<string>(lockKey(key))) === owner) await redis.del(lockKey(key));
      }
      // A request may have set the flag between the last check and the release.
      if (!(await redis.get(dirtyKey(key)))) return result;
    }
  } catch (error) {
    console.error(`[discord] summary refresh for ${key} failed:`, error);
    return "failed";
  }
  return result;
}
