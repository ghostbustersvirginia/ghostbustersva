import { beforeEach, describe, expect, it, vi } from "vitest";

const CAL = "c_test@group.calendar.google.com";

const google = vi.hoisted(() => ({
  getCalendarEvent: vi.fn(),
  listCalendarEvents: vi.fn(),
  patchEventAttendees: vi.fn(),
}));
const store = vi.hoisted(() => ({
  withSyncLock: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock("../src/lib/member-calendar/server/google-api", async () => {
  class GoogleApiError extends Error {
    constructor(
      public status: number,
      public reason: string,
    ) {
      super(reason);
    }
  }
  return { ...google, GoogleApiError };
});
vi.mock("../src/lib/member-calendar/server/store", () => store);
vi.mock("../src/lib/member-calendar/server/env", () => ({
  memberEnv: { calendarId: () => CAL },
}));

import { GoogleApiError } from "../src/lib/member-calendar/server/google-api";
import {
  planReinvites,
  updateMyCalendar,
} from "../src/lib/member-calendar/server/update-calendar-service";
import { updateCalendarNotice } from "../src/lib/member-calendar/update-calendar";

const ME = "me@gmail.com";
const yes = { email: "Me@Gmail.com", responseStatus: "accepted", comment: "bringing snacks" };
const other = { email: "other@x.com", responseStatus: "accepted" };

function event(id: string, attendees: object[], recurringEventId?: string) {
  return {
    id,
    etag: '"1"',
    summary: "NoVA - Meeting",
    recurringEventId,
    organizer: { email: CAL },
    start: { dateTime: "2030-01-01T10:00:00Z" },
    end: { dateTime: "2030-01-01T11:00:00Z" },
    attendees,
  };
}

/** A fake calendar: patches update it, reads return the latest copy. */
let calendar: Map<string, ReturnType<typeof event>>;
function useCalendar(events: ReturnType<typeof event>[]) {
  calendar = new Map(events.map((e) => [e.id, e]));
  google.listCalendarEvents.mockResolvedValue(events);
}

const calls = () =>
  google.patchEventAttendees.mock.calls.map((c) => ({
    id: c[1] as string,
    sendUpdates: c[4] as string,
    hasMe: (c[3] as { email: string }[]).some((a) => a.email.toLowerCase() === ME),
  }));

beforeEach(() => {
  vi.clearAllMocks();
  google.getCalendarEvent.mockImplementation(async (_c: string, id: string) => calendar.get(id));
  google.patchEventAttendees.mockImplementation(
    async (_c: string, id: string, _etag: string, attendees: object[]) => {
      const updated = { ...calendar.get(id)!, attendees, etag: '"2"' };
      calendar.set(id, updated);
      return updated;
    },
  );
});

describe("planReinvites (PRD 012, R4.2)", () => {
  it("picks Yes/Maybe events and marks one invitation per series", () => {
    const plan = planReinvites(
      [
        event("one", [yes]),
        event("s_1", [yes], "s"),
        event("no", [{ ...yes, responseStatus: "declined" }]),
        event("s_2", [{ ...yes, responseStatus: "tentative" }], "s"),
        event("none", [other]),
        { ...event("elsewhere", [yes]), organizer: { email: "someone@gmail.com" } },
      ],
      ME,
      CAL,
    );
    expect(plan.map((t) => [t.event.id, t.invite])).toEqual([
      ["one", true],
      ["s_1", true],
      ["s_2", false],
    ]);
  });
});

describe("updateMyCalendar (PRD 012, R4)", () => {
  it("removes silently, then adds back with an invitation, keeping everything else", async () => {
    useCalendar([event("one", [other, yes])]);

    const outcome = await updateMyCalendar({ email: ME });

    expect(calls()).toEqual([
      { id: "one", sendUpdates: "none", hasMe: false },
      { id: "one", sendUpdates: "all", hasMe: true },
    ]);
    // The same attendee entry comes back: status, comment and all (R4.3).
    expect(calendar.get("one")!.attendees).toEqual([other, yes]);
    expect(outcome).toEqual({ sent: 1, total: 1, failed: 0 });
    expect(store.withSyncLock).toHaveBeenCalledTimes(1);
  });

  it("sends one invitation per series and re-adds the rest silently (R3)", async () => {
    useCalendar([event("s_1", [yes], "s"), event("s_2", [yes], "s"), event("s_3", [yes], "s")]);

    const outcome = await updateMyCalendar({ email: ME });

    expect(calls().map((c) => `${c.id}:${c.sendUpdates}`)).toEqual([
      "s_1:none",
      "s_1:all",
      "s_2:none",
      "s_2:none",
      "s_3:none",
      "s_3:none",
    ]);
    expect(outcome).toEqual({ sent: 1, total: 1, failed: 0 });
  });

  it("skips an event whose RSVP changed before it got there", async () => {
    useCalendar([event("one", [yes])]);
    calendar.set("one", event("one", [{ ...yes, responseStatus: "declined" }]));

    expect(await updateMyCalendar({ email: ME })).toEqual({ sent: 0, total: 0, failed: 0 });
    expect(google.patchEventAttendees).not.toHaveBeenCalled();
  });

  it("puts the member back silently when the invitation fails (R4.7)", async () => {
    useCalendar([event("one", [yes]), event("two", [yes])]);
    const patch = google.patchEventAttendees.getMockImplementation()!;
    google.patchEventAttendees.mockImplementation(async (c, id, etag, attendees, sendUpdates) => {
      if (id === "one" && sendUpdates === "all") throw new GoogleApiError(403, "quotaExceeded");
      return patch(c, id, etag, attendees, sendUpdates);
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await updateMyCalendar({ email: ME });

    expect(calendar.get("one")!.attendees).toEqual([yes]);
    expect(outcome).toEqual({ sent: 1, total: 2, failed: 1 });
    // Logged with the event ID, never the member's email (R6.2).
    expect(error.mock.calls.flat().join(" ")).toContain("event=one");
    expect(error.mock.calls.flat().join(" ")).not.toMatch(/me@gmail\.com/i);
    error.mockRestore();
  });

  it("passes a series' invitation to its next instance if the first fails", async () => {
    useCalendar([event("s_1", [yes], "s"), event("s_2", [yes], "s")]);
    const patch = google.patchEventAttendees.getMockImplementation()!;
    google.patchEventAttendees.mockImplementation(async (c, id, etag, attendees, sendUpdates) => {
      if (id === "s_1" && sendUpdates === "all") throw new GoogleApiError(500, "boom");
      return patch(c, id, etag, attendees, sendUpdates);
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await updateMyCalendar({ email: ME });

    expect(calls().map((c) => `${c.id}:${c.sendUpdates}`)).toEqual([
      "s_1:none",
      "s_1:all",
      "s_1:none",
      "s_2:none",
      "s_2:all",
    ]);
    expect(outcome).toEqual({ sent: 1, total: 1, failed: 0 });
    error.mockRestore();
  });

  it("re-reads and retries the re-add on a 412", async () => {
    useCalendar([event("one", [yes])]);
    const patch = google.patchEventAttendees.getMockImplementation()!;
    let conflicted = false;
    google.patchEventAttendees.mockImplementation(async (c, id, etag, attendees, sendUpdates) => {
      if (sendUpdates === "all" && !conflicted) {
        conflicted = true;
        // Someone else RSVPs in between.
        calendar.set(id, { ...calendar.get(id)!, attendees: [other], etag: '"3"' });
        throw new GoogleApiError(412, "conflict");
      }
      return patch(c, id, etag, attendees, sendUpdates);
    });

    const outcome = await updateMyCalendar({ email: ME });

    expect(calendar.get("one")!.attendees).toEqual([other, yes]);
    expect(outcome.sent).toBe(1);
  });
});

describe("updateCalendarNotice (R4.6, R4.7)", () => {
  it.each([
    [{ sent: 0, total: 0 }, "ok", "You don't have any upcoming Yes or Maybe RSVPs."],
    [
      { sent: 1, total: 1 },
      "ok",
      "Sent 1 calendar invitation. Check your email if it doesn't appear.",
    ],
    [
      { sent: 5, total: 5 },
      "ok",
      "Sent 5 calendar invitations. Check your email if they don't appear.",
    ],
    [{ sent: 4, total: 5 }, "warn", "Sent 4 of 5. Try again later for the rest."],
    [{ sent: 0, total: 3 }, "error", "Couldn't send your calendar invitations. Try again later."],
  ])("%o → %s", (result, tone, text) => {
    expect(updateCalendarNotice(result)).toEqual({ tone, text });
  });
});
