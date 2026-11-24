/**
 * "Update My Calendar" (PRD 012, R4): re-sends Google invitations for a
 * member's upcoming Yes and Maybe RSVPs, so events they RSVP'd to before
 * invitations existed reach their own calendar.
 *
 * Phase 0 (check 5) confirmed the method: remove the member silently, then
 * add them back, unchanged, with `sendUpdates=all`. Only the member is
 * emailed. A recurring series gets one invitation, on its first instance in
 * the window; its later instances are re-added silently, as in R3.
 *
 * Nothing else changes: the RSVP status, snapshots, fingerprints, late-change
 * records and Discord are left alone (R4.3). Each event's remove and re-add
 * run under the sync lock, so the push-notification sync never sees the
 * brief removal, and a member's own RSVP can't interleave (R4.4).
 */
import { memberEnv } from "./env";
import {
  getCalendarEvent,
  GoogleApiError,
  listCalendarEvents,
  patchEventAttendees,
  type GoogleAttendee,
  type GoogleEvent,
} from "./google-api";
import { normalizeEmail, rsvpAvailability, statusOf } from "./logic";
import { withSyncLock } from "./store";

const WINDOW_MONTHS = 3;
const MAX_ATTEMPTS = 3;

export interface UpdateCalendarOutcome {
  /** Invitations Google was asked to send. */
  sent: number;
  /** Invitations planned: one per one-off event, one per series. */
  total: number;
  /** Planned invitations that couldn't be sent. */
  failed: number;
}

interface Target {
  event: GoogleEvent;
  invite: boolean;
}

/**
 * The member's Yes/Maybe instances, in start order, with the first instance
 * of each series (and every one-off event) marked for an invitation.
 */
export function planReinvites(events: GoogleEvent[], email: string, calendarId: string): Target[] {
  const seenSeries = new Set<string>();
  const targets: Target[] = [];
  for (const event of events) {
    const status = statusOf(event, email, calendarId);
    if (status !== "accepted" && status !== "tentative") continue;
    if (!rsvpAvailability(event, calendarId).allowed) continue;
    const series = event.recurringEventId;
    const invite = !series || !seenSeries.has(series);
    if (series) seenSeries.add(series);
    targets.push({ event, invite });
  }
  return targets;
}

const isMember = (email: string) => (a: GoogleAttendee) => normalizeEmail(a.email) === email;

/**
 * PATCH with If-Match, re-reading on 412. `build` gets the fresh attendee
 * list and returns the new one, or null if nothing needs to change.
 */
async function patchAttendees(
  calendarId: string,
  initial: GoogleEvent,
  build: (attendees: GoogleAttendee[]) => GoogleAttendee[] | null,
  sendUpdates: "all" | "none",
): Promise<GoogleEvent> {
  let event = initial;
  for (let attempt = 1; ; attempt++) {
    const next = build(event.attendees ?? []);
    if (!next) return event;
    if (!event.etag) throw new GoogleApiError(500, "Event has no etag");
    try {
      return await patchEventAttendees(calendarId, event.id, event.etag, next, sendUpdates);
    } catch (error) {
      if (!(error instanceof GoogleApiError) || error.status !== 412 || attempt >= MAX_ATTEMPTS) {
        throw error;
      }
      const fresh = await getCalendarEvent(calendarId, event.id);
      if (!fresh) throw error;
      event = fresh;
    }
  }
}

/** "sent": invited. "restored": put back silently. "skipped": no longer Yes/Maybe. */
type ReinviteResult = "sent" | "restored" | "skipped";

/**
 * Removes the member silently and adds their attendee entry back. If the
 * invitation can't be sent, the member is still put back, silently:
 * re-inviting never changes an RSVP (R4.3, R4.7).
 */
async function reinviteOne(
  calendarId: string,
  event: GoogleEvent,
  email: string,
  invite: boolean,
): Promise<ReinviteResult> {
  const original = (event.attendees ?? []).find(isMember(email));
  if (!original) return "skipped";

  const removed = await patchAttendees(
    calendarId,
    event,
    (list) => (list.some(isMember(email)) ? list.filter((a) => !isMember(email)(a)) : null),
    "none",
  );
  const putBack = (list: GoogleAttendee[]) =>
    list.some(isMember(email)) ? null : [...list, original];

  if (invite) {
    try {
      await patchAttendees(calendarId, removed, putBack, "all");
      return "sent";
    } catch (error) {
      console.error(
        `[member-calendar] update-my-calendar invite failed event=${event.id}; restoring silently:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  try {
    await patchAttendees(calendarId, removed, putBack, "none");
  } catch (error) {
    // The member is off the event. Loud, because it changed their RSVP.
    console.error(
      `[member-calendar] update-my-calendar could NOT restore attendee event=${event.id}:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
  return "restored";
}

export async function updateMyCalendar(input: { email: string }): Promise<UpdateCalendarOutcome> {
  const calendarId = memberEnv.calendarId();
  const email = normalizeEmail(input.email);
  const now = new Date();
  const until = new Date(now);
  until.setMonth(until.getMonth() + WINDOW_MONTHS);

  const events = await listCalendarEvents(calendarId, now.toISOString(), until.toISOString());
  const targets = planReinvites(events, email, calendarId);

  let sent = 0;
  let failed = 0;
  // A series whose invitation didn't go out passes it to its next instance.
  // "failed" counts against the total; "skipped" (RSVP changed) doesn't.
  const pending = new Map<string, "failed" | "skipped">();
  for (const target of targets) {
    const series = target.event.recurringEventId;
    const invite = target.invite || (!!series && pending.has(series));

    let result: ReinviteResult | "error";
    try {
      result = await withSyncLock(async () => {
        // Re-read under the lock: the member may have just changed their RSVP.
        const fresh = await getCalendarEvent(calendarId, target.event.id);
        if (!fresh) return "skipped";
        const status = statusOf(fresh, email, calendarId);
        if (status !== "accepted" && status !== "tentative") return "skipped";
        return reinviteOne(calendarId, fresh, email, invite);
      });
    } catch {
      result = "error";
    }
    if (!invite) continue;

    if (result === "sent") {
      sent++;
      if (series) pending.delete(series);
    } else if (series) {
      const kind = result === "skipped" ? "skipped" : "failed";
      if (pending.get(series) !== "failed") pending.set(series, kind);
    } else if (result !== "skipped") {
      failed++;
    }
  }
  for (const kind of pending.values()) if (kind === "failed") failed++;
  const total = sent + failed;

  console.info(
    `[member-calendar] update-my-calendar instances=${targets.length} sent=${sent} failed=${failed}`,
  );
  return { sent, total, failed };
}
