import { describe, expect, it } from "vitest";
import {
  addMonths,
  applyRangeToParams,
  customRange,
  presetRange,
  rangeFromParams,
  rangeIgnoresHistory,
  shiftRange,
} from "../src/lib/member-calendar/list-range";

const TODAY = "2026-11-23";

describe("presets (PRD 009, R6.1)", () => {
  it("covers the next 30 days, 3 months, 6 months, and this calendar year", () => {
    expect(presetRange("30d", TODAY)).toMatchObject({
      preset: "30d",
      start: TODAY,
      end: "2026-12-23",
    });
    expect(presetRange("3m", TODAY)).toMatchObject({
      preset: "3m",
      start: TODAY,
      end: "2027-02-23",
    });
    expect(presetRange("6m", TODAY)).toMatchObject({
      preset: "6m",
      start: TODAY,
      end: "2027-05-23",
    });
    expect(presetRange("year", TODAY)).toMatchObject({
      preset: "year",
      start: "2026-01-01",
      end: "2027-01-01",
    });
  });

  it("clamps month math to short months", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
  });
});

describe("customRange (R6.2)", () => {
  it("accepts an inclusive end date and stores it exclusive", () => {
    expect(customRange("2026-12-01", "2026-12-31")).toEqual({
      ok: true,
      range: { preset: "custom", start: "2026-12-01", end: "2027-01-01", step: { days: 31 } },
    });
    expect(customRange("2026-12-05", "2026-12-05")).toMatchObject({ ok: true });
  });

  it("rejects missing, invalid, reversed, and over-18-month ranges", () => {
    expect(customRange("", "2026-12-31")).toEqual({ ok: false, error: "missing" });
    expect(customRange("2026-02-30", "2026-03-01")).toEqual({ ok: false, error: "missing" });
    expect(customRange("2026-12-31", "2026-12-01")).toEqual({ ok: false, error: "order" });
    expect(customRange("2026-01-01", "2027-06-30")).toMatchObject({ ok: true }); // exactly 18 months
    expect(customRange("2026-01-01", "2027-07-01")).toEqual({ ok: false, error: "too-long" });
  });
});

describe("shiftRange (R6.5)", () => {
  it("moves month-based ranges by whole months", () => {
    expect(shiftRange(presetRange("6m", TODAY), 1)).toMatchObject({
      preset: "custom",
      start: "2027-05-23",
      end: "2027-11-23",
    });
    expect(shiftRange(presetRange("year", TODAY), -1)).toMatchObject({
      preset: "custom",
      start: "2025-01-01",
      end: "2026-01-01",
    });
  });

  it("moves day-based ranges by their length in days", () => {
    const back = shiftRange(presetRange("30d", TODAY), -1);
    expect(back).toMatchObject({ preset: "custom", start: "2026-10-24", end: TODAY });
    // Still moves by 30 days after becoming custom.
    expect(shiftRange(back, -1)).toMatchObject({ start: "2026-09-24", end: "2026-10-24" });
    const custom = customRange("2026-12-05", "2026-12-11");
    if (!custom.ok) throw new Error("expected ok");
    expect(shiftRange(custom.range, 1)).toMatchObject({
      preset: "custom",
      start: "2026-12-12",
      end: "2026-12-19",
    });
  });
});

describe("History and URL params (R6.3, R6.4)", () => {
  it("ignores History for custom ranges and This year only", () => {
    expect(rangeIgnoresHistory(presetRange("6m", TODAY))).toBe(false);
    expect(rangeIgnoresHistory(presetRange("30d", TODAY))).toBe(false);
    expect(rangeIgnoresHistory(presetRange("year", TODAY))).toBe(true);
    expect(rangeIgnoresHistory(shiftRange(presetRange("6m", TODAY), -1))).toBe(true);
  });

  it("round-trips presets and custom ranges, and keeps the default out of the URL", () => {
    const params = new URLSearchParams("event=abc");
    applyRangeToParams(params, presetRange("3m", TODAY));
    expect(params.toString()).toBe("event=abc&range=3m");
    expect(rangeFromParams(params, TODAY)).toEqual(presetRange("3m", TODAY));

    const custom = customRange("2026-12-01", "2026-12-31");
    if (!custom.ok) throw new Error("expected ok");
    applyRangeToParams(params, custom.range);
    expect(params.toString()).toBe("event=abc&from=2026-12-01&to=2026-12-31");
    expect(rangeFromParams(params, TODAY)).toEqual(custom.range);

    applyRangeToParams(params, presetRange("6m", TODAY));
    expect(params.toString()).toBe("event=abc");
    expect(rangeFromParams(params, TODAY)).toBeNull();
  });

  it("ignores invalid URL ranges", () => {
    expect(rangeFromParams(new URLSearchParams("range=forever"), TODAY)).toBeNull();
    expect(rangeFromParams(new URLSearchParams("from=2026-01-01&to=2030-01-01"), TODAY)).toBeNull();
  });
});
