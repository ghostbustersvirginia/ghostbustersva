/**
 * Shared API shapes for the member calendar (PRD 008).
 * Browser-safe: no server imports.
 */
import type { ChapterKey } from "./chapters";

/** Google Calendar attendee responseStatus values we expose. */
export type GoogleResponseStatus = "accepted" | "tentative" | "declined" | "needsAction";

/** What a member can choose in the RSVP dialog. */
export type RsvpChoice = "accepted" | "tentative" | "declined" | "remove";

export type RsvpScope = "single" | "following";

export interface AttendeeSummary {
  name: string;
  status: GoogleResponseStatus;
  isMe: boolean;
}

export interface CalendarEvent {
  id: string;
  recurringEventId: string | null;
  /** Title with the chapter prefix removed. */
  title: string;
  rawTitle: string;
  chapter: ChapterKey | null;
  /** Title started with `Interest - ` (gauging interest). */
  interest: boolean;
  /** ISO date-time, or YYYY-MM-DD for all-day events. */
  start: string;
  /** Exclusive end, as Google returns it. */
  end: string;
  allDay: boolean;
  location: string | null;
  /** Where to map the event: location text, or a place read from a Google Maps link. */
  mapQuery: string | null;
  /** Place text to show when the location field is empty or just a link. */
  mapLabel: string | null;
  /** The event's Google Maps link, if it has one. */
  mapUrl: string | null;
  /** Sanitized HTML. */
  descriptionHtml: string | null;
  htmlLink: string | null;
  myStatus: GoogleResponseStatus | null;
  counts: { yes: number; maybe: number; no: number };
  attendees: AttendeeSummary[];
  changedSinceRsvp: boolean;
  rsvpAllowed: boolean;
  rsvpBlockedReason: string | null;
}

export type SessionState =
  | { state: "signed-out"; clientId: string | null }
  | { state: "not-member"; email: string; clientId: string | null }
  | {
      state: "member";
      user: { email: string; name: string; isOrganizer: boolean };
      clientId: string | null;
    };

export interface EventsResponse {
  ok: true;
  events: CalendarEvent[];
}

export interface RsvpResponse {
  ok: true;
  event: CalendarEvent;
  /** For "following": the instances updated and any that failed. */
  applied: string[];
  failed: { id: string; start: string }[];
  appliedThrough: string | null;
}

export interface ApiError {
  ok: false;
  error: string;
  message?: string;
}
