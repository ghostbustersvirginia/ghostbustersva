/**
 * Event feed for the member calendar (PRD 008, R2).
 */
import type { CalendarEvent } from "../types";
import { memberEnv } from "./env";
import { getCalendarEvent, listCalendarEvents, type GoogleEvent } from "./google-api";
import { normalizeEmail, normalizeEvent, personAttendees, toResponseStatus } from "./logic";
import { getFingerprints, getMemberNames, writeSnapshots } from "./store";
import { getThreadRecords, seriesKey } from "./discord-threads";
import { isDiscordThreadUrl } from "./logic";
import { findMapsLinks } from "../maps-links";
import { resolveShortLinks } from "./maps-resolver";

const MAX_RANGE_DAYS = 100;

export class RangeError400 extends Error {}

export function parseRange(startParam: string | null, endParam: string | null) {
  const start = startParam ? new Date(startParam) : null;
  const end = endParam ? new Date(endParam) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new RangeError400("start and end are required ISO dates");
  }
  if (end <= start) throw new RangeError400("end must be after start");
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    throw new RangeError400(`range may not exceed ${MAX_RANGE_DAYS} days`);
  }
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

export async function normalizeForViewer(
  events: GoogleEvent[],
  viewerEmail: string,
): Promise<CalendarEvent[]> {
  const calendarId = memberEnv.calendarId();
  const excludedEmails = memberEnv.groupAddresses();
  const viewer = normalizeEmail(viewerEmail);
  const emails = events.flatMap((e) =>
    personAttendees(e, calendarId, excludedEmails).map((a) => normalizeEmail(a.email)),
  );
  const [names, fingerprints, resolvedLinks] = await Promise.all([
    getMemberNames(emails),
    getFingerprints(
      events.map((e) => e.id),
      viewer,
    ),
    resolveShortLinks(events.flatMap((e) => findMapsLinks(e.location, e.description))),
  ]);
  const normalized = events.map((event) =>
    normalizeEvent(event, {
      calendarId,
      excludedEmails,
      viewerEmail: viewer,
      storedNames: names,
      storedFingerprint: fingerprints.get(event.id),
      resolvedLinks,
    }),
  );
  return withThreadFallback(events, normalized);
}

/**
 * Fills `discordThreadUrl` from Redis for events whose own extended property
 * is missing, such as modified instances that don't inherit the master's (R3.4).
 */
async function withThreadFallback(
  events: GoogleEvent[],
  normalized: CalendarEvent[],
): Promise<CalendarEvent[]> {
  const missing = events.filter((_, i) => !normalized[i].discordThreadUrl);
  if (missing.length === 0) return normalized;
  const records = await getThreadRecords(missing.map(seriesKey));
  if (records.size === 0) return normalized;
  return normalized.map((event, i) => {
    if (event.discordThreadUrl) return event;
    const url = records.get(seriesKey(events[i]))?.url;
    return isDiscordThreadUrl(url) ? { ...event, discordThreadUrl: url } : event;
  });
}

/**
 * Seeds last-known attendee statuses so later Google-side changes can be
 * diffed by the webhook sync (R7.5). It never overwrites, so it can't hide a
 * change the webhook hasn't processed yet.
 */
export async function seedSnapshots(events: GoogleEvent[]): Promise<void> {
  const calendarId = memberEnv.calendarId();
  const excludedEmails = memberEnv.groupAddresses();
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const updates = events
    .filter((e) => new Date(e.end?.dateTime ?? e.end?.date ?? 0).getTime() >= cutoff)
    .flatMap((e) =>
      personAttendees(e, calendarId, excludedEmails).map((a) => ({
        eventId: e.id,
        email: normalizeEmail(a.email),
        status: toResponseStatus(a.responseStatus),
      })),
    );
  await writeSnapshots(updates, { onlyIfMissing: true });
}

export async function getEventsForViewer(
  timeMin: string,
  timeMax: string,
  viewerEmail: string,
): Promise<CalendarEvent[]> {
  const events = await listCalendarEvents(memberEnv.calendarId(), timeMin, timeMax);
  await seedSnapshots(events);
  return normalizeForViewer(events, viewerEmail);
}

export async function getEventForViewer(
  eventId: string,
  viewerEmail: string,
): Promise<CalendarEvent | null> {
  const event = await getCalendarEvent(memberEnv.calendarId(), eventId);
  if (!event) return null;
  const [normalized] = await normalizeForViewer([event], viewerEmail);
  return normalized;
}
