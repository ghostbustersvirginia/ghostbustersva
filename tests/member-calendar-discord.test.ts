import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ token: "bot-token" as string | undefined }));

vi.mock("../src/lib/member-calendar/server/env", () => {
  class ConfigError extends Error {}
  return { ConfigError, memberEnv: { discordBotToken: () => env.token } };
});

import {
  addThreadMember,
  channelUrl,
  createPublicThread,
  DiscordApiError,
  DiscordErrorCode,
  DiscordRateLimitError,
  editMessage,
  getMessages,
  isDiscordError,
  postMessage,
  removeThreadMember,
  threadName,
  unarchiveThread,
} from "../src/lib/member-calendar/server/discord";

const fetchMock = vi.fn();

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

beforeEach(() => {
  env.token = "bot-token";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("discordFetch via endpoint helpers", () => {
  it("sends bot auth, a DiscordBot user agent, and the thread payload", async () => {
    fetchMock.mockResolvedValue(json(201, { id: "t1", type: 11 }));

    const thread = await createPublicThread("chan1", "NoVA - Zoo Boo");

    expect(thread.id).toBe("t1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/channels/chan1/threads");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bot bot-token");
    expect(init.headers["User-Agent"]).toMatch(/^DiscordBot \(/);
    expect(JSON.parse(init.body)).toEqual({
      name: "NoVA - Zoo Boo",
      type: 11,
      auto_archive_duration: 10080,
    });
  });

  it("disables mentions on posted messages", async () => {
    fetchMock.mockResolvedValue(json(200, { id: "m1", channel_id: "t1" }));
    await postMessage("t1", "hello @everyone");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).allowed_mentions).toEqual({ parse: [] });
  });

  it("edits a message with PATCH and mentions disabled (PRD 014)", async () => {
    fetchMock.mockResolvedValue(json(200, { id: "m1", channel_id: "t1" }));
    await editMessage("t1", "m1", "**Updated**");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/channels/t1/messages/m1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      content: "**Updated**",
      allowed_mentions: { parse: [] },
    });
  });

  it("lists messages after an ID, with the limit kept to 1–100 (PRD 014)", async () => {
    fetchMock.mockResolvedValue(json(200, [{ id: "m1", channel_id: "t1", author: { id: "b" } }]));
    expect(await getMessages("t1", { after: "t1", limit: 500 })).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://discord.com/api/v10/channels/t1/messages?after=t1&limit=100",
    );
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  });

  it("removes a thread member with DELETE (PRD 014)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await removeThreadMember("t1", "u1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/channels/t1/thread-members/u1");
    expect(init.method).toBe("DELETE");
  });

  it("treats 204 as success", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(addThreadMember("t1", "u1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://discord.com/api/v10/channels/t1/thread-members/u1",
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  });

  it("unarchives with PATCH archived:false", async () => {
    fetchMock.mockResolvedValue(json(200, { id: "t1", type: 11 }));
    await unarchiveThread("t1");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ archived: false });
  });

  it("throws a typed error with the Discord code", async () => {
    fetchMock.mockResolvedValue(json(404, { code: 10007, message: "Unknown Member" }));
    const error = await addThreadMember("t1", "u1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DiscordApiError);
    expect(isDiscordError(error, DiscordErrorCode.UnknownMember)).toBe(true);
    expect((error as DiscordApiError).status).toBe(404);
  });

  it("retries a 429 once after retry_after", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(json(429, { message: "slow down", retry_after: 1.5, global: false }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const done = addThreadMember("t1", "u1");
    await vi.advanceTimersByTimeAsync(1499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(done).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after a second 429", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => json(429, { retry_after: 0.1 }));

    const done = addThreadMember("t1", "u1").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(100);
    expect(await done).toBeInstanceOf(DiscordRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not wait out a very long rate limit", async () => {
    fetchMock.mockResolvedValue(json(429, { retry_after: 60 }));
    const error = await addThreadMember("t1", "u1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DiscordRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws a config error without a bot token, before any request", async () => {
    env.token = undefined;
    await expect(addThreadMember("t1", "u1")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("keeps thread names within 100 characters", () => {
    expect(threadName("  Short  ")).toBe("Short");
    expect(threadName("")).toBe("Event");
    const long = threadName("x".repeat(150));
    expect(long).toHaveLength(100);
    expect(long.endsWith("…")).toBe(true);
  });

  it("builds channel links", () => {
    expect(channelUrl("g1", "t1")).toBe("https://discord.com/channels/g1/t1");
  });
});
