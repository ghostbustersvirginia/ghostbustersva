import type { CollectionEntry } from "astro:content";

// NOTE: Classification is evaluated at static build time.
// Production must run scheduled rebuilds so upcoming/past sections stay accurate.

export type EventEntry = CollectionEntry<"events">;
export type EventStatus = "upcoming" | "past";

const EVENT_TIME_ZONE = "America/New_York";

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format date parts for event status");
  }

  return `${year}-${month}-${day}`;
}

function formatDateKeyUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEventEndDateKey(event: EventEntry): string {
  const boundary = event.data.endDate ?? event.data.date;
  return formatDateKeyUTC(boundary);
}

export function deriveEventStatus(event: EventEntry, now: Date = new Date()): EventStatus {
  if (event.data.status) return event.data.status;
  if (typeof event.data.past === "boolean") return event.data.past ? "past" : "upcoming";

  const eventEndDateKey = getEventEndDateKey(event);
  const nowDateKey = formatDateKeyInTimeZone(now, EVENT_TIME_ZONE);
  return nowDateKey <= eventEndDateKey ? "upcoming" : "past";
}

export function splitEventsByStatus(
  events: EventEntry[],
  now: Date = new Date(),
): { upcoming: EventEntry[]; past: EventEntry[] } {
  const upcoming: EventEntry[] = [];
  const past: EventEntry[] = [];

  for (const event of events) {
    if (deriveEventStatus(event, now) === "upcoming") {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  }

  upcoming.sort((a, b) => a.data.date.getTime() - b.data.date.getTime());
  past.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return { upcoming, past };
}

export function formatEventDate(start: Date, end?: Date): string {
  const opts: Intl.DateTimeFormatOptions = { timeZone: "UTC" };
  if (!end) {
    return start.toLocaleDateString("en-US", {
      ...opts,
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const sMonth = start.toLocaleDateString("en-US", { ...opts, month: "long" });
  const eMonth = end.toLocaleDateString("en-US", { ...opts, month: "long" });

  if (sMonth === eMonth) {
    return `${sMonth} ${start.getUTCDate()}–${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  }

  return `${start.toLocaleDateString("en-US", { ...opts, month: "long", day: "numeric" })} – ${end.toLocaleDateString(
    "en-US",
    {
      ...opts,
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  )}`;
}
