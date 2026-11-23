/**
 * Real Google Calendar RSVPs (PRD 008, R5, R6, R7.4).
 *
 * The service account adds the member as an attendee, or updates them, with
 * If-Match and sendUpdates=none. "This and following" patches each later
 * instance, up to the series end or a 12-month horizon.
 */
import type { RsvpChoice, RsvpScope } from "../types";
import { memberEnv } from "./env";
import {
  getCalendarEvent,
  GoogleApiError,
  listEventInstances,
  patchEventAttendees,
  type GoogleEvent,
} from "./google-api";
import {
  buildLateChangeRecord,
  eventFingerprint,
  eventStartMs,
  isLateChange,
  mergeAttendee,
  normalizeEmail,
  rsvpAvailability,
  statusOf,
} from "./logic";
import { REMOVED, type LateChangeRecord, type SnapshotStatus } from "./records";
import {
  appendLateChanges,
  deleteFingerprint,
  getSnapshots,
  saveFingerprint,
  withSyncLock,
  writeSnapshots,
} from "./store";

const MAX_ATTEMPTS = 3;
const HORIZON_MONTHS = 12;

export class RsvpNotAllowedError extends Error {}
export class EventNotFoundError extends Error {}

interface Member {
  email: string;
  name: string;
}

interface InstanceResult {
  event: GoogleEvent;
  previous: SnapshotStatus;
  next: SnapshotStatus;
}

/** Read → merge → PATCH with If-Match, re-reading on 412 conflicts (R5.4). */
async function rsvpOne(
  calendarId: string,
  initial: GoogleEvent,
  member: Member,
  choice: RsvpChoice,
): Promise<InstanceResult> {
  let event = initial;
  const previous = statusOf(initial, member.email, calendarId);

  for (let attempt = 1; ; attempt++) {
    const availability = rsvpAvailability(event, calendarId);
    if (!availability.allowed) throw new RsvpNotAllowedError(availability.reason ?? "");
    if (!event.etag) throw new GoogleApiError(500, "Event has no etag");

    const attendees = mergeAttendee(event.attendees, member, choice);
    try {
      const updated = await patchEventAttendees(calendarId, event.id, event.etag, attendees);
      return { event: updated, previous, next: statusOf(updated, member.email, calendarId) };
    } catch (error) {
      if (!(error instanceof GoogleApiError) || error.status !== 412 || attempt >= MAX_ATTEMPTS) {
        throw error;
      }
      const fresh = await getCalendarEvent(calendarId, event.id);
      if (!fresh) throw new EventNotFoundError();
      event = fresh;
    }
  }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export interface RsvpOutcome {
  primary: GoogleEvent;
  applied: string[];
  failed: { id: string; start: string }[];
  appliedThrough: string | null;
}

export async function applyRsvp(input: {
  eventId: string;
  choice: RsvpChoice;
  scope: RsvpScope;
  member: Member;
}): Promise<RsvpOutcome> {
  const calendarId = memberEnv.calendarId();
  const member = { email: normalizeEmail(input.member.email), name: input.member.name };

  return withSyncLock(async () => {
    const selected = await getCalendarEvent(calendarId, input.eventId);
    if (!selected) throw new EventNotFoundError();

    let targets: GoogleEvent[] = [selected];
    let appliedThrough: string | null = null;
    if (input.scope === "following" && selected.recurringEventId) {
      const startMs = eventStartMs(selected);
      const horizon = addMonths(new Date(startMs), HORIZON_MONTHS);
      const instances = await listEventInstances(
        calendarId,
        selected.recurringEventId,
        new Date(startMs).toISOString(),
        horizon.toISOString(),
      );
      const later = instances.filter((e) => e.id !== selected.id && eventStartMs(e) >= startMs);
      targets = [selected, ...later.sort((a, b) => eventStartMs(a) - eventStartMs(b))];
      const last = targets[targets.length - 1];
      appliedThrough = last.start?.dateTime ?? last.start?.date ?? null;
    }

    const results: InstanceResult[] = [];
    const failed: { id: string; start: string }[] = [];
    for (const target of targets) {
      try {
        results.push(await rsvpOne(calendarId, target, member, input.choice));
      } catch (error) {
        // The selected occurrence must succeed; later ones may partially fail (R5.7).
        if (target.id === selected.id) throw error;
        console.error(`[member-calendar] RSVP failed for instance ${target.id}:`, error);
        failed.push({ id: target.id, start: target.start?.dateTime ?? target.start?.date ?? "" });
      }
    }

    await recordRsvpSideEffects(results, member);

    return {
      primary: results[0].event,
      applied: results.map((r) => r.event.id),
      failed,
      appliedThrough,
    };
  });
}

/** Fingerprints (R6), status snapshots and late-change records (R7.4). */
async function recordRsvpSideEffects(results: InstanceResult[], member: Member): Promise<void> {
  const now = Date.now();
  const window = memberEnv.lateChangeWindowMinutes();
  const snapshots = await getSnapshots(results.map((r) => r.event.id));
  const lateChanges: LateChangeRecord[] = [];

  await Promise.all(
    results.map(async ({ event, previous, next }) => {
      if (next === REMOVED) await deleteFingerprint(event.id, member.email);
      else await saveFingerprint(event.id, member.email, eventFingerprint(event));

      // Prefer the snapshot (what we last knew), falling back to what Google had.
      const known = snapshots.get(event.id)?.get(member.email) ?? previous;
      if (isLateChange(known, next, eventStartMs(event), now, window)) {
        lateChanges.push(
          buildLateChangeRecord({
            event,
            email: member.email,
            name: member.name,
            previous: known,
            next,
            changedAtMs: now,
            source: "site",
          }),
        );
      }
    }),
  );

  await writeSnapshots(
    results.map(({ event, next }) => ({ eventId: event.id, email: member.email, status: next })),
  );
  await appendLateChanges(lateChanges);
}
