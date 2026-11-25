/**
 * Upstash Redis storage for the member calendar (PRD 008, R2.6, R6, R7).
 *
 * Everything here is best-effort: when Redis is not configured or fails,
 * calls resolve to empty results and RSVPs still work.
 */
import { Redis } from "@upstash/redis";
import { memberEnv } from "./env";
import { REMOVED, type LateChangeRecord, type SnapshotStatus } from "./records";

export { REMOVED, type LateChangeRecord, type SnapshotStatus };

let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = memberEnv.redisUrl();
  const token = memberEnv.redisToken();
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

function warn(action: string, error: unknown) {
  console.error(`[member-calendar] Redis ${action} failed:`, error);
}

const DAY = 24 * 60 * 60;
const SNAPSHOT_TTL = 400 * DAY;

/* --- Member display names (R2.6) --------------------------------------- */

export async function saveMemberName(email: string, name: string): Promise<void> {
  const redis = getRedis();
  if (!redis || !name) return;
  try {
    await redis.set(`member-name:${email}`, name, { ex: 400 * DAY });
  } catch (error) {
    warn("saveMemberName", error);
  }
}

export async function getMemberNames(emails: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const redis = getRedis();
  const unique = [...new Set(emails)];
  if (!redis || unique.length === 0) return result;
  try {
    const values = await redis.mget<(string | null)[]>(...unique.map((e) => `member-name:${e}`));
    unique.forEach((email, i) => {
      const value = values[i];
      if (typeof value === "string" && value) result.set(email, value);
    });
  } catch (error) {
    warn("getMemberNames", error);
  }
  return result;
}

/* --- RSVP fingerprints (R6) -------------------------------------------- */

const fpKey = (eventId: string, email: string) => `rsvp-fp:${eventId}:${email}`;

export async function saveFingerprint(
  eventId: string,
  email: string,
  fingerprint: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(fpKey(eventId, email), fingerprint, { ex: SNAPSHOT_TTL });
  } catch (error) {
    warn("saveFingerprint", error);
  }
}

export async function deleteFingerprint(eventId: string, email: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(fpKey(eventId, email));
  } catch (error) {
    warn("deleteFingerprint", error);
  }
}

export async function getFingerprints(
  eventIds: string[],
  email: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const redis = getRedis();
  if (!redis || eventIds.length === 0) return result;
  try {
    const values = await redis.mget<(string | null)[]>(...eventIds.map((id) => fpKey(id, email)));
    eventIds.forEach((id, i) => {
      const value = values[i];
      if (typeof value === "string" && value) result.set(id, value);
    });
  } catch (error) {
    warn("getFingerprints", error);
  }
  return result;
}

/* --- Last-known attendee status snapshots (R7.5) ----------------------- */

const snapshotKey = (eventId: string) => `rsvp-status:${eventId}`;

export async function getSnapshots(
  eventIds: string[],
): Promise<Map<string, Map<string, SnapshotStatus>>> {
  const result = new Map<string, Map<string, SnapshotStatus>>();
  const redis = getRedis();
  if (!redis || eventIds.length === 0) return result;
  try {
    const pipeline = redis.pipeline();
    for (const id of eventIds) pipeline.hgetall(snapshotKey(id));
    const values = (await pipeline.exec()) as (Record<string, string> | null)[];
    eventIds.forEach((id, i) => {
      const hash = values[i];
      result.set(id, new Map(Object.entries(hash ?? {}) as [string, SnapshotStatus][]));
    });
  } catch (error) {
    warn("getSnapshots", error);
  }
  return result;
}

/** Writes snapshot fields. `onlyIfMissing` seeds baselines without overwriting. */
export async function writeSnapshots(
  updates: { eventId: string; email: string; status: SnapshotStatus }[],
  options: { onlyIfMissing?: boolean } = {},
): Promise<void> {
  const redis = getRedis();
  if (!redis || updates.length === 0) return;
  try {
    const pipeline = redis.pipeline();
    const touched = new Set<string>();
    for (const u of updates) {
      if (options.onlyIfMissing) pipeline.hsetnx(snapshotKey(u.eventId), u.email, u.status);
      else pipeline.hset(snapshotKey(u.eventId), { [u.email]: u.status });
      touched.add(u.eventId);
    }
    for (const id of touched) pipeline.expire(snapshotKey(id), SNAPSHOT_TTL);
    await pipeline.exec();
  } catch (error) {
    warn("writeSnapshots", error);
  }
}

/* --- Late RSVP-change records (R7) ------------------------------------- */

const lateKey = (year: number) => `rsvp-late-changes:${year}`;

export async function appendLateChanges(records: LateChangeRecord[]): Promise<void> {
  const redis = getRedis();
  if (records.length === 0) return;
  if (!redis) {
    console.error("[member-calendar] Late RSVP change not recorded: Redis is not configured");
    return;
  }
  try {
    const retention = memberEnv.lateChangeRetentionDays();
    const pipeline = redis.pipeline();
    const years = new Set<number>();
    for (const record of records) {
      const year = new Date(record.changedAt).getUTCFullYear();
      years.add(year);
      pipeline.rpush(lateKey(year), JSON.stringify(record));
    }
    for (const year of years) pipeline.expire(lateKey(year), (retention + 366) * DAY);
    await pipeline.exec();
  } catch (error) {
    warn("appendLateChanges", error);
  }
}

export async function readLateChanges(
  fromYear: number,
  toYear: number,
): Promise<LateChangeRecord[]> {
  const redis = getRedis();
  if (!redis) return [];
  const records: LateChangeRecord[] = [];
  const cutoff = Date.now() - memberEnv.lateChangeRetentionDays() * DAY * 1000;
  for (let year = fromYear; year <= toYear; year++) {
    const rows = await redis.lrange<LateChangeRecord | string>(lateKey(year), 0, -1);
    for (const row of rows) {
      const record = typeof row === "string" ? (JSON.parse(row) as LateChangeRecord) : row;
      if (new Date(record.changedAt).getTime() >= cutoff) records.push(record);
    }
  }
  return records;
}

/* --- Sync lock (R7.5): keeps webhook sync and site RSVPs from racing ---- */

const LOCK_KEY = "calendar-sync-lock";

export function withSyncLock<T>(fn: () => Promise<T>, waitMs = 8000): Promise<T> {
  return withLock(LOCK_KEY, fn, waitMs);
}

/**
 * Runs `fn` holding a short Redis lock on `key`, waiting up to `waitMs` for
 * it. Best-effort: without Redis, or if the wait runs out, `fn` runs anyway.
 */
export async function withLock<T>(key: string, fn: () => Promise<T>, waitMs = 8000): Promise<T> {
  const redis = getRedis();
  if (!redis) return fn();
  const owner = crypto.randomUUID();
  const deadline = Date.now() + waitMs;
  let acquired = false;
  try {
    while (!acquired && Date.now() < deadline) {
      acquired = (await redis.set(key, owner, { nx: true, px: 20_000 })) === "OK";
      if (!acquired) await new Promise((r) => setTimeout(r, 250));
    }
  } catch (error) {
    warn("acquire lock", error);
  }
  try {
    return await fn();
  } finally {
    if (acquired) {
      try {
        const current = await redis.get<string>(key);
        if (current === owner) await redis.del(key);
      } catch (error) {
        warn("release lock", error);
      }
    }
  }
}

/* --- Push channel bookkeeping (R7.5) ----------------------------------- */

export interface StoredChannel {
  id: string;
  resourceId: string;
  expiration: string | null;
}

export async function getStoredChannel(): Promise<StoredChannel | null> {
  const redis = getRedis();
  if (!redis) return null;
  return (await redis.get<StoredChannel>("calendar-watch-channel")) ?? null;
}

export async function setStoredChannel(channel: StoredChannel): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set("calendar-watch-channel", channel, { ex: 30 * DAY });
}
