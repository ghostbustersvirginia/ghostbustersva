/**
 * One Discord thread per event series (PRD 010, R2, R3).
 *
 * The first Yes/Maybe site RSVP creates a public thread in the events channel,
 * posts a minimal starter message, records the thread in Redis (the source of
 * truth), and copies its URL to the event's private extended properties for the
 * app. A Redis SET NX lock keeps concurrent RSVPs from creating two threads.
 *
 * PRD 014 keeps the starter message's ID so it can be edited into a live
 * summary, and finds it for threads created before the ID was stored.
 */
import {
  channelUrl,
  createPublicThread,
  DiscordErrorCode,
  editMessage,
  getMessages,
  isDiscordError,
  postMessage,
  type DiscordChannel,
  type DiscordMessage,
} from "./discord";
import { memberEnv } from "./env";
import {
  getCalendarEvent,
  GoogleApiError,
  patchEventPrivateProperties,
  type GoogleEvent,
} from "./google-api";
import { THREAD_URL_PROPERTY } from "./logic";
import { getRedis } from "./store";

const LOCK_TTL_MS = 30_000;
const LOCK_WAIT_MS = 8_000;
const LOCK_POLL_MS = 250;
const PATCH_ATTEMPTS = 3;
const MESSAGE_MAX = 2000;
const TIME_ZONE = "America/New_York";
const FALLBACK_ORIGIN = "https://ghostbustersva.com";

export interface ThreadRecord {
  threadId: string;
  url: string;
  /** ms epoch. */
  createdAt: number;
  /** The starter message (PRD 014, R2). Missing on v1 threads until it's found. */
  messageId?: string;
  /** SHA-256 of the last summary written, to skip edits that change nothing (PRD 014, R3.4). */
  contentHash?: string;
  /** Title, start, end and location last announced (PRD 014, R5.1). */
  eventSignature?: string;
  /** Whether the cancellation notice was posted (PRD 014, R5.3). */
  cancelledPosted?: boolean;
}

/** How many of a v1 thread's oldest messages to search for the starter (PRD 014, R2.2). */
const STARTER_SEARCH_LIMIT = 10;

/** Threads, locks, and membership tracking all key on this (Architecture → Series key). */
export function seriesKey(event: Pick<GoogleEvent, "id" | "recurringEventId">): string {
  return event.recurringEventId ?? event.id;
}

const recordKey = (key: string) => `discord-thread:${key}`;
const lockKey = (key: string) => `discord-thread-lock:${key}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRecord(value: unknown): ThreadRecord | null {
  let data = value;
  if (typeof value === "string") {
    try {
      data = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const { threadId, url, createdAt, messageId, contentHash, eventSignature, cancelledPosted } =
    data as Record<string, unknown>;
  if (typeof threadId !== "string" || typeof url !== "string") return null;
  const record: ThreadRecord = {
    threadId,
    url,
    createdAt: typeof createdAt === "number" ? createdAt : 0,
  };
  if (typeof messageId === "string" && messageId) record.messageId = messageId;
  if (typeof contentHash === "string" && contentHash) record.contentHash = contentHash;
  if (typeof eventSignature === "string") record.eventSignature = eventSignature;
  if (cancelledPosted === true) record.cancelledPosted = true;
  return record;
}

export async function getThreadRecord(key: string): Promise<ThreadRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  return parseRecord(await redis.get(recordKey(key)));
}

/** Best-effort batch lookup for the event feed (R3.4). */
export async function getThreadRecords(keys: string[]): Promise<Map<string, ThreadRecord>> {
  const result = new Map<string, ThreadRecord>();
  const redis = getRedis();
  const unique = [...new Set(keys)];
  if (!redis || unique.length === 0) return result;
  try {
    const values = await redis.mget<unknown[]>(...unique.map(recordKey));
    unique.forEach((key, i) => {
      const record = parseRecord(values[i]);
      if (record) result.set(key, record);
    });
  } catch (error) {
    console.error("[discord] Redis getThreadRecords failed:", error);
  }
  return result;
}

/**
 * Drops the record for a thread that was deleted in Discord, so the next
 * Yes/Maybe RSVP makes a new one. Only drops it if it still names that thread.
 */
export async function forgetThreadRecord(key: string, threadId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const current = parseRecord(await redis.get(recordKey(key)));
    if (current?.threadId === threadId) await redis.del(recordKey(key));
  } catch (error) {
    console.error(`[discord] Redis forgetThreadRecord failed for ${key}:`, error);
  }
}

/**
 * Merges fields into the series' record, but only while it still names this
 * thread, so a late write can't land on a replacement thread. Returns the
 * merged record, or null if the record is gone or names another thread.
 */
export type ThreadRecordPatch = Partial<
  Pick<ThreadRecord, "messageId" | "contentHash" | "eventSignature" | "cancelledPosted">
>;

export async function updateThreadRecord(
  key: string,
  threadId: string,
  /** An `undefined` value removes that field. */
  patch: ThreadRecordPatch,
): Promise<ThreadRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  const current = parseRecord(await redis.get(recordKey(key)));
  if (current?.threadId !== threadId) return null;
  const next: ThreadRecord = { ...current, ...patch };
  for (const field of Object.keys(patch) as (keyof ThreadRecordPatch)[]) {
    if (patch[field] === undefined) delete next[field];
  }
  await redis.set(recordKey(key), JSON.stringify(next));
  return next;
}

/* --- Starter message (R2.4) --------------------------------------------- */

/** Start date and time in America/New_York; all-day events by calendar date. */
export function formatStart(event: GoogleEvent): string {
  const dateTime = event.start?.dateTime;
  if (dateTime) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(dateTime));
  }
  const date = event.start?.date;
  if (!date) return "";
  // All-day: format the calendar date itself, not a UTC midnight.
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function eventDeepLink(eventId: string): string {
  const origin = memberEnv.siteOrigin() || FALLBACK_ORIGIN;
  const url = new URL("/members/calendar", origin);
  url.searchParams.set("event", eventId);
  return url.toString();
}

/** Title, when, location, and deep link. No member names and no counts. */
export function starterMessage(event: GoogleEvent): string {
  const title = (event.summary ?? "").trim() || "Event";
  const when = formatStart(event);
  const lines = [`**${title}**`];
  if (event.recurringEventId) {
    lines.push(`🔁 Recurring event${when ? ` · first RSVP for ${when}` : ""}`);
  } else if (when) {
    lines.push(`📅 ${when}`);
  }
  const location = event.location?.trim();
  if (location) lines.push(`📍 ${location}`);
  lines.push(`🔗 ${eventDeepLink(event.id)}`);
  const message = lines.join("\n");
  return message.length <= MESSAGE_MAX ? message : `${message.slice(0, MESSAGE_MAX - 1)}…`;
}

/* --- Thread link on the event (R3.1–R3.3) ------------------------------- */

/**
 * Copies the thread URL to the series master (or the one-off event) as a
 * private extended property. Only `extendedProperties.private` is sent, merged
 * with what's there. Failures are logged and not retried (R3.3).
 */
export async function saveThreadUrlOnEvent(eventId: string, url: string): Promise<void> {
  const calendarId = memberEnv.calendarId();
  try {
    for (let attempt = 1; ; attempt++) {
      const event = await getCalendarEvent(calendarId, eventId);
      if (!event) return;
      const existing = event.extendedProperties?.private ?? {};
      if (existing[THREAD_URL_PROPERTY] === url) return;
      if (!event.etag) throw new GoogleApiError(500, "Event has no etag");
      try {
        await patchEventPrivateProperties(calendarId, eventId, event.etag, {
          ...existing,
          [THREAD_URL_PROPERTY]: url,
        });
        return;
      } catch (error) {
        const conflict = error instanceof GoogleApiError && error.status === 412;
        if (!conflict || attempt >= PATCH_ATTEMPTS) throw error;
      }
    }
  } catch (error) {
    console.error(`[discord] saving thread URL on event ${eventId} failed:`, error);
  }
}

/* --- Thread creation with a lock (R2.1–R2.3, R2.5) ---------------------- */

async function createThread(key: string, event: GoogleEvent): Promise<ThreadRecord> {
  const channelId = memberEnv.discordEventsChannelId();
  const guildId = memberEnv.discordGuildId();
  if (!channelId || !guildId) throw new Error("Discord channel is not configured");

  const thread: DiscordChannel = await createPublicThread(channelId, event.summary ?? "");
  const record: ThreadRecord = {
    threadId: thread.id,
    url: channelUrl(guildId, thread.id),
    createdAt: Date.now(),
  };
  // Record first: once the thread exists, a retry must reuse it, not make another.
  await getRedis()!.set(recordKey(key), JSON.stringify(record));

  let current = record;
  try {
    const message = await postMessage(thread.id, starterMessage(event));
    // PRD 014, R2.1: keep the ID so the message can become a live summary.
    current = (await updateThreadRecord(key, thread.id, { messageId: message.id })) ?? record;
  } catch (error) {
    console.error(`[discord] starter message for ${key} failed:`, error);
  }
  await saveThreadUrlOnEvent(key, record.url);
  return current;
}

async function waitForRecord(key: string): Promise<ThreadRecord | null> {
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(LOCK_POLL_MS);
    const record = await getThreadRecord(key);
    if (record) return record;
  }
  return null;
}

/**
 * Returns the series' thread, creating it if needed. Returns null when another
 * request holds the lock and doesn't finish in time, or when creation fails;
 * the next Yes/Maybe RSVP tries again (R2.2, R2.5).
 */
export async function ensureEventThread(event: GoogleEvent): Promise<ThreadRecord | null> {
  const redis = getRedis();
  if (!redis || !memberEnv.discordEnabled()) return null;
  const key = seriesKey(event);

  const existing = await getThreadRecord(key);
  if (existing) return existing;

  const owner = crypto.randomUUID();
  const acquired = (await redis.set(lockKey(key), owner, { nx: true, px: LOCK_TTL_MS })) === "OK";
  if (!acquired) return waitForRecord(key);

  try {
    // Someone may have finished between our first check and taking the lock.
    return (await getThreadRecord(key)) ?? (await createThread(key, event));
  } catch (error) {
    console.error(`[discord] creating thread for ${key} failed:`, error);
    return null;
  } finally {
    try {
      if ((await redis.get<string>(lockKey(key))) === owner) await redis.del(lockKey(key));
    } catch (error) {
      console.error(`[discord] releasing thread lock for ${key} failed:`, error);
    }
  }
}

/* --- Finding and editing the starter message (PRD 014, R2) -------------- */

/** Snowflakes are time-ordered, but too large for Number. */
const byId = (a: DiscordMessage, b: DiscordMessage) => {
  const x = BigInt(a.id);
  const y = BigInt(b.id);
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * The bot's earliest message among the thread's oldest few, or null. The bot
 * user's ID is the application's ID, which is DISCORD_CLIENT_ID.
 */
export async function findStarterMessageId(threadId: string): Promise<string | null> {
  const botId = memberEnv.discordClientId();
  if (!botId) return null;
  // Every message in a thread has an ID greater than the thread's.
  const messages = await getMessages(threadId, { after: threadId, limit: STARTER_SEARCH_LIMIT });
  const own = messages.filter((m) => m.author?.id === botId).sort(byId);
  return own[0]?.id ?? null;
}

/**
 * The series' starter message ID: the stored one; else the bot's first message
 * in the thread (v1 threads); else a new message with `content` (R2.2, R2.3).
 * The ID is stored in the record.
 */
export async function ensureStarterMessage(
  key: string,
  record: ThreadRecord,
  content: string,
): Promise<{ record: ThreadRecord; messageId: string; posted: boolean }> {
  if (record.messageId) return { record, messageId: record.messageId, posted: false };

  let messageId = await findStarterMessageId(record.threadId);
  let posted = false;
  if (!messageId) {
    messageId = (await postMessage(record.threadId, content)).id;
    posted = true;
  }
  const updated = (await updateThreadRecord(key, record.threadId, { messageId })) ?? {
    ...record,
    messageId,
  };
  return { record: updated, messageId, posted };
}

/**
 * Writes `content` to the series' starter message, finding or posting it
 * first if needed. If the stored message was deleted (10008), forgets it and
 * finds or posts it once more (R2.4). Returns the updated record. Throws other
 * Discord errors for the caller to log.
 */
export async function writeStarterMessage(
  key: string,
  record: ThreadRecord,
  content: string,
): Promise<ThreadRecord> {
  for (let attempt = 1; ; attempt++) {
    const found = await ensureStarterMessage(key, record, content);
    if (found.posted) return found.record;
    try {
      await editMessage(record.threadId, found.messageId, content);
      return found.record;
    } catch (error) {
      if (attempt > 1 || !isDiscordError(error, DiscordErrorCode.UnknownMessage)) throw error;
      console.error(`[discord] starter message for ${key} was deleted; finding it again`);
      const { messageId: _deleted, ...rest } = found.record;
      record = (await updateThreadRecord(key, record.threadId, { messageId: undefined })) ?? rest;
    }
  }
}
