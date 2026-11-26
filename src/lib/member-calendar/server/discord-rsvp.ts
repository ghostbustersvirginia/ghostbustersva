/**
 * Discord side effects of a site RSVP (PRD 010, R2.1, R5.1).
 *
 * Runs after the RSVP response is ready, via waitUntil, so an RSVP never fails
 * or slows down because of Discord.
 *
 * A Yes/Maybe joins the series' thread. A removed RSVP leaves it once nothing
 * upcoming is left (PRD 014, R4); a No changes nothing (D4). Every site RSVP
 * then refreshes the thread's live summary (PRD 014, R3.1). The join and leave
 * helpers are shared with Google-side RSVPs (discord-sync.ts, R6).
 */
import { waitUntil } from "@vercel/functions";
import type { RsvpChoice } from "../types";
import { addLinkedMember, removeMemberFromThread } from "./discord-members";
import { requestThreadRefresh } from "./discord-refresh";
import { addMemberSeries, getDiscordLink, removeMemberSeries } from "./discord-store";
import { ensureEventThread, getThreadRecord, seriesKey } from "./discord-threads";
import { memberEnv } from "./env";
import { getCalendarEvent, listEventInstances, type GoogleEvent } from "./google-api";
import { statusOf } from "./logic";

export interface SiteRsvp {
  /** The RSVP'd occurrence, as Google returned it after the patch. */
  event: GoogleEvent;
  choice: RsvpChoice;
  email: string;
}

const JOINS_THREAD: readonly RsvpChoice[] = ["accepted", "tentative"];
const GOING = (status: string) => status === "accepted" || status === "tentative";
/** How far ahead a series is checked for a remaining Yes/Maybe (PRD 014, R4.1). */
const LEAVE_WINDOW_MS = 183 * 24 * 60 * 60 * 1000;

export async function runDiscordAfterRsvp(rsvp: SiteRsvp): Promise<void> {
  const key = seriesKey(rsvp.event);
  await updateThreadMembership(rsvp, key);
  // After any member add, which may have reopened an archived thread (D11).
  await requestThreadRefresh(key);
}

async function updateThreadMembership(rsvp: SiteRsvp, key: string): Promise<void> {
  if (rsvp.choice === "remove") {
    await leaveSeriesThread(key, rsvp.email);
    return;
  }
  // A change to No leaves the member in the thread, and the series tracked (D4).
  if (!JOINS_THREAD.includes(rsvp.choice)) return;
  await joinSeriesThread(rsvp.event, rsvp.email);
}

/**
 * A Yes/Maybe on `event`, from the site or from Google Calendar (PRD 014, R6):
 * track the series, make sure its thread exists, and add the member if linked.
 */
export async function joinSeriesThread(event: GoogleEvent, email: string): Promise<void> {
  const key = seriesKey(event);
  // Track first, so a member who links later is backfilled even if the thread
  // can't be made right now (R4.1, R4.3).
  await addMemberSeries(email, key);
  const thread = await ensureEventThread(event);
  if (!thread) return;
  if ((await addLinkedMember(email, key, thread)) !== "thread-gone") return;

  // The thread was deleted in Discord: make a new one, once.
  const fresh = await ensureEventThread(event);
  if (fresh) await addLinkedMember(email, key, fresh);
}

/**
 * Whether the member still has a Yes or Maybe on the series key: on the event
 * itself for a one-off, or on any instance in the next 6 months for a series.
 * Throws if Google can't be read, so nobody is removed on a guess.
 */
export async function hasUpcomingYesMaybe(
  key: string,
  email: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const calendarId = memberEnv.calendarId();
  const event = await getCalendarEvent(calendarId, key);
  if (!event) return false;
  if (!event.recurrence?.length) return GOING(statusOf(event, email, calendarId));
  const instances = await listEventInstances(
    calendarId,
    key,
    new Date(nowMs).toISOString(),
    new Date(nowMs + LEAVE_WINDOW_MS).toISOString(),
  );
  return instances.some((instance) => GOING(statusOf(instance, email, calendarId)));
}

export type LeaveResult = "kept" | "untracked" | "removed" | "not-removed";

/**
 * A removed RSVP, from the site or from Google Calendar (PRD 014, R4.1, R6.2).
 * Once the member has no Yes/Maybe left on the series, it stops being tracked
 * for them and a linked member is removed from its thread. Nothing here throws.
 */
export async function leaveSeriesThread(key: string, email: string): Promise<LeaveResult> {
  try {
    if (await hasUpcomingYesMaybe(key, email)) return "kept";
  } catch (error) {
    console.error(`[discord] couldn't check remaining RSVPs for ${key}; nobody removed:`, error);
    return "kept";
  }

  await removeMemberSeries(email, key);
  const [link, thread] = await Promise.all([getDiscordLink(email), getThreadRecord(key)]);
  if (!link || !thread) return "untracked";
  const result = await removeMemberFromThread(key, thread, link.id);
  return result === "failed" ? "not-removed" : "removed";
}

/** Fire-and-forget wrapper for the RSVP route. */
export function scheduleDiscordAfterRsvp(rsvp: SiteRsvp): void {
  if (!memberEnv.discordEnabled()) return;
  waitUntil(
    runDiscordAfterRsvp(rsvp).catch((error) => {
      console.error("[discord] RSVP side effects failed:", error);
    }),
  );
}
