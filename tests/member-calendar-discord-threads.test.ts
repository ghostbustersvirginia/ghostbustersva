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
    discordClientId: () => "999",
    discordGuildId: () => "111",
    discordEventsChannelId: () => "222",
    calendarId: () => "cal@group.calendar.google.com",
    groupAddresses: () => ["members@example.com"],
    siteOrigin: () => "https://ghostbustersva.com",
  },
}));

const discord = vi.hoisted(() => ({
  createPublicThread: vi.fn(),
  postMessage: vi.fn(),
  editMessage: vi.fn(),
  getMessages: vi.fn(),
  addThreadMember: vi.fn(),
  removeThreadMember: vi.fn(),
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
    UnknownMessage: 10008,
    UnknownUser: 10013,
    ThreadArchived: 50083,
  },
  isDiscordError: (e: unknown, code: number) => e instanceof DiscordApiError && e.code === code,
  channelUrl: (g: string, c: string) => `https://discord.com/channels/${g}/${c}`,
}));

const google = vi.hoisted(() => ({
  getCalendarEvent: vi.fn(),
  listEventInstances: vi.fn(),
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
  ensureStarterMessage,
  findStarterMessageId,
  getThreadRecord,
  updateThreadRecord,
  writeStarterMessage,
  type ThreadRecord,
  saveThreadUrlOnEvent,
  seriesKey,
  starterMessage,
} from "../src/lib/member-calendar/server/discord-threads";
import {
  hasUpcomingYesMaybe,
  leaveSeriesThread,
  runDiscordAfterRsvp,
} from "../src/lib/member-calendar/server/discord-rsvp";
import {
  addMemberToThread,
  backfillMemberThreads,
  removeMemberFromThread,
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
  discord.editMessage.mockResolvedValue({ id: "m1", channel_id: "333" });
  discord.getMessages.mockResolvedValue([]);
  discord.addThreadMember.mockResolvedValue(undefined);
  discord.removeThreadMember.mockResolvedValue(undefined);
  google.listEventInstances.mockResolvedValue([]);
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
    expect(await getThreadRecord("evt1")).toMatchObject({ threadId: "333", messageId: "m1" });
    expect(record?.messageId).toBe("m1");
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
    const record = await getThreadRecord("evt1");
    expect(record).not.toBeNull();
    expect(record?.messageId).toBeUndefined();
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

  it("does nothing on Discord for a No, or a removal from an event without a thread", async () => {
    await saveDiscordLink(email, { id: "d-1", username: "egon" });
    await runDiscordAfterRsvp({ event: oneOff, choice: "declined", email });
    await runDiscordAfterRsvp({ event: oneOff, choice: "remove", email });
    expect(discord.createPublicThread).not.toHaveBeenCalled();
    expect(discord.addThreadMember).not.toHaveBeenCalled();
    expect(discord.removeThreadMember).not.toHaveBeenCalled();
  });

  const upcoming = {
    ...oneOff,
    etag: '"e1"',
    start: { dateTime: "2099-10-24T14:00:00-04:00" },
    end: { dateTime: "2099-10-24T18:00:00-04:00" },
  };

  it("turns the new thread's starter into the live summary (PRD 014, R3.1)", async () => {
    google.getCalendarEvent.mockResolvedValue({
      ...upcoming,
      attendees: [{ email, responseStatus: "accepted" }],
    });
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    expect(discord.postMessage).toHaveBeenCalledTimes(1);
    expect(discord.editMessage).toHaveBeenCalledWith(
      "333",
      "m1",
      expect.stringContaining("**RSVPs:** ✅ 1 going"),
    );
    expect((await getThreadRecord("evt1"))?.contentHash).toBeTruthy();
  });

  it("refreshes the summary after a No, without creating a thread (PRD 014, R3.1)", async () => {
    await runDiscordAfterRsvp({ event: oneOff, choice: "declined", email });
    expect(discord.editMessage).not.toHaveBeenCalled();

    db.set(
      "discord-thread:evt1",
      JSON.stringify({ threadId: "333", url: "u", createdAt: 1, messageId: "m1" }),
    );
    google.getCalendarEvent.mockResolvedValue({
      ...upcoming,
      attendees: [{ email, responseStatus: "declined" }],
    });
    await runDiscordAfterRsvp({ event: oneOff, choice: "declined", email });
    expect(discord.createPublicThread).not.toHaveBeenCalled();
    expect(discord.editMessage).toHaveBeenCalledWith(
      "333",
      "m1",
      expect.stringContaining("**RSVPs:** none yet"),
    );
  });

  it("keeps the series after a change to No", async () => {
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    await runDiscordAfterRsvp({ event: oneOff, choice: "declined", email });
    expect(await getMemberSeries(email)).toEqual(["evt1"]);
  });

  it("drops a one-off on removal, but keeps a series with another Yes (PRD 014, R4.1)", async () => {
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    await runDiscordAfterRsvp({ event: instance, choice: "accepted", email });

    // The one-off no longer lists them; the series master has instances.
    google.getCalendarEvent.mockImplementation(async (_cal: string, id: string) =>
      id === "series1"
        ? { id, recurrence: ["RRULE:FREQ=MONTHLY"] }
        : { id, etag: '"e1"', attendees: [] },
    );
    google.listEventInstances.mockResolvedValue([
      { ...instance, attendees: [] },
      { ...instance, id: "series1_later", attendees: [{ email, responseStatus: "tentative" }] },
    ]);
    await runDiscordAfterRsvp({ event: oneOff, choice: "remove", email });
    await runDiscordAfterRsvp({ event: instance, choice: "remove", email });
    expect(await getMemberSeries(email)).toEqual(["series1"]);
  });

  it("removes a linked member from the thread once nothing is left (PRD 014, R4.1)", async () => {
    await saveDiscordLink(email, { id: "d-1", username: "egon" });
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    google.getCalendarEvent.mockResolvedValue({ ...oneOff, etag: '"e1"', attendees: [] });

    await runDiscordAfterRsvp({ event: oneOff, choice: "remove", email });
    expect(discord.removeThreadMember).toHaveBeenCalledWith("333", "d-1");
    expect(await getMemberSeries(email)).toEqual([]);
  });

  it("never removes anyone for a change to No (D4)", async () => {
    await saveDiscordLink(email, { id: "d-1", username: "egon" });
    await runDiscordAfterRsvp({ event: oneOff, choice: "accepted", email });
    google.getCalendarEvent.mockResolvedValue({
      ...oneOff,
      attendees: [{ email, responseStatus: "declined" }],
    });
    await runDiscordAfterRsvp({ event: oneOff, choice: "declined", email });
    expect(discord.removeThreadMember).not.toHaveBeenCalled();
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

/* --- PRD 014, phase 1 ----------------------------------------------------- */

const v1Record: ThreadRecord = {
  threadId: "333",
  url: "https://discord.com/channels/111/333",
  createdAt: 1,
};
const seed = (record: ThreadRecord) => db.set("discord-thread:evt1", JSON.stringify(record));
const msg = (id: string, author: string) => ({ id, channel_id: "333", author: { id: author } });
const deleted = () => new DiscordApiError(404, 10008);

describe("thread records (PRD 014)", () => {
  it("reads v1 records without the new fields", async () => {
    seed(v1Record);
    expect(await getThreadRecord("evt1")).toEqual(v1Record);
  });

  it("keeps the new fields", async () => {
    const full = {
      ...v1Record,
      messageId: "m1",
      contentHash: "abc",
      eventSignature: "sig",
      cancelledPosted: true,
    };
    seed(full);
    expect(await getThreadRecord("evt1")).toEqual(full);
  });

  it("merges a patch, and removes fields set to undefined", async () => {
    seed({ ...v1Record, messageId: "m1", contentHash: "abc" });
    const next = await updateThreadRecord("evt1", "333", {
      messageId: undefined,
      contentHash: "d",
    });
    expect(next).toEqual({ ...v1Record, contentHash: "d" });
    expect(await getThreadRecord("evt1")).toEqual({ ...v1Record, contentHash: "d" });
  });

  it("doesn't write onto a replacement thread", async () => {
    seed({ ...v1Record, threadId: "444" });
    expect(await updateThreadRecord("evt1", "333", { messageId: "m1" })).toBeNull();
    expect((await getThreadRecord("evt1"))?.messageId).toBeUndefined();
  });
});

describe("findStarterMessageId (PRD 014, R2.2)", () => {
  it("takes the bot's earliest message, comparing IDs as snowflakes", async () => {
    discord.getMessages.mockResolvedValue([
      msg("10000000000000000002", "999"),
      msg("9000000000000000001", "555"),
      msg("9999999999999999999", "999"),
    ]);
    expect(await findStarterMessageId("333")).toBe("9999999999999999999");
    expect(discord.getMessages).toHaveBeenCalledWith("333", { after: "333", limit: 10 });
  });

  it("returns null when the bot has no message there", async () => {
    discord.getMessages.mockResolvedValue([msg("4000", "555")]);
    expect(await findStarterMessageId("333")).toBeNull();
  });
});

describe("ensureStarterMessage (PRD 014, R2)", () => {
  it("uses the stored ID without calling Discord", async () => {
    const record = { ...v1Record, messageId: "m1" };
    expect(await ensureStarterMessage("evt1", record, "text")).toMatchObject({
      messageId: "m1",
      posted: false,
    });
    expect(discord.getMessages).not.toHaveBeenCalled();
  });

  it("finds a v1 thread's starter and stores it", async () => {
    seed(v1Record);
    discord.getMessages.mockResolvedValue([msg("4000", "999")]);
    const found = await ensureStarterMessage("evt1", v1Record, "text");
    expect(found).toMatchObject({ messageId: "4000", posted: false });
    expect(discord.postMessage).not.toHaveBeenCalled();
    expect((await getThreadRecord("evt1"))?.messageId).toBe("4000");
  });

  it("posts a new message when the starter is gone", async () => {
    seed(v1Record);
    discord.postMessage.mockResolvedValue({ id: "5000", channel_id: "333" });
    const found = await ensureStarterMessage("evt1", v1Record, "summary");
    expect(found).toMatchObject({ messageId: "5000", posted: true });
    expect(discord.postMessage).toHaveBeenCalledWith("333", "summary");
    expect((await getThreadRecord("evt1"))?.messageId).toBe("5000");
  });
});

describe("writeStarterMessage (PRD 014, R2.4)", () => {
  it("edits the stored message", async () => {
    const record = { ...v1Record, messageId: "m1" };
    seed(record);
    await writeStarterMessage("evt1", record, "new text");
    expect(discord.editMessage).toHaveBeenCalledWith("333", "m1", "new text");
    expect(discord.postMessage).not.toHaveBeenCalled();
  });

  it("doesn't edit a message it just posted", async () => {
    seed(v1Record);
    discord.postMessage.mockResolvedValue({ id: "5000", channel_id: "333" });
    const record = await writeStarterMessage("evt1", v1Record, "text");
    expect(record.messageId).toBe("5000");
    expect(discord.editMessage).not.toHaveBeenCalled();
  });

  it("finds the message again when the stored one was deleted", async () => {
    const record = { ...v1Record, messageId: "m1" };
    seed(record);
    discord.editMessage.mockRejectedValueOnce(deleted());
    discord.getMessages.mockResolvedValue([msg("4000", "999")]);

    const next = await writeStarterMessage("evt1", record, "text");
    expect(next.messageId).toBe("4000");
    expect(discord.editMessage).toHaveBeenLastCalledWith("333", "4000", "text");
    expect((await getThreadRecord("evt1"))?.messageId).toBe("4000");
  });

  it("posts a new message when the stored one was deleted and none is left", async () => {
    const record = { ...v1Record, messageId: "m1" };
    seed(record);
    discord.editMessage.mockRejectedValueOnce(deleted());
    discord.postMessage.mockResolvedValue({ id: "5000", channel_id: "333" });

    expect((await writeStarterMessage("evt1", record, "text")).messageId).toBe("5000");
    expect(discord.editMessage).toHaveBeenCalledTimes(1);
  });

  it("gives up after one retry", async () => {
    const record = { ...v1Record, messageId: "m1" };
    seed(record);
    discord.editMessage.mockRejectedValue(deleted());
    discord.getMessages.mockResolvedValue([msg("4000", "999")]);
    await expect(writeStarterMessage("evt1", record, "text")).rejects.toBeInstanceOf(
      DiscordApiError,
    );
    expect(discord.editMessage).toHaveBeenCalledTimes(2);
  });

  it("throws other Discord errors without retrying", async () => {
    const record = { ...v1Record, messageId: "m1" };
    discord.editMessage.mockRejectedValueOnce(new DiscordApiError(403, 50013));
    await expect(writeStarterMessage("evt1", record, "text")).rejects.toBeInstanceOf(
      DiscordApiError,
    );
    expect(discord.editMessage).toHaveBeenCalledTimes(1);
  });
});

/* --- PRD 014, phase 4: removals ------------------------------------------ */

describe("hasUpcomingYesMaybe (PRD 014, R4.1)", () => {
  const email = "me@gmail.com";
  const NOW = Date.parse("2026-12-01T12:00:00-05:00");

  it("checks a one-off's own status", async () => {
    google.getCalendarEvent.mockResolvedValue({
      id: "evt1",
      attendees: [{ email, responseStatus: "accepted" }],
    });
    expect(await hasUpcomingYesMaybe("evt1", email, NOW)).toBe(true);
    google.getCalendarEvent.mockResolvedValue({
      id: "evt1",
      attendees: [{ email, responseStatus: "declined" }],
    });
    expect(await hasUpcomingYesMaybe("evt1", email, NOW)).toBe(false);
  });

  it("checks a series' instances over the next 6 months", async () => {
    google.getCalendarEvent.mockResolvedValue({ id: "series1", recurrence: ["RRULE:FREQ=WEEKLY"] });
    google.listEventInstances.mockResolvedValue([
      { id: "a", attendees: [{ email, responseStatus: "declined" }] },
      { id: "b", attendees: [{ email: "ME@gmail.com", responseStatus: "tentative" }] },
    ]);
    expect(await hasUpcomingYesMaybe("series1", email, NOW)).toBe(true);
    const [, key, from, to] = google.listEventInstances.mock.calls[0];
    expect(key).toBe("series1");
    expect(from).toBe(new Date(NOW).toISOString());
    expect(Date.parse(to) - NOW).toBeGreaterThan(180 * 24 * 60 * 60 * 1000);

    google.listEventInstances.mockResolvedValue([{ id: "a", attendees: [] }]);
    expect(await hasUpcomingYesMaybe("series1", email, NOW)).toBe(false);
  });

  it("counts a deleted event as nothing left", async () => {
    google.getCalendarEvent.mockResolvedValue(null);
    expect(await hasUpcomingYesMaybe("evt1", email, NOW)).toBe(false);
  });
});

describe("leaveSeriesThread (PRD 014, R4.1, R6.2)", () => {
  const email = "me@gmail.com";
  const thread = { threadId: "333", url: "u", createdAt: 1 };

  beforeEach(async () => {
    await saveDiscordLink(email, { id: "d-1", username: "egon" });
    sets.set(`member-series:${email}`, new Set(["evt1"]));
    db.set("discord-thread:evt1", JSON.stringify(thread));
    google.getCalendarEvent.mockResolvedValue({ id: "evt1", attendees: [] });
  });

  it("removes a linked member and stops tracking the series", async () => {
    expect(await leaveSeriesThread("evt1", email)).toBe("removed");
    expect(discord.removeThreadMember).toHaveBeenCalledWith("333", "d-1");
    expect(await getMemberSeries(email)).toEqual([]);
  });

  it("keeps someone who still has a Yes or Maybe", async () => {
    google.getCalendarEvent.mockResolvedValue({
      id: "evt1",
      attendees: [{ email, responseStatus: "accepted" }],
    });
    expect(await leaveSeriesThread("evt1", email)).toBe("kept");
    expect(discord.removeThreadMember).not.toHaveBeenCalled();
    expect(await getMemberSeries(email)).toEqual(["evt1"]);
  });

  it("removes nobody when Google can't be read", async () => {
    google.getCalendarEvent.mockRejectedValue(new Error("google down"));
    expect(await leaveSeriesThread("evt1", email)).toBe("kept");
    expect(discord.removeThreadMember).not.toHaveBeenCalled();
    expect(await getMemberSeries(email)).toEqual(["evt1"]);
  });

  it("only stops tracking when unlinked or there's no thread", async () => {
    db.delete("discord-thread:evt1");
    expect(await leaveSeriesThread("evt1", email)).toBe("untracked");
    expect(discord.removeThreadMember).not.toHaveBeenCalled();
    expect(await getMemberSeries(email)).toEqual([]);
  });

  it("reports a failed removal", async () => {
    discord.removeThreadMember.mockRejectedValue(new DiscordApiError(500, 0));
    expect(await leaveSeriesThread("evt1", email)).toBe("not-removed");
  });
});

describe("removeMemberFromThread (PRD 014, R4.3)", () => {
  const thread = { threadId: "333", url: "u", createdAt: 1 };

  it("unarchives an archived thread and tries once more", async () => {
    discord.removeThreadMember.mockRejectedValueOnce(new DiscordApiError(400, 50083));
    expect(await removeMemberFromThread("evt1", thread, "d-1")).toBe("removed");
    expect(discord.unarchiveThread).toHaveBeenCalledWith("333");
    expect(discord.removeThreadMember).toHaveBeenCalledTimes(2);
  });

  it("counts someone already gone as removed", async () => {
    discord.removeThreadMember.mockRejectedValueOnce(new DiscordApiError(404, 10007));
    expect(await removeMemberFromThread("evt1", thread, "d-1")).toBe("removed");
  });

  it("drops the record when the thread was deleted", async () => {
    db.set("discord-thread:evt1", JSON.stringify(thread));
    discord.removeThreadMember.mockRejectedValueOnce(new DiscordApiError(404, 10003));
    expect(await removeMemberFromThread("evt1", thread, "d-1")).toBe("thread-gone");
    expect(await getThreadRecord("evt1")).toBeNull();
  });

  it("logs and reports anything else", async () => {
    discord.removeThreadMember.mockRejectedValue(new DiscordApiError(403, 50013));
    expect(await removeMemberFromThread("evt1", thread, "d-1")).toBe("failed");
  });
});
