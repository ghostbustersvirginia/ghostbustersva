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
  /** Hero image (first PNG/JPEG attachment); `version` changes when it does. */
  image: { version: string } | null;
  /** Sanitized HTML. */
  descriptionHtml: string | null;
  htmlLink: string | null;
  myStatus: GoogleResponseStatus | null;
  counts: { yes: number; maybe: number; no: number };
  attendees: AttendeeSummary[];
  changedSinceRsvp: boolean;
  rsvpAllowed: boolean;
  rsvpBlockedReason: string | null;
  /** The series' Discord thread, when one exists (PRD 010, R3.4). */
  discordThreadUrl: string | null;
}

/** Discord link state for the signed-in member (PRD 010, R1.1). */
export interface DiscordLinkState {
  /** False when the integration is switched off; the UI hides the control. */
  enabled: boolean;
  /** The member's own Discord username when linked. */
  username: string | null;
}

/**
 * `?discord=` status the link routes redirect back with (PRD 010, R1.3), plus
 * "unlinked", which only the browser sets after an unlink.
 */
export type DiscordLinkStatus =
  | "linked"
  | "unlinked"
  | "cancelled"
  | "expired"
  | "unavailable"
  | "error";

export type SessionState =
  | { state: "signed-out"; clientId: string | null }
  | {
      state: "not-member";
      email: string;
      clientId: string | null;
      /** Whether they've already asked for access (PRD 013, R4.4). */
      request: "none" | "pending";
    }
  | {
      state: "member";
      user: { email: string; name: string; isOrganizer: boolean };
      clientId: string | null;
      discord: DiscordLinkState;
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

/** "Update My Calendar" result (PRD 012, R4.6, R4.7). */
export interface UpdateCalendarResponse {
  ok: true;
  /** Invitations sent. */
  sent: number;
  /** Invitations planned: one per one-off event, one per series. */
  total: number;
}

/** "Request access" result (PRD 013, R3). "member": they're on the list now. */
export interface RequestAccessResponse {
  ok: true;
  status: "added" | "pending" | "member";
}

export interface ApiError {
  ok: false;
  error: string;
  message?: string;
}
