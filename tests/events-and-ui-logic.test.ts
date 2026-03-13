import { describe, expect, it } from "vitest";
import {
  deriveEventStatus,
  formatEventDate,
  splitEventsByStatus,
  type EventEntry,
} from "../src/lib/events";
import { ensureElementId, setLightboxPreviousFocus } from "../src/lib/lightbox";

function makeEvent(data: Partial<EventEntry["data"]>): EventEntry {
  return {
    id: "test-event",
    slug: "test-event",
    body: "",
    collection: "events",
    data: {
      title: "Test Event",
      date: new Date("2026-10-10T00:00:00Z"),
      summary: "Summary",
      ...data,
    },
    render: async () => ({
      Content: (() => null) as unknown as never,
      headings: [],
      remarkPluginFrontmatter: {},
    }),
  } as EventEntry;
}

describe("event status and formatting", () => {
  it("derives status from event dates by default", () => {
    const upcoming = makeEvent({ date: new Date("2026-10-10T00:00:00Z") });
    const past = makeEvent({
      date: new Date("2025-10-10T00:00:00Z"),
      endDate: new Date("2025-10-11T00:00:00Z"),
    });

    expect(deriveEventStatus(upcoming, new Date("2026-10-09T00:00:00Z"))).toBe("upcoming");
    expect(deriveEventStatus(past, new Date("2025-10-13T00:00:00Z"))).toBe("past");
  });

  it("treats explicit status and past flags as overrides", () => {
    const forcedUpcoming = makeEvent({
      date: new Date("2024-01-01T00:00:00Z"),
      status: "upcoming",
    });
    const forcedPast = makeEvent({
      date: new Date("2027-01-01T00:00:00Z"),
      past: true,
    });

    expect(deriveEventStatus(forcedUpcoming, new Date("2026-01-01T00:00:00Z"))).toBe("upcoming");
    expect(deriveEventStatus(forcedPast, new Date("2026-01-01T00:00:00Z"))).toBe("past");
  });

  it("groups and sorts upcoming and past events", () => {
    const events = [
      makeEvent({ title: "Past 1", date: new Date("2025-01-01T00:00:00Z") }),
      makeEvent({ title: "Upcoming 2", date: new Date("2026-07-01T00:00:00Z") }),
      makeEvent({ title: "Upcoming 1", date: new Date("2026-06-01T00:00:00Z") }),
    ];

    const { upcoming, past } = splitEventsByStatus(events, new Date("2026-05-01T00:00:00Z"));

    expect(upcoming.map((event) => event.data.title)).toEqual(["Upcoming 1", "Upcoming 2"]);
    expect(past.map((event) => event.data.title)).toEqual(["Past 1"]);
  });

  it("formats single dates and date ranges", () => {
    expect(formatEventDate(new Date("2026-06-01T00:00:00Z"))).toBe("June 1, 2026");
    expect(
      formatEventDate(new Date("2026-06-01T00:00:00Z"), new Date("2026-06-03T00:00:00Z")),
    ).toBe("June 1–3, 2026");
  });
});

describe("lightbox interaction helpers", () => {
  it("stores opener focus id for lightbox restoration", () => {
    const lightbox = { dataset: {} } as unknown as HTMLElement;
    const opener = { id: "", dataset: {} } as unknown as HTMLElement;

    const id = ensureElementId(opener, "test-opener");
    setLightboxPreviousFocus(lightbox, opener, "test-opener");

    expect(id.startsWith("test-opener-")).toBe(true);
    expect(lightbox.dataset.previousFocus).toBe(id);
  });
});
