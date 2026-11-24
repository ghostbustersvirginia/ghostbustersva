/**
 * Pure server logic for the member calendar (PRD 008).
 * No network or storage access, so it is easy to unit test.
 */
import { createHash } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { parseEventTitle } from "../chapters";
import { deriveMapLocation } from "../maps-links";
import type { AttendeeSummary, CalendarEvent, GoogleResponseStatus, RsvpChoice } from "../types";
import type { GoogleAttachment, GoogleAttendee, GoogleEvent } from "./google-api";
import { REMOVED, type LateChangeRecord, type SnapshotStatus } from "./records";

const STATUSES: readonly GoogleResponseStatus[] = [
  "accepted",
  "tentative",
  "declined",
  "needsAction",
];

export function toResponseStatus(value: string | undefined): GoogleResponseStatus {
  return STATUSES.includes(value as GoogleResponseStatus)
    ? (value as GoogleResponseStatus)
    : "needsAction";
}

export const normalizeEmail = (email: string | undefined | null) =>
  (email ?? "").trim().toLowerCase();

/* --- Description sanitizing (R8) --------------------------------------- */

export function sanitizeDescription(html: string | undefined): string | null {
  if (!html || !html.trim()) return null;
  // Google sometimes returns plain text with newlines rather than HTML.
  const source = /<[a-z][\s\S]*>/i.test(html) ? html : html.replace(/\r?\n/g, "<br>");
  const clean = sanitizeHtml(source, {
    allowedTags: ["a", "b", "strong", "i", "em", "u", "br", "p", "ul", "ol", "li", "span", "div"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  }).trim();
  return clean || null;
}

/* --- Hero images (PRD 009, R1) ------------------------------------------ */

const HERO_IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);

/** The first PNG or JPEG attachment with a Drive file ID, if any. */
export function heroAttachment(
  event: Pick<GoogleEvent, "attachments">,
): (GoogleAttachment & { fileId: string }) | null {
  const match = (event.attachments ?? []).find(
    (a) => a.fileId && a.mimeType && HERO_IMAGE_TYPES.has(a.mimeType.toLowerCase()),
  );
  return match ? (match as GoogleAttachment & { fileId: string }) : null;
}

/**
 * An opaque version for the hero image URL, so browsers refetch when the
 * attachment changes. The Drive file ID itself never reaches the browser.
 */
export function heroImageVersion(attachment: GoogleAttachment & { fileId: string }): string {
  return createHash("sha256")
    .update(`${attachment.fileId}\u241f${attachment.title ?? ""}`)
    .digest("hex")
    .slice(0, 12);
}

/* --- Change fingerprints (R6) ------------------------------------------ */

export function eventFingerprint(event: GoogleEvent): string {
  const parts = [
    event.start?.dateTime ?? event.start?.date ?? "",
    event.end?.dateTime ?? event.end?.date ?? "",
    (event.location ?? "").trim(),
    (event.summary ?? "").trim(),
  ];
  return createHash("sha256").update(parts.join("␟")).digest("hex").slice(0, 32);
}

/* --- Attendees ---------------------------------------------------------- */

/**
 * People on the guest list. Excludes the calendar itself, room resources, and any
 * `excluded` addresses (e.g. the members/officers groups invited as guests).
 */
export function personAttendees(
  event: GoogleEvent,
  calendarId: string,
  excluded: readonly string[] = [],
): GoogleAttendee[] {
  const skip = new Set([calendarId, ...excluded].map(normalizeEmail));
  return (event.attendees ?? []).filter(
    (a) => a.email && !a.resource && !skip.has(normalizeEmail(a.email)),
  );
}

export function displayNameFor(attendee: GoogleAttendee, storedNames: Map<string, string>): string {
  const email = normalizeEmail(attendee.email);
  return attendee.displayName?.trim() || storedNames.get(email) || email.split("@")[0] || "Member";
}

export function rsvpAvailability(
  event: GoogleEvent,
  calendarId: string,
): { allowed: boolean; reason: string | null } {
  const organizer = normalizeEmail(event.organizer?.email);
  if (organizer && organizer !== normalizeEmail(calendarId)) {
    return {
      allowed: false,
      reason:
        "This event was created on someone's personal calendar, so RSVPs can't be saved from the site. Ask the event creator to move it to GBVA Events.",
    };
  }
  if (event.attendeesOmitted) {
    return { allowed: false, reason: "This event's guest list isn't available right now." };
  }
  return { allowed: true, reason: null };
}

const STATUS_ORDER: Record<GoogleResponseStatus, number> = {
  accepted: 0,
  tentative: 1,
  declined: 2,
  needsAction: 3,
};

export interface NormalizeContext {
  calendarId: string;
  /** Non-person guest addresses to leave out, such as invited groups. */
  excludedEmails?: readonly string[];
  viewerEmail: string;
  storedNames: Map<string, string>;
  /** Fingerprint stored when the viewer last RSVP'd, if any. */
  storedFingerprint?: string;
  /** Google Maps short links resolved to full URLs (server-side). */
  resolvedLinks?: ReadonlyMap<string, string>;
}

/* --- Discord thread link (PRD 010, R3) ---------------------------------- */

/** Private extended property that holds the thread link (R3.1). */
export const THREAD_URL_PROPERTY = "discordThreadUrl";

/** Only links into Discord are ever shown in the app. */
export function isDiscordThreadUrl(value: unknown): value is string {
  return typeof value === "string" && /^https:\/\/discord\.com\/channels\/\d+\/\d+$/.test(value);
}

export function threadUrlFromEvent(event: GoogleEvent): string | null {
  const value = event.extendedProperties?.private?.[THREAD_URL_PROPERTY];
  return isDiscordThreadUrl(value) ? value : null;
}

export function normalizeEvent(event: GoogleEvent, ctx: NormalizeContext): CalendarEvent {
  const parsed = parseEventTitle(event.summary);
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const viewer = normalizeEmail(ctx.viewerEmail);
  const people = personAttendees(event, ctx.calendarId, ctx.excludedEmails);

  const attendees: AttendeeSummary[] = people
    .map((a) => ({
      name: displayNameFor(a, ctx.storedNames),
      status: toResponseStatus(a.responseStatus),
      isMe: normalizeEmail(a.email) === viewer,
    }))
    .filter((a) => a.status !== "needsAction" || a.isMe)
    .sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name),
    );

  const me = people.find((a) => normalizeEmail(a.email) === viewer);
  const myStatus = me ? toResponseStatus(me.responseStatus) : null;
  const availability = rsvpAvailability(event, ctx.calendarId);

  return {
    id: event.id,
    recurringEventId: event.recurringEventId ?? null,
    title: parsed.title,
    rawTitle: event.summary ?? "",
    chapter: parsed.chapter,
    interest: parsed.interest,
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
    allDay,
    location: event.location?.trim() || null,
    ...deriveMapLocation({
      location: event.location,
      description: event.description,
      chapter: parsed.chapter,
      resolvedLinks: ctx.resolvedLinks,
    }),
    image: (() => {
      const hero = heroAttachment(event);
      return hero ? { version: heroImageVersion(hero) } : null;
    })(),
    descriptionHtml: sanitizeDescription(event.description),
    htmlLink: event.htmlLink ?? null,
    myStatus,
    counts: {
      yes: attendees.filter((a) => a.status === "accepted").length,
      maybe: attendees.filter((a) => a.status === "tentative").length,
      no: attendees.filter((a) => a.status === "declined").length,
    },
    attendees,
    changedSinceRsvp: Boolean(
      myStatus && ctx.storedFingerprint && ctx.storedFingerprint !== eventFingerprint(event),
    ),
    rsvpAllowed: availability.allowed,
    rsvpBlockedReason: availability.reason,
    discordThreadUrl: threadUrlFromEvent(event),
  };
}

/** Applies a member's RSVP choice to an attendee list (R5.3). */
export function mergeAttendee(
  attendees: GoogleAttendee[] | undefined,
  member: { email: string; name: string },
  choice: RsvpChoice,
): GoogleAttendee[] {
  const email = normalizeEmail(member.email);
  const list = [...(attendees ?? [])];
  const index = list.findIndex((a) => normalizeEmail(a.email) === email);

  if (choice === "remove") {
    if (index >= 0) list.splice(index, 1);
    return list;
  }
  if (index >= 0) {
    list[index] = { ...list[index], responseStatus: choice };
  } else {
    list.push({
      email: member.email,
      ...(member.name ? { displayName: member.name } : {}),
      responseStatus: choice,
    });
  }
  return list;
}

/* --- Calendar invitations (PRD 012, R2) --------------------------------- */

export type SendUpdates = "all" | "none";

/** Which row of PRD 012's R2 table a status change falls in, for logs (R6.2). */
export type InviteRow =
  | "join"
  | "leave"
  | "switch"
  | "decline"
  | "decline-new"
  | "remove-declined"
  | "unchanged";

const GOING = (status: SnapshotStatus) => status === "accepted" || status === "tentative";

/**
 * Chooses `sendUpdates` for one instance from the member's status before and
 * after a site RSVP (PRD 012, R2). Only joining (Yes/Maybe from not going)
 * and leaving (removed from Yes/Maybe) email the member.
 *
 * "Awaiting response" counts as not going: the member may never have been
 * sent an invitation, so going sends one, and removing sends nothing.
 */
export function inviteDecision(
  previous: SnapshotStatus,
  next: SnapshotStatus,
): { sendUpdates: SendUpdates; row: InviteRow } {
  if (previous === next) return { sendUpdates: "none", row: "unchanged" };
  if (GOING(next)) {
    return GOING(previous)
      ? { sendUpdates: "none", row: "switch" }
      : { sendUpdates: "all", row: "join" };
  }
  if (next === REMOVED) {
    return GOING(previous)
      ? { sendUpdates: "all", row: "leave" }
      : { sendUpdates: "none", row: "remove-declined" };
  }
  // next is No (or awaiting response, which the site never sets).
  return GOING(previous)
    ? { sendUpdates: "none", row: "decline" }
    : { sendUpdates: "none", row: "decline-new" };
}

export function statusOf(event: GoogleEvent, email: string, calendarId: string): SnapshotStatus {
  const target = normalizeEmail(email);
  const match = personAttendees(event, calendarId).find((a) => normalizeEmail(a.email) === target);
  return match ? toResponseStatus(match.responseStatus) : REMOVED;
}

/* --- Late changes (R7) -------------------------------------------------- */

export function eventStartMs(event: Pick<GoogleEvent, "start">): number {
  const value = event.start?.dateTime ?? event.start?.date;
  if (!value) return NaN;
  // An all-day event starts at midnight Eastern; this approximation is fine
  // for a 2-hour window.
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00-05:00`).getTime()
    : new Date(value).getTime();
}

/** Yes → anything else, from `windowMinutes` before the start onward, with no cutoff. */
export function isLateChange(
  previous: SnapshotStatus | undefined,
  next: SnapshotStatus,
  startMs: number,
  changedAtMs: number,
  windowMinutes: number,
): boolean {
  if (previous !== "accepted" || next === "accepted") return false;
  if (!Number.isFinite(startMs)) return false;
  return changedAtMs >= startMs - windowMinutes * 60_000;
}

export function buildLateChangeRecord(input: {
  event: GoogleEvent;
  email: string;
  name: string;
  previous: SnapshotStatus;
  next: SnapshotStatus;
  changedAtMs: number;
  source: "site" | "google";
}): LateChangeRecord {
  const parsed = parseEventTitle(input.event.summary);
  const startMs = eventStartMs(input.event);
  return {
    eventId: input.event.id,
    eventTitle: parsed.title,
    rawTitle: input.event.summary ?? "",
    chapter: parsed.chapter,
    eventStart: input.event.start?.dateTime ?? input.event.start?.date ?? "",
    memberEmail: normalizeEmail(input.email),
    memberName: input.name,
    previousStatus: input.previous,
    newStatus: input.next,
    changedAt: new Date(input.changedAtMs).toISOString(),
    minutesBeforeStart: Math.round((startMs - input.changedAtMs) / 60_000),
    source: input.source,
  };
}

/**
 * Compares Google's current attendee statuses with the last-known snapshot.
 * Returns late changes to record and the snapshot fields to write.
 */
export function diffEventSnapshot(input: {
  event: GoogleEvent;
  calendarId: string;
  excludedEmails?: readonly string[];
  snapshot: Map<string, SnapshotStatus>;
  names: Map<string, string>;
  nowMs: number;
  windowMinutes: number;
}): {
  lateChanges: LateChangeRecord[];
  updates: { eventId: string; email: string; status: SnapshotStatus }[];
} {
  const { event, calendarId, snapshot, names, nowMs, windowMinutes } = input;
  const excluded = new Set((input.excludedEmails ?? []).map(normalizeEmail));
  const current = new Map<string, { status: SnapshotStatus; attendee: GoogleAttendee }>();
  for (const a of personAttendees(event, calendarId, input.excludedEmails)) {
    current.set(normalizeEmail(a.email), {
      status: toResponseStatus(a.responseStatus),
      attendee: a,
    });
  }

  const lateChanges: LateChangeRecord[] = [];
  const updates: { eventId: string; email: string; status: SnapshotStatus }[] = [];
  const startMs = eventStartMs(event);
  const emails = new Set([...snapshot.keys(), ...current.keys()].filter((e) => !excluded.has(e)));

  for (const email of emails) {
    const previous = snapshot.get(email);
    const now = current.get(email);
    const next: SnapshotStatus = now ? now.status : REMOVED;
    if (previous === next) continue;
    if (previous === undefined && next === REMOVED) continue;

    updates.push({ eventId: event.id, email, status: next });
    if (isLateChange(previous, next, startMs, nowMs, windowMinutes)) {
      const name = now
        ? displayNameFor(now.attendee, names)
        : names.get(email) || email.split("@")[0];
      lateChanges.push(
        buildLateChangeRecord({
          event,
          email,
          name,
          previous: previous ?? "needsAction",
          next,
          changedAtMs: nowMs,
          source: "google",
        }),
      );
    }
  }
  return { lateChanges, updates };
}

/* --- CSV export (R7.6) ---------------------------------------------------- */

export const LATE_CHANGE_CSV_COLUMNS = [
  "event_date",
  "event_start",
  "event_title",
  "chapter",
  "member_name",
  "member_email",
  "previous_status",
  "new_status",
  "changed_at",
  "minutes_before_start",
  "source",
] as const;

const STATUS_LABELS: Record<string, string> = {
  accepted: "yes",
  tentative: "maybe",
  declined: "no",
  needsAction: "no response",
  removed: "removed",
};

/** Quotes a CSV cell and defuses spreadsheet formula injection. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const easternDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const easternTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});
const easternDateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function lateChangesToCsv(records: LateChangeRecord[]): string {
  const rows = [LATE_CHANGE_CSV_COLUMNS.join(",")];
  const sorted = [...records].sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  for (const r of sorted) {
    const allDay = /^\d{4}-\d{2}-\d{2}$/.test(r.eventStart);
    const start = allDay ? null : new Date(r.eventStart);
    rows.push(
      [
        csvCell(allDay ? r.eventStart : easternDate.format(start!)),
        csvCell(allDay ? "all day" : easternTime.format(start!)),
        csvCell(r.eventTitle),
        csvCell(r.chapter ?? "general"),
        csvCell(r.memberName),
        csvCell(r.memberEmail),
        csvCell(STATUS_LABELS[r.previousStatus] ?? r.previousStatus),
        csvCell(STATUS_LABELS[r.newStatus] ?? r.newStatus),
        csvCell(easternDateTime.format(new Date(r.changedAt))),
        csvCell(r.minutesBeforeStart),
        csvCell(r.source),
      ].join(","),
    );
  }
  return `${rows.join("\r\n")}\r\n`;
}
