/**
 * What the sync last saw of each upcoming event with a thread (PRD 014, R5.6).
 *
 * One Redis hash, event ID → { s: signature, k: series key }. The sync compares
 * it with each listing to find events whose title, time or place changed, or
 * that dropped out of the listing (cancelled or deleted). Thread refreshes add
 * their events too, so an event deleted before the next sync still has an
 * entry to miss.
 */
import type { GoogleEvent } from "./google-api";
import { eventStartMs } from "./logic";
import { getRedis } from "./store";

export const SIGNATURES_KEY = "discord-sync-signatures";

/** The sync's listing window. Past events stay in it so post-event changes are still caught. */
export const SYNC_PAST_DAYS = 30;
export const SYNC_FUTURE_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WatchEntry {
  /** The event's listed signature. */
  s: string;
  /** Its series key. */
  k: string;
}

/** What a member would notice changing on one listed event. */
export function listedSignature(event: GoogleEvent): string {
  return JSON.stringify([
    event.summary ?? "",
    event.location ?? "",
    event.start?.dateTime ?? event.start?.date ?? "",
    event.end?.dateTime ?? event.end?.date ?? "",
  ]);
}

export function parseWatchEntry(value: unknown): WatchEntry | null {
  let data = value;
  if (typeof value === "string") {
    try {
      data = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const { s, k } = data as Record<string, unknown>;
  return typeof s === "string" && typeof k === "string" ? { s, k } : null;
}

/**
 * Records `events` under the series key, without overwriting entries that
 * already exist: a change the sync hasn't seen yet still gets its refresh.
 * Events past the sync's window are skipped, since the sync would take them
 * for deleted. Best effort.
 */
export async function watchEvents(
  key: string,
  events: GoogleEvent[],
  nowMs = Date.now(),
): Promise<void> {
  const redis = getRedis();
  const horizon = nowMs + SYNC_FUTURE_DAYS * DAY_MS;
  const inWindow = events.filter((event) => eventStartMs(event) < horizon);
  if (!redis || inWindow.length === 0) return;
  try {
    await Promise.all(
      inWindow.map((event) =>
        redis.hsetnx(
          SIGNATURES_KEY,
          event.id,
          JSON.stringify({ s: listedSignature(event), k: key }),
        ),
      ),
    );
  } catch (error) {
    console.error(`[discord] recording events for ${key} failed:`, error);
  }
}
