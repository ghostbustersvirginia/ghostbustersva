/** Date/label helpers for the member calendar UI (Eastern time). */
import type { CalendarEvent, GoogleResponseStatus } from "../../lib/member-calendar/types";
import { CALENDAR_TIME_ZONE, dateKeyFor } from "../../lib/member-calendar/filters";

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});
const shortDate = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

function allDayDate(value: string): Date {
  // Noon UTC keeps the calendar date stable when formatting in Eastern time.
  return new Date(`${value.slice(0, 10)}T12:00:00Z`);
}

export function formatEventWhen(event: CalendarEvent): string {
  if (event.allDay) return `${dayFormat.format(allDayDate(event.start))} · All day`;
  const start = new Date(event.start);
  const end = new Date(event.end);
  const sameDay = dateKeyFor(start) === dateKeyFor(end);
  return sameDay
    ? `${dayFormat.format(start)} · ${timeFormat.format(start)} – ${timeFormat.format(end)}`
    : `${dayFormat.format(start)} ${timeFormat.format(start)} – ${dayFormat.format(end)} ${timeFormat.format(end)}`;
}

export function formatShortDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? shortDate.format(allDayDate(value))
    : shortDate.format(new Date(value));
}

const resultDay = new Intl.DateTimeFormat("en-US", {
  timeZone: CALENDAR_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Compact date for search results, e.g. "Sat, Nov 7, 2026 · 9:00 AM". */
export function formatResultWhen(event: CalendarEvent): string {
  if (event.allDay) return `${resultDay.format(allDayDate(event.start))} · All day`;
  const start = new Date(event.start);
  return `${resultDay.format(start)} · ${timeFormat.format(start)}`;
}

export const STATUS_LABEL: Record<GoogleResponseStatus, string> = {
  accepted: "Going",
  tentative: "Maybe",
  declined: "Not going",
  needsAction: "No response",
};

/**
 * YYYY-MM-DD for a FullCalendar day cell/header date. FullCalendar may hand
 * back a UTC-coded "marker", a local midnight Date, or a real instant; each
 * case is handled.
 */
export function cellDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  if (date.getHours() === 0 && date.getMinutes() === 0) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  return dateKeyFor(date);
}

export function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

/** Members-only hero image URL (PRD 009, R1); the version busts the browser cache. */
export function eventImageUrl(
  event: Pick<CalendarEvent, "id" | "image">,
  width: 320 | 640 | 1200,
): string | null {
  if (!event.image) return null;
  const params = new URLSearchParams({ w: String(width), v: event.image.version });
  return `/api/calendar/image/${encodeURIComponent(event.id)}?${params}`;
}
