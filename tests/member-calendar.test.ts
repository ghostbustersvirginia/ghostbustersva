import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  contrastRatio,
  GENERAL_COLOR,
  GENERAL_TEXT_COLOR,
  parseEventTitle,
} from "../src/lib/member-calendar/chapters";
import {
  eventDayKey,
  hiddenCountsByDay,
  isEventVisible,
  isPastEvent,
  matchesSearch,
  splitRange,
  timeGridHours,
  weekKeyFor,
  weeksWithDays,
  parseStoredFilters,
  serializeFilters,
} from "../src/lib/member-calendar/filters";
import type { CalendarEvent } from "../src/lib/member-calendar/types";
import {
  csvCell,
  diffEventSnapshot,
  eventFingerprint,
  isLateChange,
  lateChangesToCsv,
  mergeAttendee,
  normalizeEvent,
  rsvpAvailability,
  sanitizeDescription,
  buildLateChangeRecord,
} from "../src/lib/member-calendar/server/logic";
import type { GoogleEvent } from "../src/lib/member-calendar/server/google-api";
import {
  decodeSession,
  encodeSession,
  needsMembershipRecheck,
  newSession,
} from "../src/lib/member-calendar/server/session";

const CAL = "c_test@group.calendar.google.com";

function gEvent(overrides: Partial<GoogleEvent> = {}): GoogleEvent {
  return {
    id: "evt1",
    etag: '"1"',
    summary: "NoVA - Zoo Boo",
    start: { dateTime: "2026-10-19T14:00:00-04:00" },
    end: { dateTime: "2026-10-19T17:00:00-04:00" },
    organizer: { email: CAL },
    attendees: [],
    ...overrides,
  };
}

function cEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e",
    recurringEventId: null,
    title: "t",
    rawTitle: "t",
    chapter: null,
    interest: false,
    start: "2026-10-19T14:00:00-04:00",
    end: "2026-10-19T15:00:00-04:00",
    allDay: false,
    location: null,
    descriptionHtml: null,
    htmlLink: null,
    myStatus: null,
    counts: { yes: 0, maybe: 0, no: 0 },
    attendees: [],
    changedSinceRsvp: false,
    rsvpAllowed: true,
    rsvpBlockedReason: null,
    ...overrides,
  };
}

describe("parseEventTitle (R4.1)", () => {
  it.each([
    ["NoVA - Zoo Boo", "nova", "Zoo Boo"],
    ["nova – Zoo Boo", "nova", "Zoo Boo"],
    ["RVA - Toy Drive", "central", "Toy Drive"],
    ["Richmond — Parade", "central", "Parade"],
    ["757 - Ghost Walk", "southeast", "Ghost Walk"],
    ["CVille - Meetup", "blue-ridge", "Meetup"],
    ["blue ridge - Meetup", "blue-ridge", "Meetup"],
    ["FXBG - Trunk or Treat", "fredericksburg", "Trunk or Treat"],
    ["Virtual - Movie Night", "virtual", "Movie Night"],
    ["NoVA - Zoo Boo - Day 2", "nova", "Zoo Boo - Day 2"],
    ["Charlottesville - Birthday party", "blue-ridge", "Birthday party"],
    ["Central- VA Comicon", "central", "VA Comicon"],
    ["NoVA -5K Run", "nova", "5K Run"],
  ])("%s → %s / %s", (raw, chapter, title) => {
    expect(parseEventTitle(raw)).toEqual({ chapter, title, interest: false });
  });

  it.each([
    ["Interest - NOVA - Tosche Station Trunk or Treat", "nova", "Tosche Station Trunk or Treat"],
    [
      "Interest - Blue Ridge - Massanutten Regional Library Fandom Fest",
      "blue-ridge",
      "Massanutten Regional Library Fandom Fest",
    ],
    ["interest – RVA – Parade", "central", "Parade"],
    [
      'Interest - NOVA - "Professional" Paranormal Investigation',
      "nova",
      '"Professional" Paranormal Investigation',
    ],
    ["Interest - Bake Sale", null, "Bake Sale"],
    [
      "NOVA - (Interest) - Colton's Cars (Anything's PAWSible)",
      "nova",
      "Colton's Cars (Anything's PAWSible)",
    ],
    ["(Interest) - RVA - Parade", "central", "Parade"],
    ["757 - [interest] - Ghost Walk", "southeast", "Ghost Walk"],
  ])("Interest: %s → %s / %s", (raw, chapter, title) => {
    expect(parseEventTitle(raw)).toEqual({ chapter, title, interest: true });
  });

  it("keeps un-prefixed and unknown-prefix titles whole as General", () => {
    const general = (title: string) => ({ chapter: null, title, interest: false });
    expect(parseEventTitle("Zoo Boo - Day 2")).toEqual(general("Zoo Boo - Day 2"));
    expect(parseEventTitle("Annual Meeting")).toEqual(general("Annual Meeting"));
    expect(parseEventTitle("NoVA-Zoo Boo")).toEqual(general("NoVA-Zoo Boo"));
    expect(parseEventTitle("Spider-Man - Movie Night")).toEqual(
      general("Spider-Man - Movie Night"),
    );
    expect(parseEventTitle("Zoo Boo - (Interest) - Day 2")).toEqual(
      general("Zoo Boo - (Interest) - Day 2"),
    );
    expect(parseEventTitle("GBVA Game Night - Online")).toEqual(
      general("GBVA Game Night - Online"),
    );
    expect(parseEventTitle("Interested Parties - Meetup")).toEqual(
      general("Interested Parties - Meetup"),
    );
    expect(parseEventTitle("")).toEqual(general("(Untitled event)"));
  });
});

describe("chapter palette (R4.2)", () => {
  it("every chapter color has at least 4.5:1 contrast with its text", () => {
    for (const c of CHAPTERS)
      expect(contrastRatio(c.color, c.textColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(GENERAL_COLOR, GENERAL_TEXT_COLOR)).toBeGreaterThanOrEqual(4.5);
  });

  it("marks only Virtual as virtual", () => {
    expect(CHAPTERS.filter((c) => c.virtual).map((c) => c.key)).toEqual(["virtual"]);
  });
});

describe("filters (R4.3–R4.7)", () => {
  it("round-trips hidden chapters and drops unknown keys", () => {
    const raw = serializeFilters(["nova", "central"]);
    expect([...parseStoredFilters(raw)].sort()).toEqual(["central", "nova"]);
    expect(parseStoredFilters('{"hidden":["nova","gone"]}')).toEqual(new Set(["nova"]));
    expect(parseStoredFilters("not json")).toEqual(new Set());
    expect(parseStoredFilters(null)).toEqual(new Set());
  });

  it("always shows General events", () => {
    const hidden = new Set(["nova"] as const);
    expect(isEventVisible({ chapter: null }, hidden)).toBe(true);
    expect(isEventVisible({ chapter: "nova" }, hidden)).toBe(false);
    expect(isEventVisible({ chapter: "central" }, hidden)).toBe(true);
  });

  it("counts hidden events per Eastern day", () => {
    const events = [
      cEvent({ id: "a", chapter: "nova", start: "2026-10-19T23:30:00-04:00" }),
      cEvent({ id: "b", chapter: "nova", start: "2026-10-19T10:00:00-04:00" }),
      cEvent({ id: "c", chapter: "central", start: "2026-10-19T10:00:00-04:00" }),
      cEvent({ id: "d", chapter: "nova", allDay: true, start: "2026-10-20", end: "2026-10-21" }),
    ];
    const counts = hiddenCountsByDay(events, new Set(["nova"]));
    expect(counts.get("2026-10-19")).toBe(2);
    expect(counts.get("2026-10-20")).toBe(1);
    expect(eventDayKey(events[0])).toBe("2026-10-19");
  });
});

describe("matchesSearch", () => {
  const event = cEvent({
    title: "Colton’s Cars (Anything’s PAWSible)",
    rawTitle: "NOVA - (Interest) - Colton’s Cars (Anything’s PAWSible)",
    location: "Café Rio, Herndon VA",
    descriptionHtml: "<p>Bring the <b>Ecto-1</b> &amp; proton packs<br>Meet at 9</p>",
  });

  it("matches title, raw title, location and description text, case-insensitively", () => {
    expect(matchesSearch(event, "colton")).toBe(true);
    expect(matchesSearch(event, "NOVA")).toBe(true);
    expect(matchesSearch(event, "herndon")).toBe(true);
    expect(matchesSearch(event, "ecto-1")).toBe(true);
    expect(matchesSearch(event, "& proton")).toBe(true);
  });

  it("requires every word, ignores accents and curly quotes", () => {
    expect(matchesSearch(event, "proton cars")).toBe(true);
    expect(matchesSearch(event, "proton trucks")).toBe(false);
    expect(matchesSearch(event, "cafe")).toBe(true);
    expect(matchesSearch(event, "colton's")).toBe(true);
  });

  it("doesn't match HTML tag names, and an empty query matches everything", () => {
    expect(matchesSearch(event, "<b>")).toBe(false);
    expect(matchesSearch(event, "<p>")).toBe(false);
    expect(matchesSearch(event, "   ")).toBe(true);
  });
});

describe("splitRange", () => {
  it("splits a long range into windows of at most 90 days with no gaps", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2027-01-01T00:00:00Z");
    const windows = splitRange(start, end);
    expect(windows).toHaveLength(5);
    expect(windows[0].start).toEqual(start);
    expect(windows.at(-1)!.end).toEqual(end);
    for (let i = 1; i < windows.length; i++) expect(windows[i].start).toEqual(windows[i - 1].end);
    for (const w of windows) {
      expect(w.end.getTime() - w.start.getTime()).toBeLessThanOrEqual(90 * 864e5);
    }
  });

  it("returns nothing for an empty range", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    expect(splitRange(d, d)).toEqual([]);
  });
});

describe("month weeks", () => {
  it("maps a day to the Sunday that starts its week", () => {
    expect(weekKeyFor("2026-11-22")).toBe("2026-11-22"); // Sunday
    expect(weekKeyFor("2026-11-28")).toBe("2026-11-22"); // Saturday
    expect(weekKeyFor("2026-12-02")).toBe("2026-11-29"); // across a month boundary
  });

  it("collects the weeks that have events", () => {
    expect([...weeksWithDays(["2026-11-23", "2026-11-27", "2026-12-05"])]).toEqual([
      "2026-11-22",
      "2026-11-29",
    ]);
  });
});

describe("timeGridHours", () => {
  const timed = (start: string, end: string) => cEvent({ start, end });

  it("spans the earliest start hour to the latest end hour (Eastern)", () => {
    expect(
      timeGridHours([
        timed("2026-11-23T11:45:00-05:00", "2026-11-23T12:45:00-05:00"),
        timed("2026-11-24T20:00:00-05:00", "2026-11-24T21:00:00-05:00"),
      ]),
    ).toEqual({ slotMinTime: "11:00:00", slotMaxTime: "21:00:00" });
  });

  it("rounds a partial end hour up and ignores all-day events", () => {
    expect(
      timeGridHours([
        timed("2026-11-23T14:00:00-05:00", "2026-11-23T15:30:00-05:00"),
        cEvent({ allDay: true, start: "2026-11-24", end: "2026-11-25" }),
      ]),
    ).toEqual({ slotMinTime: "14:00:00", slotMaxTime: "16:00:00" });
  });

  it("extends to midnight for events that cross into the next day", () => {
    expect(
      timeGridHours([timed("2026-11-23T22:00:00-05:00", "2026-11-24T01:00:00-05:00")]),
    ).toEqual({ slotMinTime: "22:00:00", slotMaxTime: "24:00:00" });
  });

  it("falls back to 9–5 with no timed events", () => {
    expect(timeGridHours([])).toEqual({ slotMinTime: "09:00:00", slotMaxTime: "17:00:00" });
  });
});

describe("isPastEvent", () => {
  const now = new Date("2026-11-23T16:00:00Z"); // 11:00 AM Eastern

  it("treats timed events as past once they end", () => {
    expect(isPastEvent(cEvent({ end: "2026-11-23T10:30:00-05:00" }), now)).toBe(true);
    expect(isPastEvent(cEvent({ end: "2026-11-23T11:00:00-05:00" }), now)).toBe(true);
    // In progress: started earlier, still running.
    expect(
      isPastEvent(
        cEvent({ start: "2026-11-23T10:00:00-05:00", end: "2026-11-23T12:00:00-05:00" }),
        now,
      ),
    ).toBe(false);
  });

  it("uses the exclusive Eastern end date for all-day events", () => {
    const allDay = (start: string, end: string) => cEvent({ allDay: true, start, end });
    expect(isPastEvent(allDay("2026-11-22", "2026-11-23"), now)).toBe(true);
    expect(isPastEvent(allDay("2026-11-23", "2026-11-24"), now)).toBe(false);
    // 11 PM Eastern on Nov 23 is already Nov 24 in UTC; still "today" in Eastern.
    expect(isPastEvent(allDay("2026-11-23", "2026-11-24"), new Date("2026-11-24T04:00:00Z"))).toBe(
      false,
    );
  });
});

describe("session cookie", () => {
  const secret = "s3cret";

  it("round-trips and rejects tampering or expiry", () => {
    const session = newSession({ email: "a@b.com", name: "A B", isOrganizer: true }, 1000);
    const encoded = encodeSession(session, secret);
    expect(decodeSession(encoded, secret, 2000)).toEqual(session);
    expect(decodeSession(encoded, "other", 2000)).toBeNull();
    expect(decodeSession(`${encoded.slice(0, -2)}xx`, secret, 2000)).toBeNull();
    expect(decodeSession(encoded, secret, session.expiresAt + 1)).toBeNull();
    expect(decodeSession(undefined, secret)).toBeNull();
  });

  it("asks for a membership re-check after the TTL", () => {
    const session = newSession({ email: "a@b.com", name: "", isOrganizer: false }, 0);
    expect(needsMembershipRecheck(session, 720, 719 * 60_000)).toBe(false);
    expect(needsMembershipRecheck(session, 720, 721 * 60_000)).toBe(true);
  });
});

describe("sanitizeDescription (R8)", () => {
  it("strips scripts and handlers, and makes links safe", () => {
    const html = sanitizeDescription(
      '<p onclick="x()">Hi <script>alert(1)</script><a href="https://x.org">x</a><a href="javascript:alert(1)">bad</a></p>',
    )!;
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://x.org"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it("converts plain-text newlines and handles empty input", () => {
    expect(sanitizeDescription("line 1\nline 2")).toBe("line 1<br />line 2");
    expect(sanitizeDescription("   ")).toBeNull();
    expect(sanitizeDescription(undefined)).toBeNull();
  });
});

describe("fingerprints (R6)", () => {
  it("changes when time, place or title change, but not for attendees", () => {
    const base = gEvent();
    const fp = eventFingerprint(base);
    expect(eventFingerprint({ ...base, attendees: [{ email: "x@y.com" }] })).toBe(fp);
    expect(eventFingerprint({ ...base, location: "Elsewhere" })).not.toBe(fp);
    expect(eventFingerprint({ ...base, summary: "NoVA - Renamed" })).not.toBe(fp);
    expect(
      eventFingerprint({ ...base, start: { dateTime: "2026-10-19T15:00:00-04:00" } }),
    ).not.toBe(fp);
  });
});

describe("mergeAttendee (R5.3)", () => {
  const member = { email: "me@gmail.com", name: "Me" };

  it("adds, updates (case-insensitively), and removes", () => {
    const added = mergeAttendee(
      [{ email: "other@x.com", responseStatus: "accepted" }],
      member,
      "accepted",
    );
    expect(added).toEqual([
      { email: "other@x.com", responseStatus: "accepted" },
      { email: "me@gmail.com", displayName: "Me", responseStatus: "accepted" },
    ]);
    const updated = mergeAttendee(
      [{ email: "ME@Gmail.com", responseStatus: "accepted", comment: "hi" }],
      member,
      "declined",
    );
    expect(updated).toEqual([{ email: "ME@Gmail.com", responseStatus: "declined", comment: "hi" }]);
    expect(mergeAttendee(updated, member, "remove")).toEqual([]);
  });
});

describe("normalizeEvent (R2)", () => {
  it("strips the prefix, hides the calendar itself, and reports my status and counts", () => {
    const event = gEvent({
      attendees: [
        { email: CAL, responseStatus: "accepted", organizer: true },
        { email: "me@gmail.com", responseStatus: "tentative" },
        { email: "pal@gmail.com", responseStatus: "accepted", displayName: "Pal" },
        { email: "anon@gmail.com", responseStatus: "declined" },
        { email: "room@resource.calendar.google.com", resource: true, responseStatus: "accepted" },
      ],
      description: "<b>Bring</b> slime",
    });
    const result = normalizeEvent(event, {
      calendarId: CAL,
      viewerEmail: "ME@gmail.com",
      storedNames: new Map([["me@gmail.com", "Me Myself"]]),
      storedFingerprint: eventFingerprint(event),
    });
    expect(result.title).toBe("Zoo Boo");
    expect(result.chapter).toBe("nova");
    expect(result.interest).toBe(false);
    expect(result.myStatus).toBe("tentative");
    expect(result.counts).toEqual({ yes: 1, maybe: 1, no: 1 });
    expect(result.attendees.map((a) => a.name)).toEqual(["Pal", "Me Myself", "anon"]);
    expect(JSON.stringify(result)).not.toContain("@gmail.com");
    expect(result.changedSinceRsvp).toBe(false);
    expect(result.rsvpAllowed).toBe(true);
  });

  it("leaves invited group addresses out of attendees and counts", () => {
    const event = gEvent({
      attendees: [
        { email: "All-Members@ghostbustersva.com", responseStatus: "accepted" },
        { email: "officers@ghostbustersva.com", responseStatus: "declined" },
        { email: "pal@gmail.com", responseStatus: "accepted", displayName: "Pal" },
      ],
    });
    const result = normalizeEvent(event, {
      calendarId: CAL,
      excludedEmails: ["all-members@ghostbustersva.com", "officers@ghostbustersva.com"],
      viewerEmail: "me@gmail.com",
      storedNames: new Map(),
    });
    expect(result.attendees.map((a) => a.name)).toEqual(["Pal"]);
    expect(result.counts).toEqual({ yes: 1, maybe: 0, no: 0 });
  });

  it("flags changes since RSVP only when the viewer has RSVP'd", () => {
    const event = gEvent({ attendees: [{ email: "me@gmail.com", responseStatus: "accepted" }] });
    const ctx = { calendarId: CAL, viewerEmail: "me@gmail.com", storedNames: new Map() };
    expect(normalizeEvent(event, { ...ctx, storedFingerprint: "old" }).changedSinceRsvp).toBe(true);
    expect(normalizeEvent(gEvent(), { ...ctx, storedFingerprint: "old" }).changedSinceRsvp).toBe(
      false,
    );
  });

  it("blocks RSVP for events organized elsewhere", () => {
    expect(
      rsvpAvailability(gEvent({ organizer: { email: "someone@gmail.com" } }), CAL).allowed,
    ).toBe(false);
    expect(rsvpAvailability(gEvent(), CAL).allowed).toBe(true);
  });
});

describe("late changes (R7)", () => {
  const start = new Date("2026-10-19T14:00:00-04:00").getTime();
  const minutes = (n: number) => n * 60_000;

  it("records Yes → anything else from 2 hours before the start, with no end cutoff", () => {
    expect(isLateChange("accepted", "declined", start, start - minutes(119), 120)).toBe(true);
    expect(isLateChange("accepted", "tentative", start, start - minutes(120), 120)).toBe(true);
    expect(isLateChange("accepted", "removed", start, start + minutes(60 * 24 * 5), 120)).toBe(
      true,
    );
  });

  it("ignores early changes, non-Yes starts, and Yes → Yes", () => {
    expect(isLateChange("accepted", "declined", start, start - minutes(121), 120)).toBe(false);
    expect(isLateChange("tentative", "declined", start, start, 120)).toBe(false);
    expect(isLateChange(undefined, "declined", start, start, 120)).toBe(false);
    expect(isLateChange("accepted", "accepted", start, start, 120)).toBe(false);
  });

  it("diffs Google-side changes against snapshots", () => {
    const event = gEvent({
      attendees: [
        { email: "a@gmail.com", responseStatus: "declined" },
        { email: "new@gmail.com", responseStatus: "accepted" },
      ],
    });
    const snapshot = new Map([
      ["a@gmail.com", "accepted" as const],
      ["gone@gmail.com", "accepted" as const],
    ]);
    const diff = diffEventSnapshot({
      event,
      calendarId: CAL,
      snapshot,
      names: new Map([["gone@gmail.com", "Gone Person"]]),
      nowMs: start - minutes(30),
      windowMinutes: 120,
    });
    expect(diff.updates).toEqual(
      expect.arrayContaining([
        { eventId: "evt1", email: "a@gmail.com", status: "declined" },
        { eventId: "evt1", email: "gone@gmail.com", status: "removed" },
        { eventId: "evt1", email: "new@gmail.com", status: "accepted" },
      ]),
    );
    expect(diff.lateChanges.map((c) => [c.memberEmail, c.newStatus, c.source])).toEqual([
      ["a@gmail.com", "declined", "google"],
      ["gone@gmail.com", "removed", "google"],
    ]);
    expect(diff.lateChanges[0].minutesBeforeStart).toBe(30);
  });

  it("never snapshots or logs excluded group addresses", () => {
    const group = "all-members@ghostbustersva.com";
    const diff = diffEventSnapshot({
      event: gEvent({ attendees: [{ email: group, responseStatus: "needsAction" }] }),
      calendarId: CAL,
      excludedEmails: [group],
      snapshot: new Map([[group, "accepted" as const]]),
      names: new Map(),
      nowMs: start,
      windowMinutes: 120,
    });
    expect(diff).toEqual({ lateChanges: [], updates: [] });
  });

  it("exports CSV with the PRD columns and defuses formulas", () => {
    const record = buildLateChangeRecord({
      event: gEvent({ summary: "NoVA - =HYPERLINK(evil)" }),
      email: "a@gmail.com",
      name: "+Alice",
      previous: "accepted",
      next: "declined",
      changedAtMs: start + minutes(10),
      source: "site",
    });
    const csv = lateChangesToCsv([record]);
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toBe(
      "event_date,event_start,event_title,chapter,member_name,member_email,previous_status,new_status,changed_at,minutes_before_start,source",
    );
    expect(row).toContain('"2026-10-19"');
    expect(row).toContain(`"'=HYPERLINK(evil)"`);
    expect(row).toContain(`"'+Alice"`);
    expect(row).toContain('"yes","no"');
    expect(row).toContain('"-10"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
});
