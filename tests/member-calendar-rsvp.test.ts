import { beforeEach, describe, expect, it, vi } from "vitest";

const CAL = "c_test@group.calendar.google.com";

const google = vi.hoisted(() => ({
  getCalendarEvent: vi.fn(),
  listEventInstances: vi.fn(),
  patchEventAttendees: vi.fn(),
}));
const store = vi.hoisted(() => ({
  appendLateChanges: vi.fn(),
  deleteFingerprint: vi.fn(),
  getSnapshots: vi.fn(),
  saveFingerprint: vi.fn(),
  writeSnapshots: vi.fn(),
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
  memberEnv: { calendarId: () => CAL, lateChangeWindowMinutes: () => 120 },
}));

import { GoogleApiError } from "../src/lib/member-calendar/server/google-api";
import { applyRsvp, RsvpNotAllowedError } from "../src/lib/member-calendar/server/rsvp-service";

const member = { email: "Me@Gmail.com", name: "Me" };

function event(id: string, startIso: string, attendees: object[] = [], etag = '"1"') {
  return {
    id,
    etag,
    summary: "NoVA - Meeting",
    recurringEventId: id.includes("_") ? id.split("_")[0] : undefined,
    organizer: { email: CAL },
    start: { dateTime: startIso },
    end: { dateTime: startIso },
    attendees,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  store.getSnapshots.mockResolvedValue(new Map());
  google.patchEventAttendees.mockImplementation(
    async (_cal: string, id: string, _etag: string, attendees: object[]) => ({
      ...event(id, "2030-01-01T10:00:00Z"),
      attendees,
    }),
  );
});

describe("applyRsvp", () => {
  it("patches with If-Match, and re-reads and retries on a 412 conflict (R5.4)", async () => {
    const first = event("e1", "2030-01-01T10:00:00Z", [], '"1"');
    const fresh = event(
      "e1",
      "2030-01-01T10:00:00Z",
      [{ email: "other@x.com", responseStatus: "accepted" }],
      '"2"',
    );
    google.getCalendarEvent.mockResolvedValueOnce(first).mockResolvedValueOnce(fresh);
    google.patchEventAttendees
      .mockRejectedValueOnce(new GoogleApiError(412, "conflict"))
      .mockImplementationOnce(async (_c, id, _e, attendees) => ({ ...fresh, id, attendees }));

    const outcome = await applyRsvp({ eventId: "e1", choice: "accepted", scope: "single", member });

    expect(google.patchEventAttendees).toHaveBeenCalledTimes(2);
    expect(google.patchEventAttendees.mock.calls[0][2]).toBe('"1"');
    expect(google.patchEventAttendees.mock.calls[1][2]).toBe('"2"');
    // The other member's RSVP survives the retry.
    expect(google.patchEventAttendees.mock.calls[1][3]).toEqual([
      { email: "other@x.com", responseStatus: "accepted" },
      { email: "me@gmail.com", displayName: "Me", responseStatus: "accepted" },
    ]);
    expect(outcome.applied).toEqual(["e1"]);
    expect(store.saveFingerprint).toHaveBeenCalledWith("e1", "me@gmail.com", expect.any(String));
  });

  it("gives up after 3 conflicts", async () => {
    google.getCalendarEvent.mockResolvedValue(event("e1", "2030-01-01T10:00:00Z"));
    google.patchEventAttendees.mockRejectedValue(new GoogleApiError(412, "conflict"));
    await expect(
      applyRsvp({ eventId: "e1", choice: "accepted", scope: "single", member }),
    ).rejects.toThrow();
    expect(google.patchEventAttendees).toHaveBeenCalledTimes(3);
  });

  it("refuses events organized elsewhere", async () => {
    google.getCalendarEvent.mockResolvedValue({
      ...event("e1", "2030-01-01T10:00:00Z"),
      organizer: { email: "someone@gmail.com" },
    });
    await expect(
      applyRsvp({ eventId: "e1", choice: "accepted", scope: "single", member }),
    ).rejects.toBeInstanceOf(RsvpNotAllowedError);
  });

  it("applies 'this and following' to later instances and reports partial failures (R5.7)", async () => {
    const selected = event("s_1", "2030-01-08T10:00:00Z");
    google.getCalendarEvent.mockResolvedValue(selected);
    google.listEventInstances.mockResolvedValue([
      event("s_0", "2030-01-01T10:00:00Z"),
      selected,
      event("s_2", "2030-01-15T10:00:00Z"),
      event("s_3", "2030-01-22T10:00:00Z"),
    ]);
    google.patchEventAttendees.mockImplementation(async (_c, id, _e, attendees) => {
      if (id === "s_2") throw new GoogleApiError(500, "boom");
      return { ...event(id, "2030-01-22T10:00:00Z"), attendees };
    });

    const outcome = await applyRsvp({
      eventId: "s_1",
      choice: "tentative",
      scope: "following",
      member,
    });

    const [, , timeMin, timeMax] = google.listEventInstances.mock.calls[0];
    expect(timeMin).toBe("2030-01-08T10:00:00.000Z");
    expect(new Date(timeMax).getUTCFullYear()).toBe(2031);
    expect(outcome.applied).toEqual(["s_1", "s_3"]);
    expect(outcome.failed).toEqual([{ id: "s_2", start: "2030-01-15T10:00:00Z" }]);
    expect(outcome.appliedThrough).toBe("2030-01-22T10:00:00Z");
    expect(google.patchEventAttendees.mock.calls.every((c) => c[1] !== "s_0")).toBe(true);
  });

  it("records a late change when a Yes becomes No near the start (R7.4)", async () => {
    const soon = new Date(Date.now() + 30 * 60_000).toISOString();
    const current = event("e1", soon, [{ email: "me@gmail.com", responseStatus: "accepted" }]);
    google.getCalendarEvent.mockResolvedValue(current);
    google.patchEventAttendees.mockImplementation(async (_c, id, _e, attendees) => ({
      ...current,
      id,
      attendees,
    }));

    await applyRsvp({ eventId: "e1", choice: "declined", scope: "single", member });

    const records = store.appendLateChanges.mock.calls[0][0];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      memberEmail: "me@gmail.com",
      previousStatus: "accepted",
      newStatus: "declined",
      source: "site",
    });
    expect(store.writeSnapshots).toHaveBeenCalledWith([
      { eventId: "e1", email: "me@gmail.com", status: "declined" },
    ]);
  });

  it("does not record early changes, and removing deletes the fingerprint", async () => {
    const later = new Date(Date.now() + 5 * 60 * 60_000).toISOString();
    const current = event("e1", later, [{ email: "me@gmail.com", responseStatus: "accepted" }]);
    google.getCalendarEvent.mockResolvedValue(current);
    google.patchEventAttendees.mockImplementation(async (_c, id, _e, attendees) => ({
      ...current,
      id,
      attendees,
    }));

    await applyRsvp({ eventId: "e1", choice: "remove", scope: "single", member });

    expect(store.appendLateChanges).toHaveBeenCalledWith([]);
    expect(store.deleteFingerprint).toHaveBeenCalledWith("e1", "me@gmail.com");
    expect(google.patchEventAttendees.mock.calls[0][3]).toEqual([]);
  });
});
