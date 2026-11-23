/**
 * Chapter filter + hidden-day logic for the member calendar (PRD 008, R4).
 * Browser-safe and pure, apart from the localStorage helpers.
 */
import { CHAPTERS, isChapterKey, type ChapterKey } from "./chapters";
import type { CalendarEvent } from "./types";

export const FILTER_STORAGE_KEY = "gbva.calendar.filters.v1";
export const CALENDAR_TIME_ZONE = "America/New_York";

/**
 * The saved value lists *hidden* chapters rather than selected ones, so a
 * chapter added later starts out visible for returning members.
 */
interface StoredFilters {
  hidden: string[];
}

export function parseStoredFilters(raw: string | null): Set<ChapterKey> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as Partial<StoredFilters>;
    if (!Array.isArray(parsed.hidden)) return new Set();
    return new Set(parsed.hidden.filter(isChapterKey));
  } catch {
    return new Set();
  }
}

export function serializeFilters(hidden: Iterable<ChapterKey>): string {
  return JSON.stringify({ hidden: [...new Set(hidden)].sort() } satisfies StoredFilters);
}

export function loadHiddenChapters(): Set<ChapterKey> {
  try {
    return parseStoredFilters(window.localStorage.getItem(FILTER_STORAGE_KEY));
  } catch {
    return new Set();
  }
}

export function saveHiddenChapters(hidden: Iterable<ChapterKey>): void {
  try {
    window.localStorage.setItem(FILTER_STORAGE_KEY, serializeFilters(hidden));
  } catch {
    /* storage unavailable: fail silently (R4.5) */
  }
}

/** Your RSVP state for an event, for the RSVP filter. */
export type RsvpState = "going" | "maybe" | "notGoing" | "none";

export const RSVP_STATES: readonly RsvpState[] = ["going", "maybe", "notGoing", "none"];

export const RSVP_STATE_LABELS: Record<RsvpState, string> = {
  going: "Going",
  maybe: "Maybe",
  notGoing: "Not going",
  none: "No response",
};

export function rsvpStateOf(event: Pick<CalendarEvent, "myStatus">): RsvpState {
  switch (event.myStatus) {
    case "accepted":
      return "going";
    case "tentative":
      return "maybe";
    case "declined":
      return "notGoing";
    default:
      return "none";
  }
}

/** Is the event's RSVP state one of the states selected to show? */
export function matchesRsvpFilter(
  event: Pick<CalendarEvent, "myStatus">,
  shown: ReadonlySet<RsvpState>,
): boolean {
  return shown.has(rsvpStateOf(event));
}

/** General (un-prefixed) events always show. */
export function isEventVisible(
  event: Pick<CalendarEvent, "chapter">,
  hidden: ReadonlySet<ChapterKey>,
): boolean {
  return event.chapter === null || !hidden.has(event.chapter);
}

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CALENDAR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD in the calendar's time zone. */
export function dateKeyFor(date: Date): string {
  return dateKeyFormatter.format(date);
}

/**
 * The day an event belongs to. Organizers create one event per day (R2.5),
 * so an event is counted on its start day only.
 */
export function eventDayKey(event: Pick<CalendarEvent, "start" | "allDay">): string {
  if (event.allDay || /^\d{4}-\d{2}-\d{2}$/.test(event.start)) return event.start.slice(0, 10);
  return dateKeyFor(new Date(event.start));
}

/**
 * Has the event finished? Timed events are past once their end time passes.
 * All-day events use an exclusive end date, so they're past from that date
 * (Eastern) onward.
 */
export function isPastEvent(
  event: Pick<CalendarEvent, "end" | "start" | "allDay">,
  now: Date = new Date(),
): boolean {
  const end = event.end || event.start;
  if (event.allDay || /^\d{4}-\d{2}-\d{2}$/.test(end)) return end.slice(0, 10) <= dateKeyFor(now);
  return new Date(end).getTime() <= now.getTime();
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
};

/** Lowercase, accent-free, straight quotes, single spaces: for matching only. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Title, full raw title, location and description text, ready to match. */
export function eventSearchText(
  event: Pick<CalendarEvent, "title" | "rawTitle" | "location" | "descriptionHtml"> &
    Partial<Pick<CalendarEvent, "mapLabel">>,
): string {
  const description = (event.descriptionHtml ?? "")
    .replace(/<br\s*\/?>|<\/(p|div|li)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ENTITIES[name]);
  return normalizeSearchText(
    [event.title, event.rawTitle, event.location ?? "", event.mapLabel ?? "", description].join(
      " ",
    ),
  );
}

/** Every word in the query must appear somewhere in the event's text. */
export function matchesSearch(
  event: Pick<CalendarEvent, "title" | "rawTitle" | "location" | "descriptionHtml"> &
    Partial<Pick<CalendarEvent, "mapLabel">>,
  query: string,
): boolean {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  const text = eventSearchText(event);
  return terms.every((term) => text.includes(term));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Sunday that starts the week containing a YYYY-MM-DD day (weeks start Sunday). */
export function weekKeyFor(dayKey: string): string {
  const d = new Date(`${dayKey.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/** Weeks (by Sunday key) that contain at least one of the given days. */
export function weeksWithDays(dayKeys: Iterable<string>): Set<string> {
  const weeks = new Set<string>();
  for (const key of dayKeys) weeks.add(weekKeyFor(key));
  return weeks;
}

const easternClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: CALENDAR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function easternParts(date: Date): { day: string; hour: number; minute: number } {
  const parts = Object.fromEntries(easternClock.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Hours to show in the week view: from the earliest timed event's start hour to
 * the latest one's end hour (Eastern), so empty early/late hours are hidden.
 * Falls back to 9 AM–5 PM when there are no timed events.
 */
export function timeGridHours(events: readonly Pick<CalendarEvent, "start" | "end" | "allDay">[]): {
  slotMinTime: string;
  slotMaxTime: string;
} {
  let min = 24;
  let max = 0;
  for (const event of events) {
    if (event.allDay || /^\d{4}-\d{2}-\d{2}$/.test(event.start)) continue;
    const start = easternParts(new Date(event.start));
    const end = easternParts(new Date(event.end || event.start));
    min = Math.min(min, start.hour);
    const endHour =
      end.day > start.day ? 24 : end.minute > 0 ? end.hour + 1 : Math.max(end.hour, start.hour + 1);
    max = Math.max(max, endHour);
  }
  if (min >= max) return { slotMinTime: "09:00:00", slotMaxTime: "17:00:00" };
  return { slotMinTime: `${pad2(min)}:00:00`, slotMaxTime: `${pad2(max)}:00:00` };
}

/**
 * Splits [start, end) into consecutive windows of at most `maxDays`, so a long
 * range can be fetched within the events API's per-request limit.
 */
export function splitRange(start: Date, end: Date, maxDays = 90): { start: Date; end: Date }[] {
  const windows: { start: Date; end: Date }[] = [];
  let cursor = start.getTime();
  const stop = end.getTime();
  while (cursor < stop) {
    const next = Math.min(cursor + maxDays * DAY_MS, stop);
    windows.push({ start: new Date(cursor), end: new Date(next) });
    cursor = next;
  }
  return windows;
}

/** Count of filtered-out events per day, keyed by YYYY-MM-DD. */
export function hiddenCountsByDay(
  events: readonly CalendarEvent[],
  hidden: ReadonlySet<ChapterKey>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (isEventVisible(event, hidden)) continue;
    const key = eventDayKey(event);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export const ALL_CHAPTER_KEYS: readonly ChapterKey[] = CHAPTERS.map((c) => c.key);
