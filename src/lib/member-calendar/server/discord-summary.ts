/**
 * The live summary in each event thread's starter message (PRD 014, R1).
 *
 * Pure rendering: the caller reads the event (and a series' next instances)
 * from Google Calendar and passes in counts made with `rsvpCounts`, the same
 * rule as the event feed. Counts only: no names, and no No counts (D8, D10).
 */
import { createHash } from "node:crypto";
import { eventDeepLink, formatStart } from "./discord-threads";
import type { GoogleEvent } from "./google-api";
import { eventEndMs, type RsvpCounts } from "./logic";

const MESSAGE_MAX = 2000;
const TIME_ZONE = "America/New_York";
/** Series rows shown (D9). */
export const SERIES_ROWS = 3;

export interface SummaryOccurrence {
  event: GoogleEvent;
  counts: RsvpCounts;
}

export type SummaryInput =
  | {
      kind: "one-off";
      event: GoogleEvent;
      counts: RsvpCounts;
      cancelled?: boolean;
    }
  | {
      kind: "series";
      /** The series master: its title and location head the message. */
      master: GoogleEvent;
      /** Upcoming instances, soonest first. Only the first SERIES_ROWS are shown. */
      upcoming: SummaryOccurrence[];
      cancelled?: boolean;
    };

export interface RenderedSummary {
  content: string;
  /** SHA-256 of the content without the "Updated" line (R3.4). */
  hash: string;
}

/** "Tue, Dec 2", by calendar date for all-day events. */
function formatDay(event: GoogleEvent): string {
  const dateTime = event.start?.dateTime;
  const date = event.start?.date;
  const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  if (dateTime) {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: TIME_ZONE }).format(
      new Date(dateTime),
    );
  }
  if (date) {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
      new Date(`${date}T00:00:00Z`),
    );
  }
  return "";
}

function formatUpdated(nowMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(nowMs));
}

/** "✅ 6 going · ❔ 2 maybe", leaving out a zero Maybe. */
function oneOffCounts({ yes, maybe }: RsvpCounts): string {
  if (yes === 0 && maybe === 0) return "none yet";
  const parts = [`✅ ${yes} going`];
  if (maybe > 0) parts.push(`❔ ${maybe} maybe`);
  return parts.join(" · ");
}

/** "Tue, Dec 2 · ✅ 4 · ❔ 1". */
function seriesRow({ event, counts }: SummaryOccurrence): string {
  const day = formatDay(event);
  if (counts.yes === 0 && counts.maybe === 0) return `${day} · no RSVPs yet`;
  const parts = [day, `✅ ${counts.yes}`];
  if (counts.maybe > 0) parts.push(`❔ ${counts.maybe}`);
  return parts.join(" · ");
}

interface Parts {
  head: string[];
  location: string | null;
  link: string;
  rsvps: string[];
}

function buildParts(input: SummaryInput, nowMs: number): Parts {
  const lead = input.kind === "one-off" ? input.event : input.master;
  const title = (lead.summary ?? "").trim() || "Event";
  const head = [input.cancelled ? `~~**${title}**~~` : `**${title}**`];
  const location = lead.location?.trim() || null;

  if (input.kind === "one-off") {
    const when = formatStart(input.event);
    if (when) head.push(`📅 ${when}`);
    const rsvps = input.cancelled
      ? ["❌ **Cancelled**"]
      : eventEndMs(input.event) <= nowMs
        ? ["This event has ended."]
        : [`**RSVPs:** ${oneOffCounts(input.counts)}`];
    return { head, location, link: eventDeepLink(input.event.id), rsvps };
  }

  head.push("🔁 Recurring event");
  const rows = input.upcoming.slice(0, SERIES_ROWS);
  const rsvps = input.cancelled
    ? ["❌ **Cancelled**"]
    : rows.length === 0
      ? ["No upcoming dates."]
      : ["**RSVPs**", ...rows.map(seriesRow)];
  // Link the next date, which the calendar can open; the master if none is left.
  const link = eventDeepLink(rows[0]?.event.id ?? input.master.id);
  return { head, location, link, rsvps };
}

function join(parts: Parts): string {
  const lines = [...parts.head];
  if (parts.location) lines.push(`📍 ${parts.location}`);
  lines.push(`🔗 ${parts.link}`, "", ...parts.rsvps);
  return lines.join("\n");
}

/**
 * Renders the summary. Over Discord's 2,000-character limit, the location goes
 * first, then series rows from the end, then the text is cut (R1.8).
 */
export function renderSummary(input: SummaryInput, nowMs = Date.now()): RenderedSummary {
  const parts = buildParts(input, nowMs);
  const updated = `_Updated ${formatUpdated(nowMs)}_`;
  const fits = (body: string) => body.length + 2 + updated.length <= MESSAGE_MAX;

  let body = join(parts);
  if (!fits(body) && parts.location) {
    parts.location = null;
    body = join(parts);
  }
  // Series rows follow the "**RSVPs**" heading; keep at least one.
  while (!fits(body) && parts.rsvps.length > 2) {
    parts.rsvps.pop();
    body = join(parts);
  }
  if (!fits(body)) body = `${body.slice(0, MESSAGE_MAX - updated.length - 3)}…`;

  return {
    content: `${body}\n\n${updated}`,
    hash: createHash("sha256").update(body).digest("hex"),
  };
}

/* --- Change notices (R5) ------------------------------------------------ */

/** What a change notice compares: title, location, and when. */
export interface EventSignature {
  title: string;
  location: string;
  /** One-off: the start's dateTime or date. Series: the master's time of day ("19:00"), or "all day". */
  start: string;
  /** Like `start`, for the end. */
  end: string;
}

function wallClock(value: GoogleEvent["start"]): string {
  if (!value?.dateTime) return "all day";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value.dateTime));
}

/**
 * The event's signature. For a series it's the master's, with times of day
 * rather than dates: the master's date is the first occurrence, and moving one
 * instance only changes its row (R5.2).
 */
export function eventSignature(input: SummaryInput): EventSignature {
  const lead = input.kind === "one-off" ? input.event : input.master;
  const base = { title: (lead.summary ?? "").trim(), location: lead.location?.trim() ?? "" };
  if (input.kind === "series") {
    return { ...base, start: wallClock(lead.start), end: wallClock(lead.end) };
  }
  return {
    ...base,
    start: lead.start?.dateTime ?? lead.start?.date ?? "",
    end: lead.end?.dateTime ?? lead.end?.date ?? "",
  };
}

export function encodeSignature(signature: EventSignature): string {
  return JSON.stringify([signature.title, signature.location, signature.start, signature.end]);
}

export function decodeSignature(value: string | undefined): EventSignature | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 4) return null;
    if (!parsed.every((part) => typeof part === "string")) return null;
    const [title, location, start, end] = parsed as string[];
    return { title, location, start, end };
  } catch {
    return null;
  }
}

/** "7:00 PM", from a series signature's "19:00". */
function formatClock(value: string): string {
  if (value === "all day") return "all day";
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function formatWhen(start: string, end: string, kind: SummaryInput["kind"]): string {
  if (kind === "series") {
    const from = formatClock(start);
    return from === "all day" ? "all day" : `${from}–${formatClock(end)}`;
  }
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(start);
  return formatStart({ id: "", start: isDate ? { date: start } : { dateTime: start } });
}

/**
 * The text posted when the title, time or place changed (R5.2), or null if
 * nothing a member would notice changed. Mentions stay off when it's posted.
 */
export function changeNotice(
  before: EventSignature,
  after: EventSignature,
  kind: SummaryInput["kind"],
): string | null {
  const lines: string[] = [];
  if (before.title !== after.title) {
    lines.push(`✏️ Renamed: ${before.title || "Event"} → ${after.title || "Event"}`);
  }
  if (before.start !== after.start || before.end !== after.end) {
    const from = formatWhen(before.start, before.end, kind);
    const to = formatWhen(after.start, after.end, kind);
    // An end-only change on a one-off shows the same start; say so plainly.
    lines.push(from === to ? `🕒 End time changed: ${to}` : `🕒 Time changed: ${from} → ${to}`);
  }
  if (before.location !== after.location) {
    lines.push(`📍 Location changed: ${before.location || "none"} → ${after.location || "none"}`);
  }
  if (lines.length === 0) return null;
  const heading =
    kind === "series" ? "📣 **This event changed for all dates**" : "📣 **This event changed**";
  const message = [heading, ...lines].join("\n");
  return message.length <= MESSAGE_MAX ? message : `${message.slice(0, MESSAGE_MAX - 1)}…`;
}

export const CANCELLED_NOTICE = "❌ This event was cancelled.";
