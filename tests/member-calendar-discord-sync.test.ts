import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sets = vi.hoisted(() => new Map<string, Set<string>>());
const kv = vi.hoisted(() => new Map<string, string>());
const hashes = vi.hoisted(() => new Map<string, Map<string, string>>());
const fakeRedis = vi.hoisted(() => ({
  get: async (key: string) => kv.get(key) ?? null,
  mget: async (...keys: string[]) => keys.map((k) => kv.get(k) ?? null),
  hgetall: async (key: string) => {
    const hash = hashes.get(key);
    return hash && hash.size > 0 ? Object.fromEntries(hash) : null;
  },
  hset: async (key: string, values: Record<string, string>) => {
    if (!hashes.has(key)) hashes.set(key, new Map());
    Object.entries(values).forEach(([f, v]) => hashes.get(key)!.set(f, v));
    return Object.keys(values).length;
  },
  hsetnx: async (key: string, field: string, value: string) => {
    if (!hashes.has(key)) hashes.set(key, new Map());
    if (hashes.get(key)!.has(field)) return 0;
    hashes.get(key)!.set(field, value);
    return 1;
  },
  hdel: async (key: string, ...fields: string[]) => {
    fields.forEach((f) => hashes.get(key)?.delete(f));
    return fields.length;
  },
  sadd: async (key: string, ...members: string[]) => {
    if (!sets.has(key)) sets.set(key, new Set());
    members.forEach((m) => sets.get(key)!.add(m));
    return members.length;
  },
  srem: async (key: string, ...members: string[]) => {
    let removed = 0;
    members.forEach((m) => (sets.get(key)?.delete(m) ? removed++ : 0));
    return removed;
  },
  smembers: async (key: string) => [...(sets.get(key) ?? [])],
  expire: async () => 1,
}));
vi.mock("../src/lib/member-calendar/server/store", () => ({ getRedis: () => fakeRedis }));

const enabled = vi.hoisted(() => ({ value: true }));
vi.mock("../src/lib/member-calendar/server/env", () => ({
  memberEnv: {
    discordEnabled: () => enabled.value,
    calendarId: () => "cal@group.calendar.google.com",
  },
}));

const effects = vi.hoisted(() => ({
  requestThreadRefresh: vi.fn(),
  joinSeriesThread: vi.fn(),
  leaveSeriesThread: vi.fn(),
  getCalendarEvent: vi.fn(),
  waitUntil: vi.fn(),
}));
vi.mock("../src/lib/member-calendar/server/discord-refresh", () => ({
  requestThreadRefresh: effects.requestThreadRefresh,
}));
vi.mock("../src/lib/member-calendar/server/discord-rsvp", () => ({
  joinSeriesThread: effects.joinSeriesThread,
  leaveSeriesThread: effects.leaveSeriesThread,
}));
vi.mock("../src/lib/member-calendar/server/google-api", () => ({
  getCalendarEvent: effects.getCalendarEvent,
}));
vi.mock("@vercel/functions", () => ({ waitUntil: effects.waitUntil }));

import type { GoogleEvent } from "../src/lib/member-calendar/server/google-api";
import {
  eventChangeJobs,
  jobsForEvent,
  processDiscordSyncQueue,
  queueDiscordSyncJobs,
  scheduleDiscordSync,
  type DiscordSyncJob,
} from "../src/lib/member-calendar/server/discord-sync";
import { watchEvents } from "../src/lib/member-calendar/server/discord-watch";

const CAL = "cal@group.calendar.google.com";
const NOW = Date.parse("2026-12-01T12:00:00-05:00");

// Pin the clock: the fixtures are December 2026 events (fake timers in some tests reset it).
beforeEach(() => vi.setSystemTime(NOW));
afterEach(() => vi.useRealTimers());

const upcoming: GoogleEvent = {
  id: "series1_20261208",
  recurringEventId: "series1",
  organizer: { email: CAL },
  start: { dateTime: "2026-12-08T19:00:00-05:00" },
  end: { dateTime: "2026-12-08T20:00:00-05:00" },
};
const jobs = (
  updates: { email: string; status: string }[],
  previous: Record<string, string> = {},
  event = upcoming,
) =>
  jobsForEvent({
    event,
    calendarId: CAL,
    previous: new Map(Object.entries(previous)) as never,
    updates: updates as never,
    nowMs: NOW,
  });

describe("jobsForEvent (R6.1, R3.1)", () => {
  it("joins someone who said Yes or Maybe in Google, then refreshes", () => {
    expect(
      jobs(
        [
          { email: "A@Example.com", status: "accepted" },
          { email: "b@example.com", status: "tentative" },
        ],
        { "b@example.com": "declined" },
      ),
    ).toEqual([
      { kind: "join", seriesKey: "series1", eventId: "series1_20261208", email: "a@example.com" },
      { kind: "join", seriesKey: "series1", eventId: "series1_20261208", email: "b@example.com" },
      { kind: "refresh", seriesKey: "series1" },
    ]);
  });

  it("only refreshes for a switch between Yes and Maybe, or a No", () => {
    expect(
      jobs(
        [
          { email: "a@example.com", status: "tentative" },
          { email: "b@example.com", status: "declined" },
        ],
        { "a@example.com": "accepted", "b@example.com": "accepted" },
      ),
    ).toEqual([{ kind: "refresh", seriesKey: "series1" }]);
  });

  it("leaves for a removal, whatever the earlier answer (R6.2)", () => {
    expect(
      jobs(
        [
          { email: "C@example.com", status: "removed" },
          { email: "d@example.com", status: "removed" },
        ],
        { "C@example.com": "accepted", "d@example.com": "declined" },
      ),
    ).toEqual([
      { kind: "leave", seriesKey: "series1", email: "c@example.com" },
      { kind: "leave", seriesKey: "series1", email: "d@example.com" },
      { kind: "refresh", seriesKey: "series1" },
    ]);
  });

  it("does nothing without changes, or for an event that has ended", () => {
    expect(jobs([])).toEqual([]);
    const past = { ...upcoming, end: { dateTime: "2026-11-01T20:00:00-05:00" } };
    expect(jobs([{ email: "a@example.com", status: "accepted" }], {}, past)).toEqual([]);
  });

  it("refreshes but doesn't join on an event the site can't RSVP to", () => {
    const personal = { ...upcoming, organizer: { email: "someone@gmail.com" } };
    expect(jobs([{ email: "a@example.com", status: "accepted" }], {}, personal)).toEqual([
      { kind: "refresh", seriesKey: "series1" },
    ]);
  });

  it("keys a one-off by its own ID", () => {
    const oneOff = { ...upcoming, id: "evt1", recurringEventId: undefined };
    expect(jobs([{ email: "a@example.com", status: "declined" }])).toHaveLength(1);
    expect(jobs([{ email: "a@example.com", status: "declined" }], {}, oneOff)).toEqual([
      { kind: "refresh", seriesKey: "evt1" },
    ]);
  });
});

const join = (key: string, email: string, eventId = `${key}_1`): DiscordSyncJob => ({
  kind: "join",
  seriesKey: key,
  eventId,
  email,
});
const refresh = (key: string): DiscordSyncJob => ({ kind: "refresh", seriesKey: key });
const queued = () => [...(sets.get("discord-sync-jobs") ?? [])];

describe("processDiscordSyncQueue (R6.3)", () => {
  beforeEach(() => {
    sets.clear();
    enabled.value = true;
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    effects.getCalendarEvent.mockImplementation(async (_cal: string, id: string) => ({
      id,
      attendees: [{ email: "a@example.com", responseStatus: "accepted" }],
    }));
  });

  it("joins, then refreshes once per series, and empties the queue", async () => {
    await queueDiscordSyncJobs([join("s1", "a@example.com"), refresh("s1"), refresh("s1")]);
    expect(queued()).toHaveLength(2);

    expect(await processDiscordSyncQueue()).toBe(1);
    expect(effects.joinSeriesThread).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1_1" }),
      "a@example.com",
    );
    expect(effects.requestThreadRefresh).toHaveBeenCalledTimes(1);
    expect(effects.requestThreadRefresh).toHaveBeenCalledWith("s1");
    expect(queued()).toEqual([]);
  });

  it("runs leaves before joins, then refreshes", async () => {
    const order: string[] = [];
    effects.leaveSeriesThread.mockImplementation(async () => order.push("leave"));
    effects.joinSeriesThread.mockImplementation(async () => order.push("join"));
    effects.requestThreadRefresh.mockImplementation(async () => order.push("refresh"));
    await queueDiscordSyncJobs([
      join("s1", "a@example.com"),
      { kind: "leave", seriesKey: "s1", email: "b@example.com" },
      refresh("s1"),
    ]);
    await processDiscordSyncQueue();
    expect(order).toEqual(["leave", "join", "refresh"]);
    expect(effects.leaveSeriesThread).toHaveBeenCalledWith("s1", "b@example.com");
  });

  it("skips a join when the member has since changed their answer", async () => {
    effects.getCalendarEvent.mockResolvedValue({
      id: "s1_1",
      attendees: [{ email: "a@example.com", responseStatus: "declined" }],
    });
    await queueDiscordSyncJobs([join("s1", "a@example.com"), refresh("s1")]);
    await processDiscordSyncQueue();
    expect(effects.joinSeriesThread).not.toHaveBeenCalled();
    expect(effects.requestThreadRefresh).toHaveBeenCalledWith("s1");
  });

  it("handles at most the limit and keeps the rest for the next run", async () => {
    await queueDiscordSyncJobs(["s1", "s2", "s3"].map(refresh));
    expect(await processDiscordSyncQueue(2)).toBe(2);
    expect(queued()).toHaveLength(1);
    expect(await processDiscordSyncQueue(2)).toBe(1);
    expect(queued()).toEqual([]);
    expect(effects.requestThreadRefresh).toHaveBeenCalledTimes(3);
  });

  it("keeps going after a failed join, and drops unreadable entries", async () => {
    effects.joinSeriesThread.mockRejectedValueOnce(new Error("discord down"));
    sets.set("discord-sync-jobs", new Set(["not json", '{"t":"what"}']));
    await queueDiscordSyncJobs([join("s1", "a@example.com"), refresh("s2")]);
    expect(await processDiscordSyncQueue()).toBe(2);
    expect(effects.requestThreadRefresh).toHaveBeenCalledWith("s1");
    expect(effects.requestThreadRefresh).toHaveBeenCalledWith("s2");
    expect(queued()).toEqual([]);
  });

  it("does nothing when the integration is off", async () => {
    await queueDiscordSyncJobs([refresh("s1")]);
    enabled.value = false;
    expect(await processDiscordSyncQueue()).toBe(0);
    expect(queued()).toHaveLength(1);
  });
});

describe("scheduleDiscordSync", () => {
  beforeEach(() => {
    sets.clear();
    enabled.value = true;
    vi.clearAllMocks();
  });

  it("queues and processes after the response", async () => {
    scheduleDiscordSync([refresh("s1")]);
    expect(effects.waitUntil).toHaveBeenCalledTimes(1);
    await effects.waitUntil.mock.calls[0][0];
    expect(effects.requestThreadRefresh).toHaveBeenCalledWith("s1");
  });

  it("still works through leftovers when this run found nothing new", async () => {
    await queueDiscordSyncJobs([refresh("s9")]);
    scheduleDiscordSync([]);
    await effects.waitUntil.mock.calls[0][0];
    expect(effects.requestThreadRefresh).toHaveBeenCalledWith("s9");
  });

  it("is skipped when the integration is off", () => {
    enabled.value = false;
    scheduleDiscordSync([refresh("s1")]);
    expect(effects.waitUntil).not.toHaveBeenCalled();
  });
});

describe("eventChangeJobs (R3.1, R5)", () => {
  const thread = (key: string) =>
    kv.set(`discord-thread:${key}`, JSON.stringify({ threadId: "t", url: "u", createdAt: 1 }));
  const later = { ...upcoming, id: "series1_20261215" };
  const other: GoogleEvent = { ...upcoming, id: "evt9", recurringEventId: undefined };

  beforeEach(() => {
    kv.clear();
    hashes.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("records events with a thread the first time, without a refresh", async () => {
    thread("series1");
    expect(await eventChangeJobs([upcoming, later, other], NOW)).toEqual([]);
    expect([...(hashes.get("discord-sync-signatures")?.keys() ?? [])].sort()).toEqual([
      "series1_20261208",
      "series1_20261215",
    ]);
  });

  it("refreshes a series once when its events' title, time or place change", async () => {
    thread("series1");
    await eventChangeJobs([upcoming, later], NOW);
    const moved = [
      { ...upcoming, location: "New hall" },
      { ...later, location: "New hall" },
    ];
    expect(await eventChangeJobs(moved, NOW)).toEqual([{ kind: "refresh", seriesKey: "series1" }]);
    expect(await eventChangeJobs(moved, NOW)).toEqual([]);
  });

  it("ignores attendee-only changes", async () => {
    thread("series1");
    await eventChangeJobs([upcoming], NOW);
    const answered = {
      ...upcoming,
      attendees: [{ email: "a@example.com", responseStatus: "accepted" }],
    };
    expect(await eventChangeJobs([answered], NOW)).toEqual([]);
  });

  it("refreshes when an event drops out of the listing, then forgets it", async () => {
    thread("evt9");
    await eventChangeJobs([other], NOW);
    expect(await eventChangeJobs([], NOW)).toEqual([{ kind: "refresh", seriesKey: "evt9" }]);
    expect(hashes.get("discord-sync-signatures")?.size ?? 0).toBe(0);
    expect(await eventChangeJobs([], NOW)).toEqual([]);
  });

  it("refreshes an event deleted before any sync saw its thread (R5.6)", async () => {
    // The first RSVP made the thread, and its refresh recorded the event.
    await eventChangeJobs([other], NOW);
    thread("evt9");
    await watchEvents("evt9", [other], NOW);
    expect(await eventChangeJobs([], NOW)).toEqual([{ kind: "refresh", seriesKey: "evt9" }]);
  });

  it("doesn't record events past the sync's window", async () => {
    const far = { ...other, start: { dateTime: "2027-06-01T19:00:00-04:00" } };
    await watchEvents("evt9", [far], NOW);
    expect(hashes.get("discord-sync-signatures")?.size ?? 0).toBe(0);
  });

  it("forgets an event that has ended, without a refresh", async () => {
    thread("evt9");
    await eventChangeJobs([other], NOW);
    expect(await eventChangeJobs([other], Date.parse("2027-01-01T00:00:00Z"))).toEqual([]);
    expect(hashes.get("discord-sync-signatures")?.size ?? 0).toBe(0);
  });

  it("is best effort", async () => {
    thread("evt9");
    fakeRedis.hgetall = (async () => {
      throw new Error("redis down");
    }) as never;
    try {
      expect(await eventChangeJobs([other], NOW)).toEqual([]);
    } finally {
      fakeRedis.hgetall = (async (key: string) => {
        const hash = hashes.get(key);
        return hash && hash.size > 0 ? Object.fromEntries(hash) : null;
      }) as never;
    }
  });
});

describe("scheduleDiscordSync with the listing", () => {
  beforeEach(() => {
    sets.clear();
    kv.clear();
    hashes.clear();
    enabled.value = true;
    vi.clearAllMocks();
  });

  it("queues refreshes for changed events", async () => {
    kv.set("discord-thread:series1", JSON.stringify({ threadId: "t", url: "u", createdAt: 1 }));
    await eventChangeJobs([upcoming]);
    scheduleDiscordSync([], [{ ...upcoming, summary: "Renamed" }]);
    await effects.waitUntil.mock.calls[0][0];
    expect(effects.requestThreadRefresh).toHaveBeenCalledWith("series1");
  });
});
