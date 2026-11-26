import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* --- In-memory Redis with NX and expiry ----------------------------------- */

const db = vi.hoisted(() => new Map<string, string>());
const fakeRedis = vi.hoisted(() => ({
  get: async (key: string) => db.get(key) ?? null,
  mget: async (...keys: string[]) => keys.map((k) => db.get(k) ?? null),
  set: async (key: string, value: string, opts?: { nx?: boolean }) => {
    if (opts?.nx && db.has(key)) return null;
    db.set(key, value);
    return "OK";
  },
  del: async (key: string) => (db.delete(key) ? 1 : 0),
  // Hash fields stored as "hash:field".
  hsetnx: async (key: string, field: string, value: string) => {
    if (db.has(`${key}:${field}`)) return 0;
    db.set(`${key}:${field}`, value);
    return 1;
  },
}));
vi.mock("../src/lib/member-calendar/server/store", () => ({ getRedis: () => fakeRedis }));

vi.mock("../src/lib/member-calendar/server/env", () => ({
  memberEnv: {
    discordEnabled: () => true,
    discordClientId: () => "999",
    discordGuildId: () => "111",
    discordEventsChannelId: () => "222",
    calendarId: () => "cal@group.calendar.google.com",
    groupAddresses: () => ["members@example.com"],
    siteOrigin: () => "https://ghostbustersva.com",
  },
}));

const discord = vi.hoisted(() => ({
  postMessage: vi.fn(),
  editMessage: vi.fn(),
  getMessages: vi.fn(),
  renameThread: vi.fn(),
}));
const DiscordApiError = vi.hoisted(
  () =>
    class DiscordApiError extends Error {
      constructor(
        public status: number,
        public code: number,
      ) {
        super(`discord ${status} ${code}`);
      }
    },
);
vi.mock("../src/lib/member-calendar/server/discord", () => ({
  ...discord,
  DiscordApiError,
  DiscordErrorCode: { UnknownChannel: 10003, UnknownMessage: 10008, ThreadArchived: 50083 },
  isDiscordError: (e: unknown, code: number) => e instanceof DiscordApiError && e.code === code,
  channelUrl: (g: string, c: string) => `https://discord.com/channels/${g}/${c}`,
}));

const google = vi.hoisted(() => ({
  getCalendarEvent: vi.fn(),
  listEventInstances: vi.fn(),
  patchEventPrivateProperties: vi.fn(),
}));
vi.mock("../src/lib/member-calendar/server/google-api", () => ({
  ...google,
  GoogleApiError: class extends Error {},
}));

import type { GoogleAttendee, GoogleEvent } from "../src/lib/member-calendar/server/google-api";
import {
  CANCELLED_NOTICE,
  changeNotice,
  decodeSignature,
  encodeSignature,
  eventSignature,
  renderSummary,
} from "../src/lib/member-calendar/server/discord-summary";
import {
  announceChanges,
  EDIT_SPACING_MS,
  loadSummaryInput,
  refreshThreadNow,
  requestThreadRefresh,
} from "../src/lib/member-calendar/server/discord-refresh";
import { getThreadRecord } from "../src/lib/member-calendar/server/discord-threads";
import { rsvpCounts } from "../src/lib/member-calendar/server/logic";

const NOW = Date.parse("2026-12-01T12:00:00-05:00");

// Pin the clock: the fixtures are December 2026 events (fake timers in some tests reset it).
beforeEach(() => vi.setSystemTime(NOW));
afterEach(() => vi.useRealTimers());
const CAL = "cal@group.calendar.google.com";

const people = (statuses: string[]): GoogleAttendee[] =>
  statuses.map((responseStatus, i) => ({ email: `p${i}@example.com`, responseStatus }));

const oneOff: GoogleEvent = {
  id: "evt1",
  summary: "NoVA - Ghost Hunt",
  location: "Cape Henry Lighthouse",
  start: { dateTime: "2026-12-06T19:00:00-05:00" },
  end: { dateTime: "2026-12-06T21:00:00-05:00" },
};
const master: GoogleEvent = {
  id: "series1",
  summary: "RVA - Weekly Meeting",
  recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=TU"],
  start: { dateTime: "2026-11-03T19:00:00-05:00" },
  end: { dateTime: "2026-11-03T20:00:00-05:00" },
};
const instanceOn = (day: string, attendees: GoogleAttendee[] = []): GoogleEvent => ({
  id: `series1_${day.replace(/-/g, "")}T000000Z`,
  recurringEventId: "series1",
  summary: "RVA - Weekly Meeting",
  start: { dateTime: `${day}T19:00:00-05:00` },
  end: { dateTime: `${day}T20:00:00-05:00` },
  attendees,
});
const zero = { yes: 0, maybe: 0, no: 0 };

/* --- Counts (R1.4) ---------------------------------------------------------- */

describe("rsvpCounts", () => {
  it("counts Yes, Maybe and No, skipping groups, rooms, the calendar and non-responses", () => {
    const event: GoogleEvent = {
      id: "e",
      attendees: [
        ...people(["accepted", "accepted", "tentative", "declined", "needsAction"]),
        { email: "members@example.com", responseStatus: "accepted" },
        { email: CAL, responseStatus: "accepted" },
        { email: "room@resource.calendar.google.com", resource: true, responseStatus: "accepted" },
      ],
    };
    expect(rsvpCounts(event, CAL, ["members@example.com"])).toEqual({ yes: 2, maybe: 1, no: 1 });
  });
});

/* --- Rendering (R1) --------------------------------------------------------- */

describe("renderSummary", () => {
  it("renders a one-off with title, time, place, link and counts", () => {
    const { content } = renderSummary(
      { kind: "one-off", event: oneOff, counts: { yes: 6, maybe: 2, no: 3 } },
      NOW,
    );
    const lines = content.split("\n");
    expect(lines[0]).toBe("**NoVA - Ghost Hunt**");
    expect(content).toContain("📅 Sun, Dec 6, 2026");
    expect(content).toContain("📍 Cape Henry Lighthouse");
    expect(content).toContain("🔗 https://ghostbustersva.com/members/calendar?event=evt1");
    expect(content).toContain("**RSVPs:** ✅ 6 going · ❔ 2 maybe");
    expect(content).not.toMatch(/\b3\b.*no|declined/i);
    expect(lines.at(-1)).toMatch(/^_Updated Tue, Dec 1, 12:00 PM EST_$/);
  });

  it("leaves out a zero Maybe, and says when nobody has answered", () => {
    const yesOnly = renderSummary(
      { kind: "one-off", event: oneOff, counts: { yes: 1, maybe: 0, no: 0 } },
      NOW,
    );
    expect(yesOnly.content).toContain("**RSVPs:** ✅ 1 going\n");
    const none = renderSummary({ kind: "one-off", event: oneOff, counts: zero }, NOW);
    expect(none.content).toContain("**RSVPs:** none yet");
  });

  it("says a past one-off has ended", () => {
    const { content } = renderSummary({ kind: "one-off", event: oneOff, counts: zero }, NOW + 9e9);
    expect(content).toContain("This event has ended.");
    expect(content).not.toContain("RSVPs");
  });

  it("strikes out a cancelled event and drops the counts", () => {
    const { content } = renderSummary(
      { kind: "one-off", event: oneOff, counts: { yes: 4, maybe: 0, no: 0 }, cancelled: true },
      NOW,
    );
    expect(content.split("\n")[0]).toBe("~~**NoVA - Ghost Hunt**~~");
    expect(content).toContain("❌ **Cancelled**");
    expect(content).not.toContain("going");
  });

  it("renders up to three series rows and links the next date", () => {
    const upcoming = ["2026-12-01", "2026-12-08", "2026-12-15", "2026-12-22"].map((day, i) => ({
      event: instanceOn(day),
      counts: [
        { yes: 4, maybe: 1, no: 0 },
        { yes: 2, maybe: 0, no: 1 },
        zero,
        { yes: 9, maybe: 0, no: 0 },
      ][i],
    }));
    const { content } = renderSummary({ kind: "series", master, upcoming }, NOW);
    expect(content).toContain("**RVA - Weekly Meeting**\n🔁 Recurring event");
    expect(content).toContain("**RSVPs**\nTue, Dec 1 · ✅ 4 · ❔ 1\nTue, Dec 8 · ✅ 2\n");
    expect(content).toContain("Tue, Dec 15 · no RSVPs yet");
    expect(content).not.toContain("Dec 22");
    expect(content).toContain("event=series1_20261201T000000Z");
  });

  it("says when a series has no upcoming dates", () => {
    const { content } = renderSummary({ kind: "series", master, upcoming: [] }, NOW);
    expect(content).toContain("No upcoming dates.");
    expect(content).toContain("event=series1");
  });

  it("keeps the hash the same when only the time of the update changes", () => {
    const input = { kind: "one-off" as const, event: oneOff, counts: zero };
    const a = renderSummary(input, NOW);
    const b = renderSummary(input, NOW + 60_000);
    expect(a.content).not.toBe(b.content);
    expect(a.hash).toBe(b.hash);
    expect(renderSummary({ ...input, counts: { yes: 1, maybe: 0, no: 0 } }, NOW).hash).not.toBe(
      a.hash,
    );
  });

  it("stays within 2,000 characters, dropping the location first", () => {
    const long = { ...oneOff, location: "x".repeat(1990) };
    const { content } = renderSummary({ kind: "one-off", event: long, counts: zero }, NOW);
    expect(content.length).toBeLessThanOrEqual(2000);
    expect(content).not.toContain("📍");
    expect(content).toContain("**RSVPs:**");
  });

  it("cuts a title that's too long on its own", () => {
    const long = { ...oneOff, summary: "y".repeat(2500) };
    const { content } = renderSummary({ kind: "one-off", event: long, counts: zero }, NOW);
    expect(content.length).toBeLessThanOrEqual(2000);
    expect(content).toMatch(/_Updated .*_$/);
  });
});

/* --- Loading from Google (R3.6) ---------------------------------------------- */

describe("loadSummaryInput", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads a one-off with its counts, asking for cancelled events too", async () => {
    google.getCalendarEvent.mockResolvedValue({
      ...oneOff,
      attendees: people(["accepted", "tentative"]),
    });
    const input = await loadSummaryInput("evt1", NOW);
    expect(input).toMatchObject({
      kind: "one-off",
      counts: { yes: 1, maybe: 1 },
      cancelled: false,
    });
    expect(google.getCalendarEvent).toHaveBeenCalledWith(CAL, "evt1", { includeCancelled: true });
    expect(google.listEventInstances).not.toHaveBeenCalled();
  });

  it("reads a series' next three instances, soonest first", async () => {
    google.getCalendarEvent.mockResolvedValue(master);
    google.listEventInstances.mockResolvedValue([
      instanceOn("2026-12-15"),
      instanceOn("2026-12-01", people(["accepted"])),
      instanceOn("2026-12-22"),
      instanceOn("2026-12-08"),
    ]);
    const input = await loadSummaryInput("series1", NOW);
    expect(input?.kind).toBe("series");
    if (input?.kind !== "series") return;
    expect(input.upcoming.map((o) => o.event.start?.dateTime?.slice(0, 10))).toEqual([
      "2026-12-01",
      "2026-12-08",
      "2026-12-15",
    ]);
    expect(input.upcoming[0].counts.yes).toBe(1);
    expect(google.listEventInstances.mock.calls[0][2]).toBe(new Date(NOW).toISOString());
  });

  it("marks a cancelled series without reading instances", async () => {
    google.getCalendarEvent.mockResolvedValue({ ...master, status: "cancelled" });
    expect(await loadSummaryInput("series1", NOW)).toMatchObject({
      kind: "series",
      cancelled: true,
    });
    expect(google.listEventInstances).not.toHaveBeenCalled();
  });

  it("returns null when Google has no such event", async () => {
    google.getCalendarEvent.mockResolvedValue(null);
    expect(await loadSummaryInput("gone", NOW)).toBeNull();
  });
});

/* --- Refreshing (R3) ---------------------------------------------------------- */

const record = {
  threadId: "333",
  url: "https://discord.com/channels/111/333",
  createdAt: 1,
  messageId: "m1",
};
const seed = (extra: Record<string, unknown> = {}) =>
  db.set("discord-thread:evt1", JSON.stringify({ ...record, ...extra }));

describe("refreshThreadNow", () => {
  beforeEach(() => {
    db.clear();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    google.getCalendarEvent.mockResolvedValue({ ...oneOff, attendees: people(["accepted"]) });
    discord.editMessage.mockResolvedValue({ id: "m1", channel_id: "333" });
  });

  it("edits the starter message and stores the hash", async () => {
    seed();
    expect(await refreshThreadNow("evt1")).toBe("updated");
    expect(discord.editMessage).toHaveBeenCalledWith(
      "333",
      "m1",
      expect.stringContaining("**RSVPs:** ✅ 1 going"),
    );
    expect((await getThreadRecord("evt1"))?.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(db.has("discord-refresh-last:evt1")).toBe(true);
  });

  it("records the event for the sync, so a deletion before the next sync is noticed (R5.6)", async () => {
    seed();
    db.set("discord-sync-signatures:other", "kept");
    await refreshThreadNow("evt1");
    expect(JSON.parse(db.get("discord-sync-signatures:evt1")!)).toMatchObject({ k: "evt1" });
    // An entry the sync already has isn't overwritten.
    db.set("discord-sync-signatures:evt1", "old");
    db.delete("discord-refresh-last:evt1");
    await refreshThreadNow("evt1");
    expect(db.get("discord-sync-signatures:evt1")).toBe("old");
  });

  it("skips the edit when nothing changed (R3.4)", async () => {
    seed();
    await refreshThreadNow("evt1");
    db.delete("discord-refresh-last:evt1");
    expect(await refreshThreadNow("evt1")).toBe("unchanged");
    expect(discord.editMessage).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a thread", async () => {
    expect(await refreshThreadNow("evt1")).toBe("no-thread");
    expect(google.getCalendarEvent).not.toHaveBeenCalled();
  });

  it("leaves the message alone when the event can't be found", async () => {
    seed();
    google.getCalendarEvent.mockResolvedValue(null);
    expect(await refreshThreadNow("evt1")).toBe("failed");
    expect(discord.editMessage).not.toHaveBeenCalled();
  });

  it("finds a v1 thread's starter message before editing (R2.2)", async () => {
    db.set("discord-thread:evt1", JSON.stringify({ ...record, messageId: undefined }));
    discord.getMessages.mockResolvedValue([
      { id: "4000", channel_id: "333", author: { id: "999" } },
    ]);
    expect(await refreshThreadNow("evt1")).toBe("updated");
    expect(discord.postMessage).not.toHaveBeenCalled();
    expect(discord.editMessage).toHaveBeenCalledWith("333", "4000", expect.any(String));
  });

  it("doesn't reopen an archived thread, and tries again next time (D11)", async () => {
    seed();
    discord.editMessage.mockRejectedValueOnce(new DiscordApiError(400, 50083));
    expect(await refreshThreadNow("evt1")).toBe("archived");
    expect((await getThreadRecord("evt1"))?.contentHash).toBeUndefined();
    expect(await refreshThreadNow("evt1")).toBe("updated");
  });

  it("drops the record when the thread was deleted (R7.3)", async () => {
    seed();
    discord.editMessage.mockRejectedValueOnce(new DiscordApiError(404, 10003));
    expect(await refreshThreadNow("evt1")).toBe("no-thread");
    expect(await getThreadRecord("evt1")).toBeNull();
  });

  it("logs other failures without storing the hash", async () => {
    seed();
    discord.editMessage.mockRejectedValueOnce(new DiscordApiError(500, 0));
    expect(await refreshThreadNow("evt1")).toBe("failed");
    expect((await getThreadRecord("evt1"))?.contentHash).toBeUndefined();
  });

  it("waits out the spacing since the last edit (R3.3)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      seed();
      db.set("discord-refresh-last:evt1", String(Date.now()));
      const done = refreshThreadNow("evt1");
      await vi.advanceTimersByTimeAsync(EDIT_SPACING_MS - 500);
      expect(discord.editMessage).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(600);
      expect(await done).toBe("updated");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("requestThreadRefresh (R3.2)", () => {
  beforeEach(() => {
    db.clear();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    google.getCalendarEvent.mockResolvedValue({ ...oneOff, attendees: [] });
    discord.editMessage.mockResolvedValue({ id: "m1", channel_id: "333" });
  });

  it("refreshes and releases the lock", async () => {
    seed();
    expect(await requestThreadRefresh("evt1")).toBe("updated");
    expect(db.has("discord-refresh-lock:evt1")).toBe(false);
  });

  it("sets the dirty flag when another request holds the lock", async () => {
    seed();
    db.set("discord-refresh-lock:evt1", "someone-else");
    expect(await requestThreadRefresh("evt1")).toBe("queued");
    expect(db.get("discord-refresh-dirty:evt1")).toBe("1");
    expect(google.getCalendarEvent).not.toHaveBeenCalled();
  });

  it("merges a burst into at most two edits, ending on the latest counts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      seed();
      let going = 0;
      google.getCalendarEvent.mockImplementation(async () => ({
        ...oneOff,
        attendees: people(Array(going).fill("accepted")),
      }));

      let finishFirstEdit!: () => void;
      discord.editMessage.mockImplementationOnce(
        () => new Promise((resolve) => (finishFirstEdit = () => resolve({ id: "m1" }))),
      );

      going = 1;
      const first = requestThreadRefresh("evt1");
      await vi.advanceTimersByTimeAsync(0);
      expect(discord.editMessage).toHaveBeenCalledTimes(1);
      // Nine more RSVPs while the first edit holds the lock.
      const rest = [];
      for (let i = 2; i <= 10; i++) {
        going = i;
        rest.push(requestThreadRefresh("evt1"));
      }
      expect(await Promise.all(rest)).toEqual(Array(9).fill("queued"));
      finishFirstEdit();

      await vi.advanceTimersByTimeAsync(EDIT_SPACING_MS + 100);
      expect(await first).toBe("updated");
      expect(discord.editMessage).toHaveBeenCalledTimes(2);
      expect(discord.editMessage.mock.calls[1][2]).toContain("✅ 10 going");
      expect(db.has("discord-refresh-dirty:evt1")).toBe(false);
      expect(db.has("discord-refresh-lock:evt1")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("doesn't loop on a failure", async () => {
    seed();
    discord.editMessage.mockRejectedValue(new DiscordApiError(500, 0));
    db.set("discord-refresh-dirty:evt1", "1");
    expect(await requestThreadRefresh("evt1")).toBe("failed");
    expect(discord.editMessage).toHaveBeenCalledTimes(1);
    expect(db.has("discord-refresh-lock:evt1")).toBe(false);
  });
});

/* --- Change and cancellation posts (R5) ------------------------------------ */

describe("eventSignature and changeNotice (R5.1, R5.2)", () => {
  const one = (event: GoogleEvent) => eventSignature({ kind: "one-off", event, counts: zero });
  const series = (m: GoogleEvent) => eventSignature({ kind: "series", master: m, upcoming: [] });

  it("round-trips through the stored form", () => {
    const signature = one(oneOff);
    expect(decodeSignature(encodeSignature(signature))).toEqual(signature);
    expect(decodeSignature("nope")).toBeNull();
    expect(decodeSignature(undefined)).toBeNull();
  });

  it("uses a series master's time of day, not its date", () => {
    expect(series(master)).toMatchObject({ start: "19:00", end: "20:00" });
    const laterFirstDate = {
      ...master,
      start: { dateTime: "2026-12-01T19:00:00-05:00" },
      end: { dateTime: "2026-12-01T20:00:00-05:00" },
    };
    expect(changeNotice(series(master), series(laterFirstDate), "series")).toBeNull();
  });

  it("lists each change for a one-off", () => {
    const moved = {
      ...oneOff,
      summary: "NoVA - Ghost Hunt (rain date)",
      location: "",
      start: { dateTime: "2026-12-06T20:00:00-05:00" },
      end: { dateTime: "2026-12-06T22:00:00-05:00" },
    };
    const notice = changeNotice(one(oneOff), one(moved), "one-off")!;
    expect(notice.split("\n")).toEqual([
      "📣 **This event changed**",
      "✏️ Renamed: NoVA - Ghost Hunt → NoVA - Ghost Hunt (rain date)",
      "🕒 Time changed: Sun, Dec 6, 2026, 7:00 PM EST → Sun, Dec 6, 2026, 8:00 PM EST",
      "📍 Location changed: Cape Henry Lighthouse → none",
    ]);
  });

  it("says when only the end time moved", () => {
    const longer = { ...oneOff, end: { dateTime: "2026-12-06T23:00:00-05:00" } };
    expect(changeNotice(one(oneOff), one(longer), "one-off")).toContain(
      "🕒 End time changed: Sun, Dec 6, 2026, 7:00 PM EST",
    );
  });

  it("describes a series time change for all dates", () => {
    const later = {
      ...master,
      start: { dateTime: "2026-11-03T19:30:00-05:00" },
      end: { dateTime: "2026-11-03T21:00:00-05:00" },
    };
    expect(changeNotice(series(master), series(later), "series")).toBe(
      "📣 **This event changed for all dates**\n🕒 Time changed: 7:00 PM–8:00 PM → 7:30 PM–9:00 PM",
    );
  });

  it("returns null when nothing changed", () => {
    expect(changeNotice(one(oneOff), one({ ...oneOff }), "one-off")).toBeNull();
  });
});

describe("announceChanges (R5)", () => {
  const base = { threadId: "333", url: "u", createdAt: 1, messageId: "m1" };
  const input = (event: GoogleEvent, cancelled = false) => ({
    kind: "one-off" as const,
    event,
    counts: zero,
    cancelled,
  });
  const stored = (event: GoogleEvent) =>
    encodeSignature(eventSignature({ kind: "one-off", event, counts: zero }));

  beforeEach(() => {
    db.clear();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    discord.postMessage.mockResolvedValue({ id: "n1", channel_id: "333" });
    discord.renameThread.mockResolvedValue({ id: "333", type: 11 });
  });

  it("only records the signature the first time", async () => {
    seed();
    const next = await announceChanges("evt1", base, input(oneOff));
    expect(discord.postMessage).not.toHaveBeenCalled();
    expect(next.eventSignature).toBe(stored(oneOff));
    expect((await getThreadRecord("evt1"))?.eventSignature).toBe(stored(oneOff));
  });

  it("posts a notice and renames the thread for a new title", async () => {
    const record = { ...base, eventSignature: stored(oneOff) };
    seed({ eventSignature: stored(oneOff) });
    const renamed = { ...oneOff, summary: "NoVA - Lighthouse Hunt" };
    const next = await announceChanges("evt1", record, input(renamed));
    expect(discord.postMessage).toHaveBeenCalledWith(
      "333",
      expect.stringContaining("✏️ Renamed: NoVA - Ghost Hunt → NoVA - Lighthouse Hunt"),
    );
    expect(discord.renameThread).toHaveBeenCalledWith("333", "NoVA - Lighthouse Hunt");
    expect(next.eventSignature).toBe(stored(renamed));
  });

  it("doesn't rename for a time change", async () => {
    const record = { ...base, eventSignature: stored(oneOff) };
    seed({ eventSignature: stored(oneOff) });
    const moved = { ...oneOff, start: { dateTime: "2026-12-06T18:00:00-05:00" } };
    await announceChanges("evt1", record, input(moved));
    expect(discord.postMessage).toHaveBeenCalledTimes(1);
    expect(discord.renameThread).not.toHaveBeenCalled();
  });

  it("keeps the old signature when the post fails, so it's retried", async () => {
    const record = { ...base, eventSignature: stored(oneOff) };
    seed({ eventSignature: stored(oneOff) });
    discord.postMessage.mockRejectedValueOnce(new DiscordApiError(500, 0));
    const moved = { ...oneOff, location: "Elsewhere" };
    await expect(announceChanges("evt1", record, input(moved))).rejects.toBeInstanceOf(
      DiscordApiError,
    );
    expect((await getThreadRecord("evt1"))?.eventSignature).toBe(stored(oneOff));
  });

  it("still records the change when only the rename fails", async () => {
    const record = { ...base, eventSignature: stored(oneOff) };
    seed({ eventSignature: stored(oneOff) });
    discord.renameThread.mockRejectedValueOnce(new DiscordApiError(403, 50013));
    const renamed = { ...oneOff, summary: "New name" };
    expect((await announceChanges("evt1", record, input(renamed))).eventSignature).toBe(
      stored(renamed),
    );
  });

  it("posts the cancellation once (R5.3)", async () => {
    seed();
    const first = await announceChanges("evt1", base, input(oneOff, true));
    expect(discord.postMessage).toHaveBeenCalledWith("333", CANCELLED_NOTICE);
    expect(first.cancelledPosted).toBe(true);
    await announceChanges("evt1", first, input(oneOff, true));
    expect(discord.postMessage).toHaveBeenCalledTimes(1);
  });

  it("forgets the cancellation when the event comes back", async () => {
    const record = { ...base, eventSignature: stored(oneOff), cancelledPosted: true };
    seed({ eventSignature: stored(oneOff), cancelledPosted: true });
    const next = await announceChanges("evt1", record, input(oneOff));
    expect(next.cancelledPosted).toBeUndefined();
    expect(discord.postMessage).not.toHaveBeenCalled();
  });
});

describe("refreshThreadNow with event changes (R5)", () => {
  beforeEach(() => {
    db.clear();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    discord.postMessage.mockResolvedValue({ id: "n1", channel_id: "333" });
    discord.editMessage.mockResolvedValue({ id: "m1", channel_id: "333" });
  });

  it("posts for a series time change even though the summary text is the same", async () => {
    db.set("discord-thread:series1", JSON.stringify({ ...record, threadId: "333" }));
    google.listEventInstances.mockResolvedValue([instanceOn("2026-12-08")]);
    google.getCalendarEvent.mockResolvedValue(master);
    expect(await refreshThreadNow("series1")).toBe("updated");
    expect(discord.postMessage).not.toHaveBeenCalled();

    db.delete("discord-refresh-last:series1");
    google.getCalendarEvent.mockResolvedValue({
      ...master,
      start: { dateTime: "2026-11-03T18:00:00-05:00" },
    });
    expect(await refreshThreadNow("series1")).toBe("unchanged");
    expect(discord.postMessage).toHaveBeenCalledWith(
      "333",
      expect.stringContaining("🕒 Time changed: 7:00 PM–8:00 PM → 6:00 PM–8:00 PM"),
    );
  });

  it("posts the cancellation, then strikes out the summary", async () => {
    seed();
    google.getCalendarEvent.mockResolvedValue({ ...oneOff, status: "cancelled" });
    expect(await refreshThreadNow("evt1")).toBe("updated");
    expect(discord.postMessage).toHaveBeenCalledWith("333", CANCELLED_NOTICE);
    expect(discord.editMessage.mock.calls[0][2]).toContain("❌ **Cancelled**");
    expect(discord.postMessage.mock.invocationCallOrder[0]).toBeLessThan(
      discord.editMessage.mock.invocationCallOrder[0],
    );
  });
});
