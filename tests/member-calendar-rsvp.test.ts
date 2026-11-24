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
import { inviteDecision } from "../src/lib/member-calendar/server/logic";
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

describe("inviteDecision (PRD 012, R2)", () => {
  const rows: [string, string, "all" | "none", string][] = [
    // Not on the event, or No → Yes or Maybe: invite.
    ["removed", "accepted", "all", "join"],
    ["removed", "tentative", "all", "join"],
    ["declined", "accepted", "all", "join"],
    ["declined", "tentative", "all", "join"],
    // Awaiting a response counts as not going.
    ["needsAction", "accepted", "all", "join"],
    // Yes or Maybe → removed: cancel.
    ["accepted", "removed", "all", "leave"],
    ["tentative", "removed", "all", "leave"],
    // Yes ↔ Maybe: already on their calendar.
    ["accepted", "tentative", "none", "switch"],
    ["tentative", "accepted", "none", "switch"],
    // Yes or Maybe → No: stays, shown as declined.
    ["accepted", "declined", "none", "decline"],
    ["tentative", "declined", "none", "decline"],
    // Not on the event → No.
    ["removed", "declined", "none", "decline-new"],
    // No → removed: may never have been invited.
    ["declined", "removed", "none", "remove-declined"],
    ["needsAction", "removed", "none", "remove-declined"],
    // No change.
    ["accepted", "accepted", "none", "unchanged"],
    ["removed", "removed", "none", "unchanged"],
  ];

  it.each(rows)("%s → %s sends %s (%s)", (previous, next, sendUpdates, row) => {
    expect(inviteDecision(previous as never, next as never)).toEqual({ sendUpdates, row });
  });
});

describe("applyRsvp invitations (PRD 012, R2, R6)", () => {
  const sendUpdatesOf = (call: unknown[]) => call[4];

  it("invites a member who joins a one-off event", async () => {
    google.getCalendarEvent.mockResolvedValue(event("e1", "2030-01-01T10:00:00Z"));
    await applyRsvp({ eventId: "e1", choice: "accepted", scope: "single", member });
    expect(sendUpdatesOf(google.patchEventAttendees.mock.calls[0])).toBe("all");
  });

  it("sends a cancellation when a Yes is removed", async () => {
    const current = event("e1", "2030-01-01T10:00:00Z", [
      { email: "me@gmail.com", responseStatus: "tentative" },
    ]);
    google.getCalendarEvent.mockResolvedValue(current);
    await applyRsvp({ eventId: "e1", choice: "remove", scope: "single", member });
    expect(sendUpdatesOf(google.patchEventAttendees.mock.calls[0])).toBe("all");
  });

  it("stays silent switching Yes to Maybe", async () => {
    google.getCalendarEvent.mockResolvedValue(
      event("e1", "2030-01-01T10:00:00Z", [{ email: "me@gmail.com", responseStatus: "accepted" }]),
    );
    await applyRsvp({ eventId: "e1", choice: "tentative", scope: "single", member });
    expect(sendUpdatesOf(google.patchEventAttendees.mock.calls[0])).toBe("none");
  });

  it("recomputes from the fresh event after a 412 (R2.3)", async () => {
    const first = event("e1", "2030-01-01T10:00:00Z", [], '"1"');
    // Meanwhile the member said Yes in Google, so this is now a switch.
    const fresh = event(
      "e1",
      "2030-01-01T10:00:00Z",
      [{ email: "me@gmail.com", responseStatus: "accepted" }],
      '"2"',
    );
    google.getCalendarEvent.mockResolvedValueOnce(first).mockResolvedValueOnce(fresh);
    google.patchEventAttendees
      .mockRejectedValueOnce(new GoogleApiError(412, "conflict"))
      .mockImplementationOnce(async (_c, id, _e, attendees) => ({ ...fresh, id, attendees }));

    await applyRsvp({ eventId: "e1", choice: "tentative", scope: "single", member });

    expect(sendUpdatesOf(google.patchEventAttendees.mock.calls[0])).toBe("all");
    expect(sendUpdatesOf(google.patchEventAttendees.mock.calls[1])).toBe("none");
  });

  it("saves the RSVP without an invitation when Google refuses to send one (R6.1)", async () => {
    google.getCalendarEvent.mockResolvedValue(event("e1", "2030-01-01T10:00:00Z"));
    google.patchEventAttendees.mockRejectedValueOnce(new GoogleApiError(403, "quotaExceeded"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await applyRsvp({ eventId: "e1", choice: "accepted", scope: "single", member });

    expect(google.patchEventAttendees.mock.calls.map(sendUpdatesOf)).toEqual(["all", "none"]);
    expect(outcome.applied).toEqual(["e1"]);
    // Logged with the event ID and row, never the member's email (R6.2).
    expect(error.mock.calls.flat().join(" ")).toContain("event=e1 row=join");
    expect(error.mock.calls.flat().join(" ")).not.toContain("me@gmail.com");
    error.mockRestore();
  });

  it("doesn't fall back for a silent patch that fails", async () => {
    google.getCalendarEvent.mockResolvedValue(
      event("e1", "2030-01-01T10:00:00Z", [{ email: "me@gmail.com", responseStatus: "accepted" }]),
    );
    google.patchEventAttendees.mockRejectedValueOnce(new GoogleApiError(403, "forbidden"));
    await expect(
      applyRsvp({ eventId: "e1", choice: "tentative", scope: "single", member }),
    ).rejects.toThrow();
    expect(google.patchEventAttendees).toHaveBeenCalledTimes(1);
  });
});

describe("'This and following' invitations (PRD 012, R3, option A)", () => {
  const sendUpdatesOf = (call: unknown[]) => call[4];
  const series = (attendeesFor: (id: string) => object[] = () => []) => {
    const ids = ["s_1", "s_2", "s_3", "s_4"];
    const instances = ids.map((id, i) =>
      event(id, `2030-01-${String(8 + i * 7).padStart(2, "0")}T10:00:00Z`, attendeesFor(id)),
    );
    google.getCalendarEvent.mockResolvedValue(instances[0]);
    google.listEventInstances.mockResolvedValue(instances);
  };
  const yes = [{ email: "me@gmail.com", responseStatus: "accepted" }];

  it("invites on the first instance only when joining", async () => {
    series();
    await applyRsvp({ eventId: "s_1", choice: "accepted", scope: "following", member });
    expect(google.patchEventAttendees.mock.calls.map(sendUpdatesOf)).toEqual([
      "all",
      "none",
      "none",
      "none",
    ]);
  });

  it("cancels on the first instance only when removing (R3.3)", async () => {
    series(() => yes);
    await applyRsvp({ eventId: "s_1", choice: "remove", scope: "following", member });
    expect(google.patchEventAttendees.mock.calls.map(sendUpdatesOf)).toEqual([
      "all",
      "none",
      "none",
      "none",
    ]);
  });

  it("invites on the first instance where R2 says to, not just the selected one", async () => {
    // Already Yes on the first two weeks; joining from the third.
    series((id) => (id === "s_1" || id === "s_2" ? yes : []));
    await applyRsvp({ eventId: "s_1", choice: "accepted", scope: "following", member });
    expect(google.patchEventAttendees.mock.calls.map(sendUpdatesOf)).toEqual([
      "none",
      "none",
      "all",
      "none",
    ]);
  });

  it("moves the invitation to the next instance when that patch fails", async () => {
    // Already Yes on s_0, so s_1 is the first that joins; its patch fails.
    const instances = [
      event("s_0", "2030-01-01T10:00:00Z", yes),
      event("s_1", "2030-01-08T10:00:00Z"),
      event("s_2", "2030-01-15T10:00:00Z"),
    ];
    google.getCalendarEvent.mockResolvedValue(instances[0]);
    google.listEventInstances.mockResolvedValue(instances);
    google.patchEventAttendees.mockImplementation(async (_c, id, _e, attendees) => {
      if (id === "s_1") throw new GoogleApiError(500, "boom");
      return { ...event(id, "2030-01-15T10:00:00Z"), attendees };
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await applyRsvp({
      eventId: "s_0",
      choice: "accepted",
      scope: "following",
      member,
    });

    expect(google.patchEventAttendees.mock.calls.map((c) => [c[1], sendUpdatesOf(c)])).toEqual([
      ["s_0", "none"],
      ["s_1", "all"],
      ["s_2", "all"],
    ]);
    expect(outcome.failed.map((f) => f.id)).toEqual(["s_1"]);
    error.mockRestore();
  });

  it("sends nothing across the series for a Yes → Maybe switch", async () => {
    series(() => yes);
    await applyRsvp({ eventId: "s_1", choice: "tentative", scope: "following", member });
    expect(google.patchEventAttendees.mock.calls.map(sendUpdatesOf)).toEqual([
      "none",
      "none",
      "none",
      "none",
    ]);
  });
});
