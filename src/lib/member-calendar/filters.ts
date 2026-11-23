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
