/**
 * List view date ranges (PRD 009, R6). Dates are calendar days (YYYY-MM-DD) in
 * the calendar's time zone; `end` is exclusive, as FullCalendar expects.
 * Browser-safe and pure.
 */

export type RangePreset = "30d" | "3m" | "6m" | "year" | "custom";

/** How far prev/next move the range. */
export type RangeStep = { months: number } | { days: number };

export interface ListRange {
  preset: RangePreset;
  step: RangeStep;
  /** First day shown (YYYY-MM-DD). */
  start: string;
  /** Day after the last day shown (YYYY-MM-DD, exclusive). */
  end: string;
}

export const DEFAULT_PRESET: Exclude<RangePreset, "custom"> = "6m";
export const MAX_RANGE_MONTHS = 18;

export const PRESET_LABELS: Record<RangePreset, string> = {
  "30d": "Next 30 days",
  "3m": "Next 3 months",
  "6m": "Next 6 months",
  year: "This year",
  custom: "Custom",
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function toDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_KEY.test(value)) return false;
  const date = toDate(value);
  return !Number.isNaN(date.getTime()) && toKey(date) === value;
}

export function addDays(day: string, days: number): string {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + days);
  return toKey(d);
}

/** Adds months, clamping to the end of shorter months (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(day: string, months: number): string {
  const d = toDate(day);
  const targetDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(targetDay, lastDay));
  return toKey(d);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((toDate(end).getTime() - toDate(start).getTime()) / 86_400_000);
}

/** The range for a preset, relative to `today` (YYYY-MM-DD). */
export function presetRange(preset: Exclude<RangePreset, "custom">, today: string): ListRange {
  switch (preset) {
    case "30d":
      return { preset, start: today, end: addDays(today, 30), step: { days: 30 } };
    case "3m":
      return { preset, start: today, end: addMonths(today, 3), step: { months: 3 } };
    case "6m":
      return { preset, start: today, end: addMonths(today, 6), step: { months: 6 } };
    case "year": {
      const year = today.slice(0, 4);
      return {
        preset,
        start: `${year}-01-01`,
        end: `${Number(year) + 1}-01-01`,
        step: { months: 12 },
      };
    }
  }
}

export type RangeError = "missing" | "order" | "too-long";

export const RANGE_ERROR_MESSAGES: Record<RangeError, string> = {
  missing: "Choose both a start and an end date.",
  order: "The end date must be on or after the start date.",
  "too-long": `Ranges can be at most ${MAX_RANGE_MONTHS} months.`,
};

/**
 * Validates a custom range from date inputs, where `to` is the last day shown
 * (inclusive). Returns the range or an error.
 */
export function customRange(
  from: string,
  to: string,
): { ok: true; range: ListRange } | { ok: false; error: RangeError } {
  if (!isDayKey(from) || !isDayKey(to)) return { ok: false, error: "missing" };
  if (to < from) return { ok: false, error: "order" };
  const end = addDays(to, 1);
  if (end > addMonths(from, MAX_RANGE_MONTHS)) return { ok: false, error: "too-long" };
  return {
    ok: true,
    range: { preset: "custom", start: from, end, step: { days: daysBetween(from, end) } },
  };
}

/** Moves a range by its step (its own length); the result is a custom range. */
export function shiftRange(range: ListRange, direction: 1 | -1): ListRange {
  const move =
    "months" in range.step
      ? (day: string) => addMonths(day, direction * (range.step as { months: number }).months)
      : (day: string) => addDays(day, direction * (range.step as { days: number }).days);
  return { preset: "custom", start: move(range.start), end: move(range.end), step: range.step };
}

/**
 * A range the member chose on purpose shows its past events even with History
 * off: custom ranges (including moved ones) and "This year".
 */
export function rangeIgnoresHistory(range: ListRange): boolean {
  return range.preset === "custom" || range.preset === "year";
}

const PRESET_PARAM: Record<Exclude<RangePreset, "custom">, string> = {
  "30d": "30d",
  "3m": "3m",
  "6m": "6m",
  year: "year",
};

/** Reads ?range= or ?from=&to= (to inclusive). Returns null when absent or invalid. */
export function rangeFromParams(params: URLSearchParams, today: string): ListRange | null {
  const preset = params.get("range");
  if (preset && preset in PRESET_PARAM) {
    return presetRange(preset as Exclude<RangePreset, "custom">, today);
  }
  const from = params.get("from");
  const to = params.get("to");
  if (from && to) {
    const result = customRange(from, to);
    return result.ok ? result.range : null;
  }
  return null;
}

/** Writes the range into URL params; the default preset leaves the URL clean. */
export function applyRangeToParams(params: URLSearchParams, range: ListRange | null): void {
  params.delete("range");
  params.delete("from");
  params.delete("to");
  if (!range || range.preset === DEFAULT_PRESET) return;
  if (range.preset === "custom") {
    params.set("from", range.start);
    params.set("to", addDays(range.end, -1));
  } else {
    params.set("range", PRESET_PARAM[range.preset]);
  }
}
