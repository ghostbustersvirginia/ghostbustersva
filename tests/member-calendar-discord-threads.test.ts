import { beforeEach, describe, expect, it, vi } from "vitest";

/* --- In-memory Redis ------------------------------------------------------ */

const db = vi.hoisted(() => new Map<string, string>());
const sets = vi.hoisted(() => new Map<string, Set<string>>());
const fakeRedis = vi.hoisted(() => ({
  sadd: async (key: string, member: string) => {
    if (!sets.has(key)) sets.set(key, new Set());
    sets.get(key)!.add(member);
    return 1;
  },
  srem: async (key: string, member: string) => (sets.get(key)?.delete(member) ? 1 : 0),
  smembers: async (key: string) => [...(sets.get(key) ?? [])],
  expire: async () => 1,
  get: async (key: string) => db.get(key) ?? null,
  mget: async (...keys: string[]) => keys.map((k) => db.get(k) ?? null),
  set: async (key: string, value: string, opts?: { nx?: boolean }) => {
    if (opts?.nx && db.has(key)) return null;
    db.set(key, value);
    return "OK";
  },
  del: async (key: string) => (db.delete(key) ? 1 : 0),
  multi: () => {
    const ops: (() => void)[] = [];
    const tx = {
      del: (key: string) => (ops.push(() => db.delete(key)), tx),
      set: (key: string, value: string) => (ops.push(() => db.set(key, value)), tx),
      exec: async () => ops.forEach((op) => op()),
    };
    return tx;
  },
}));
vi.mock("../src/lib/member-calendar/server/store", () => ({ getRedis: () => fakeRedis }));

const enabled = vi.hoisted(() => ({ value: true }));
vi.mock("../src/lib/member-calendar/server/env", () => ({
  memberEnv: {
    discordEnabled: () => enabled.value,
    discordGuildId: () => "111",
    discordEventsChannelId: () => "222",
    calendarId: () => "cal@group.calendar.google.com",
    siteOrigin: () => "https://ghostbustersva.com",
  },
}));

const discord = vi.hoisted(() => ({
  createPublicThread: vi.fn(),
  postMessage: vi.fn(),
  addThreadMember: vi.fn(),
  unarchiveThread: vi.fn(),
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
  DiscordErrorCode: {
    UnknownChannel: 10003,
    UnknownMember: 10007,
    UnknownUser: 10013,
    ThreadArchived: 50083,
  },
  isDiscordError: (e: unknown, code: number) => e instanceof DiscordApiError && e.code === code,
  channelUrl: (g: string, c: string) => `https://discord.com/channels/${g}/${c}`,
}));

const google = vi.hoisted(() => ({
  getCalendarEvent: vi.fn(),
  patchEventPrivateProperties: vi.fn(),
}));
vi.mock("../src/lib/member-calendar/server/google-api", () => {
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
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

import type { GoogleEvent } from "../src/lib/member-calendar/server/google-api";
import { GoogleApiError } from "../src/lib/member-calendar/server/google-api";
import {
  ensureEventThread,
  getThreadRecord,
  saveThreadUrlOnEvent,
  seriesKey,
  starterMessage,
} from "../src/lib/member-calendar/server/discord-threads";
import { runDiscordAfterRsvp } from "../src/lib/member-calendar/server/discord-rsvp";
import {
  addMemberToThread,
  backfillMemberThreads,
} from "../src/lib/member-calendar/server/discord-members";
import { getMemberSeries, saveDiscordLink } from "../src/lib/member-calendar/server/discord-store";
import { threadUrlFromEvent } from "../src/lib/member-calendar/server/logic";

const oneOff: GoogleEvent = {
  id: "evt1",
  summary: "NoVA - Zoo Boo",
  location: "Reston Zoo",
  start: { dateTime: "2026-10-24T14:00:00-04:00" },
  end: { dateTime: "2026-10-24T18:00:00-04:00" },
};
const instance: GoogleEvent = {
  id: "series1_20261101T140000Z",
  recurringEventId: "series1",
  summary: "RVA - Monthly Meeting",
  start: { dateTime: "2026-11-01T10:00:00-04:00" },
  end: { dateTime: "2026-11-01T11:00:00-04:00" },
};

beforeEach(() => {
  db.clear();
  sets.clear();
  enabled.value = true;
  vi.clearAllMocks();
  discord.createPublicThread.mockResolvedValue({ id: "333", type: 11 });
  discord.postMessage.mockResolvedValue({ id: "m1", channel_id: "333" });
  discord.addThreadMember.mockResolvedValue(undefined);
  discord.unarchiveThread.mockResolvedValue({ id: "333", type: 11 });
  google.getCalendarEvent.mockImplementation(async (_cal: string, id: string) => ({
    id,
    etag: '"e1"',
    summary: "x",
    extendedProperties: { private: { other: "keep" } },
  }));
  google.patchEventPrivateProperties.mockResolvedValue({ id: "x" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("seriesKey", () => {
  it("uses the series for instances and the event itself for one-offs", () => {
    expect(seriesKey(instance)).toBe("series1");
    expect(seriesKey(oneOff)).toBe("evt1");
  });
});

describe("starterMessage (R2.4)", () => {
  it("has title, date, location, and deep link for a one-off", () => {
    const message = starterMessage(oneOff);
    expect(message).toContain("**NoVA - Zoo Boo**");
    expect(message).toContain("Oct 24, 2026");
    expect(message).toContain("2:00");
    expect(message).toContain("📍 Reston Zoo");
    expect(message).toContain("https://ghostbustersva.com/members/calendar?event=evt1");
  });

  it("labels a series and deep-links the RSVP'd occurrence", () => {
    const message = starterMessage(instance);
    expect(message).toContain("Recurring event");
    expect(message).toContain("Nov 1, 2026");
    expect(message).toContain("event=series1_20261101T140000Z");
  });

  it("formats all-day events by calendar date", () => {
    const message = starterMessage({ id: "a", summary: "Parade", start: { date: "2026-12-05" } });
    expect(message).toContain("Sat, Dec 5, 2026");
  });
});

describe("ensureEventThread (R2)", () => {
  it("creates one thread, posts the starter, records it, and saves the URL", async () => {
    const record = await ensureEventThread(oneOff);

    expect(record).toMatchObject({ threadId: "333", url: "https://discord.com/channels/111/333" });
    expect(discord.createPublicThread).toHaveBeenCalledWith("222", "NoVA - Zoo Boo");
    expect(discord.postMessage).toHaveBeenCalledWith("333", expect.stringContaining("Zoo Boo"));
    expect(await getThreadRecord("evt1")).toMatchObject({ threadId: "333" });
    expect(db.has("discord-thread-lock:evt1")).toBe(false);
  });

  it("reuses an existing thread", async () => {
    await ensureEventThread(instance);
    await ensureEventThread({ ...instance, id: "series1_20261201T150000Z" });
    expect(discord.createPublicThread).toHaveBeenCalledTimes(1);
  });

  it("creates only one thread for simultaneous RSVPs", async () => {
    let finish!: () => void;
    discord.createPublicThread.mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve({ id: "333", type: 11 }))),
    );
    const first = ensureEventThread(oneOff);
    await vi.waitFor(() => expect(discord.createPublicThread).toHaveBeenCalled());
    const second = ensureEventThread(oneOff);
    finish();

    const [a, b] = await Promise.all([first, second]);
    expect(discord.createPublicThread).toHaveBeenCalledTimes(1);
    expect(a?.threadId).toBe("333");
    expect(b?.threadId).toBe("333");
  });

  it("gives up waiting when the lock holder never finishes", async () => {
    vi.useFakeTimers();
    db.set("discord-thread-lock:evt1", "someone-else");
    const done = ensureEventThread(oneOff);
    await vi.advanceTimersByTimeAsync(8_500);
    expect(await done).toBeNull();
    expect(discord.createPublicThread).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("writes nothing and releases the lock when creation fails (R2.5)", async () => {
    discord.createPublicThread.mockRejectedValueOnce(new Error("discord down"));
    expect(await ensureEventThread(oneOff)).toBeNull();
    expect(db.size).toBe(0);

    expect(await ensureEventThread(oneOff)).toMatchObject({ threadId: "333" });
  });

  it("keeps the thread if only the starter message fails", async () => {
    discord.postMessage.mockRejectedValueOnce(new Error("nope"));
    expect(await ensureEventThread(oneOff)).toMatchObject({ threadId: "333" });
    expect(await getThreadRecord("evt1")).not.toBeNull();
  });

  it("does nothing when the integration is off", async () => {
    enabled.value = false;
    expect(await ensureEventThread(oneOff)).toBeNull();
    expect(discord.createPublicThread).not.toHaveBeenCalled();
  });
});

describe("saveThreadUrlOnEvent (R3.1–R3.3)", () => {
  const url = "https://discord.com/channels/111/333";

  it("patches the series master with only merged private properties", async () => {
    await ensureEventThread(instance);
    expect(google.getCalendarEvent).toHaveBeenCalledWith(expect.any(String), "series1");
    expect(google.patchEventPrivateProperties).toHaveBeenCalledWith(
      expect.any(String),
      "series1",
      '"e1"',
      { other: "keep", discordThreadUrl: url },
    );
  });

  it("retries on an ETag conflict", async () => {
    google.patchEventPrivateProperties
      .mockRejectedValueOnce(new GoogleApiError(412, "conflict"))
      .mockResolvedValueOnce({ id: "evt1" });
    await saveThreadUrlOnEvent("evt1", url);
    expect(google.patchEventPrivateProperties).toHaveBeenCalledTimes(2);
  });

  it("skips the patch when the URL is already set", async () => {
    google.getCalendarEvent.mockResolvedValueOnce({
      id: "evt1",
      etag: '"e1"',
      extendedProperties: { private: { discordThreadUrl: url } },
    });
    await saveThreadUrlOnEvent("evt1", url);
    expect(google.patchEventPrivateProperties).not.toHaveBeenCalled();
  });

  it("logs and swallows other failures", async () => {
    google.patchEventPrivateProperties.mockRejectedValue(new GoogleApiError(403, "forbidden"));
    await expect(saveThreadUrlOnEvent("evt1", url)).resolves.toBeUndefined();
    expect(google.patchEventPrivateProperties).toHaveBeenCalledTimes(1);
  });
});

describe("threadUrlFromEvent (R3.4)", () => {
  it("only accepts Discord channel links", () => {
    const withUrl = (value: string): GoogleEvent => ({
      id: "e",
      extendedProperties: { private: { discordThreadUrl: value } },
    });
    expect(threadUrlFromEvent(withUrl("https://discord.com/channels/1/2"))).toBe(
      "https://discord.com/channels/1/2",
    );
    expect(threadUrlFromEvent(withUrl("javascript:alert(1)"))).toBeNull();
    expect(threadUrlFromEvent(withUrl("https://evil.example/channels/1/2"))).toBeNull();
    expect(threadUrlFromEvent({ id: "e" })).toBeNull();
  });
});

describe("runDiscordAfterRsvp (R4.1, R4.2)", () => {
  const email = "me@gmail.com";

  it("creates the thread and tracks the series for Yes and Maybe", async () => {
    await runDiscordAfterRsvp({ event: oneOff, choice: "tentative", email });
    expect(discord.createPublicThread).toHaveBeenCalledTimes(1);
    expect(await getMemberSeries(email)).toEqual(["evt1"]);
  });

  it("adds a linked member to the thread", async () => {
    await saveDiscordLink(email, { id: "d-1", username: "egon" });
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    expect(discord.addThreadMember).toHaveBeenCalledWith("333", "d-1");
  });

  it("makes a new thread when the old one was deleted in Discord", async () => {
    await saveDiscordLink(email, { id: "d-1", username: "egon" });
    db.set(
      "discord-thread:evt1",
      JSON.stringify({
        threadId: "old",
        url: "https://discord.com/channels/111/old",
        createdAt: 1,
      }),
    );
    discord.addThreadMember.mockRejectedValueOnce(new DiscordApiError(404, 10003));
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });

    expect(discord.createPublicThread).toHaveBeenCalledTimes(1);
    expect(discord.addThreadMember).toHaveBeenLastCalledWith("333", "d-1");
    expect((await getThreadRecord("evt1"))?.threadId).toBe("333");
  });

  it("tracks but doesn't add an unlinked member", async () => {
    await runDiscordAfterRsvp({ event: instance, choice: "accepted", email });
    expect(discord.addThreadMember).not.toHaveBeenCalled();
    expect(await getMemberSeries(email)).toEqual(["series1"]);
  });

  it("tracks the series even when the thread can't be made", async () => {
    discord.createPublicThread.mockRejectedValueOnce(new Error("discord down"));
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    expect(await getMemberSeries(email)).toEqual(["evt1"]);
  });

  it("does nothing on Discord for No or removal", async () => {
    await saveDiscordLink(email, { id: "d-1", username: "egon" });
    await runDiscordAfterRsvp({ event: oneOff, choice: "declined", email });
    await runDiscordAfterRsvp({ event: oneOff, choice: "remove", email });
    expect(discord.createPublicThread).not.toHaveBeenCalled();
    expect(discord.addThreadMember).not.toHaveBeenCalled();
  });

  it("keeps the series after a change to No", async () => {
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    await runDiscordAfterRsvp({ event: oneOff, choice: "declined", email });
    expect(await getMemberSeries(email)).toEqual(["evt1"]);
  });

  it("drops a one-off on removal but keeps a series", async () => {
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    await runDiscordAfterRsvp({ event: instance, choice: "accepted", email });
    await runDiscordAfterRsvp({ event: oneOff, choice: "remove", email });
    await runDiscordAfterRsvp({ event: instance, choice: "remove", email });
    expect(await getMemberSeries(email)).toEqual(["series1"]);
  });
});

describe("addMemberToThread (R4.4, R4.5)", () => {
  const thread = { threadId: "333", url: "u", createdAt: 0 };

  it("unarchives an archived thread and tries once more", async () => {
    discord.addThreadMember.mockRejectedValueOnce(new DiscordApiError(400, 50083));
    expect(await addMemberToThread("evt1", thread, "d-1")).toBe("added");
    expect(discord.unarchiveThread).toHaveBeenCalledWith("333");
    expect(discord.addThreadMember).toHaveBeenCalledTimes(2);
  });

  it("skips a user who isn't in the server", async () => {
    discord.addThreadMember.mockRejectedValueOnce(new DiscordApiError(404, 10007));
    expect(await addMemberToThread("evt1", thread, "d-1")).toBe("not-in-server");
    expect(discord.unarchiveThread).not.toHaveBeenCalled();
  });

  it("drops the record when the thread was deleted in Discord", async () => {
    db.set("discord-thread:evt1", JSON.stringify(thread));
    discord.addThreadMember.mockRejectedValueOnce(new DiscordApiError(404, 10003));
    expect(await addMemberToThread("evt1", thread, "d-1")).toBe("thread-gone");
    expect(await getThreadRecord("evt1")).toBeNull();
  });

  it("keeps a newer record for the same series", async () => {
    db.set("discord-thread:evt1", JSON.stringify({ ...thread, threadId: "444" }));
    discord.addThreadMember.mockRejectedValueOnce(new DiscordApiError(404, 10003));
    await addMemberToThread("evt1", thread, "d-1");
    expect((await getThreadRecord("evt1"))?.threadId).toBe("444");
  });

  it("logs and skips anything else, including a second failure", async () => {
    discord.addThreadMember.mockRejectedValue(new DiscordApiError(400, 50083));
    expect(await addMemberToThread("evt1", thread, "d-1")).toBe("failed");
    expect(discord.addThreadMember).toHaveBeenCalledTimes(2);
  });
});

describe("backfillMemberThreads (R4.3)", () => {
  it("adds the member to every tracked series that has a thread", async () => {
    const email = "me@gmail.com";
    discord.createPublicThread
      .mockResolvedValueOnce({ id: "t-a", type: 11 })
      .mockResolvedValueOnce({ id: "t-b", type: 11 });
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    await runDiscordAfterRsvp({ event: instance, choice: "tentative", email });
    // Tracked, but no thread yet: skipped.
    await fakeRedis.sadd("member-series:me@gmail.com", "no-thread");

    expect(await backfillMemberThreads(email, "d-1")).toBe(2);
    expect(discord.addThreadMember.mock.calls.map(([t]) => t).sort()).toEqual(["t-a", "t-b"]);
  });

  it("keeps going after a failed add", async () => {
    const email = "me@gmail.com";
    discord.createPublicThread
      .mockResolvedValueOnce({ id: "t-a", type: 11 })
      .mockResolvedValueOnce({ id: "t-b", type: 11 });
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    await runDiscordAfterRsvp({ event: instance, choice: "accepted", email });
    discord.addThreadMember.mockRejectedValueOnce(new DiscordApiError(403, 50013));
    expect(await backfillMemberThreads(email, "d-1")).toBe(1);
    expect(discord.addThreadMember).toHaveBeenCalledTimes(2);
  });
});
