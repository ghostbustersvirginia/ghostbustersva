import { beforeEach, describe, expect, it, vi } from "vitest";

/* --- In-memory Redis with the calls the Discord store uses ---------------- */

const db = vi.hoisted(() => new Map<string, string>());
const sets = vi.hoisted(() => new Map<string, Set<string>>());
const fakeRedis = vi.hoisted(() => {
  const api = {
    smembers: async (key: string) => [...(sets.get(key) ?? [])],
    mget: async (...keys: string[]) => keys.map((k) => db.get(k) ?? null),
    get: async (key: string) => db.get(key) ?? null,
    set: async (key: string, value: string) => {
      db.set(key, value);
      return "OK";
    },
    getdel: async (key: string) => {
      const value = db.get(key) ?? null;
      db.delete(key);
      return value;
    },
    multi: () => {
      const ops: (() => void)[] = [];
      const tx = {
        del: (key: string) => (ops.push(() => db.delete(key)), tx),
        set: (key: string, value: string) => (ops.push(() => db.set(key, value)), tx),
        exec: async () => ops.forEach((op) => op()),
      };
      return tx;
    },
  };
  return api;
});
const redisOn = vi.hoisted(() => ({ value: true }));

vi.mock("../src/lib/member-calendar/server/store", () => ({
  getRedis: () => (redisOn.value ? fakeRedis : null),
}));

const session = vi.hoisted(() => ({
  check: { ok: true, session: { email: "me@gmail.com" }, setCookie: null } as unknown,
}));
vi.mock("../src/lib/member-calendar/server/http", () => ({
  requireMember: async () => session.check,
  isAllowedOrigin: () => true,
  apiError: (error: string, status: number) =>
    new Response(JSON.stringify({ ok: false, error }), { status }),
  json: (data: unknown) => new Response(JSON.stringify(data)),
  withCookie: (r: Response) => r,
}));

const enabled = vi.hoisted(() => ({ value: true }));
vi.mock("../src/lib/member-calendar/server/env", () => {
  class ConfigError extends Error {}
  return {
    ConfigError,
    memberEnv: {
      discordEnabled: () => enabled.value,
      discordClientId: () => "client-1",
      discordClientSecret: () => "secret-1",
      discordBotToken: () => "bot",
    },
  };
});
const pending = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock("@vercel/functions", () => ({ waitUntil: (p: Promise<unknown>) => pending.push(p) }));
const addThreadMember = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/member-calendar/server/discord", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  addThreadMember,
}));
vi.mock("../src/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ limited: false }),
  getIp: () => "1.2.3.4",
}));

import {
  consumeOAuthState,
  createOAuthState,
  deleteDiscordLink,
  discordLinkState,
  getDiscordLink,
  saveDiscordLink,
} from "../src/lib/member-calendar/server/discord-store";
import { GET as start } from "../src/pages/api/auth/discord/start";
import { GET as callback } from "../src/pages/api/auth/discord/callback";
import { POST as unlink } from "../src/pages/api/auth/discord/unlink";

const ORIGIN = "https://ghostbustersva.com";
const fetchMock = vi.fn();

// The route handlers only use `request` from the Astro context.
const call = (route: unknown, request: Request) =>
  (route as (ctx: { request: Request }) => Promise<Response>)({ request });

function member(email = "me@gmail.com") {
  session.check = { ok: true, session: { email }, setCookie: null };
}

function statusOf(res: Response): string | null {
  return new URL(res.headers.get("location") ?? "", ORIGIN).searchParams.get("discord");
}

function callbackRequest(query: Record<string, string>, cookieState?: string) {
  const url = new URL("/api/auth/discord/callback", ORIGIN);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (cookieState) headers.cookie = `gbva_discord_state=${cookieState}`;
  return new Request(url, { headers });
}

function discordOk() {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/oauth2/token")) {
      return Response.json({ access_token: "at-1", scope: "identify" });
    }
    if (url.endsWith("/users/@me")) {
      return Response.json({ id: "d-1", username: "spengler", global_name: "Egon" });
    }
    if (url.endsWith("/oauth2/token/revoke")) return new Response(null, { status: 200 });
    return new Response("unexpected", { status: 500 });
  });
}

beforeEach(() => {
  db.clear();
  sets.clear();
  pending.length = 0;
  addThreadMember.mockReset();
  redisOn.value = true;
  enabled.value = true;
  member();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("discord store", () => {
  it("OAuth state is single use and remembers the email", async () => {
    const state = await createOAuthState("Me@Gmail.com");
    expect(await consumeOAuthState(state)).toBe("me@gmail.com");
    expect(await consumeOAuthState(state)).toBeNull();
  });

  it("rejects malformed state without touching Redis", async () => {
    expect(await consumeOAuthState("not a state!")).toBeNull();
  });

  it("one Discord account maps to one member email (R1.4)", async () => {
    await saveDiscordLink("a@gmail.com", { id: "d-1", username: "egon" });
    await saveDiscordLink("b@gmail.com", { id: "d-1", username: "egon" });
    expect(await getDiscordLink("a@gmail.com")).toBeNull();
    expect((await getDiscordLink("b@gmail.com"))?.id).toBe("d-1");
  });

  it("re-linking a different account frees the old Discord ID", async () => {
    await saveDiscordLink("a@gmail.com", { id: "d-1", username: "egon" });
    await saveDiscordLink("a@gmail.com", { id: "d-2", username: "ray" });
    expect(db.has("discord-user:d-1")).toBe(false);
    expect(db.get("discord-user:d-2")).toBe("a@gmail.com");
  });

  it("unlink removes both records", async () => {
    await saveDiscordLink("a@gmail.com", { id: "d-1", username: "egon" });
    await deleteDiscordLink("a@gmail.com");
    expect(db.size).toBe(0);
  });

  it("link state is disabled without the env vars or Redis", async () => {
    enabled.value = false;
    expect(await discordLinkState("a@gmail.com")).toEqual({ enabled: false, username: null });
    enabled.value = true;
    redisOn.value = false;
    expect(await discordLinkState("a@gmail.com")).toEqual({ enabled: false, username: null });
  });
});

describe("GET /api/auth/discord/start", () => {
  it("redirects to Discord with identify scope, state, and a state cookie", async () => {
    const res = await call(start, new Request(`${ORIGIN}/api/auth/discord/start`));
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(location.searchParams.get("scope")).toBe("identify");
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/discord/callback`);
    const state = location.searchParams.get("state")!;
    expect(res.headers.get("set-cookie")).toContain(`gbva_discord_state=${state}`);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(db.get(`discord-oauth-state:${state}`)).toBe("me@gmail.com");
  });

  it("sends signed-out visitors back to the calendar", async () => {
    session.check = { ok: false, response: new Response(null, { status: 401 }) };
    const res = await call(start, new Request(`${ORIGIN}/api/auth/discord/start`));
    expect(statusOf(res)).toBe("expired");
  });

  it("reports unavailable when the integration is off", async () => {
    enabled.value = false;
    const res = await call(start, new Request(`${ORIGIN}/api/auth/discord/start`));
    expect(statusOf(res)).toBe("unavailable");
  });
});

describe("GET /api/auth/discord/callback", () => {
  it("links the account, revokes the token, and stores no token", async () => {
    discordOk();
    const state = await createOAuthState("me@gmail.com");
    const res = await call(callback, callbackRequest({ state, code: "c-1" }, state));

    expect(statusOf(res)).toBe("linked");
    expect(await getDiscordLink("me@gmail.com")).toMatchObject({
      id: "d-1",
      username: "spengler",
    });
    expect(fetchMock.mock.calls.map(([u]) => u)).toContain(
      "https://discord.com/api/v10/oauth2/token/revoke",
    );
    expect([...db.values()].join()).not.toContain("at-1");

    const tokenBody = fetchMock.mock.calls.find(([u]) => u.endsWith("/oauth2/token"))![1].body;
    expect(String(tokenBody)).toContain(
      `redirect_uri=${encodeURIComponent(`${ORIGIN}/api/auth/discord/callback`)}`,
    );
  });

  it("backfills threads for series the member already RSVP'd to (R4.3)", async () => {
    discordOk();
    sets.set("member-series:me@gmail.com", new Set(["series1", "no-thread"]));
    db.set("discord-thread:series1", JSON.stringify({ threadId: "t-1", url: "u", createdAt: 1 }));
    const state = await createOAuthState("me@gmail.com");
    const res = await call(callback, callbackRequest({ state, code: "c-1" }, state));

    expect(statusOf(res)).toBe("linked");
    await Promise.all(pending);
    expect(addThreadMember).toHaveBeenCalledTimes(1);
    expect(addThreadMember).toHaveBeenCalledWith("t-1", "d-1");
  });

  it("rejects a reused state (R6.2)", async () => {
    discordOk();
    const state = await createOAuthState("me@gmail.com");
    await call(callback, callbackRequest({ state, code: "c-1" }, state));
    db.delete("discord-link:me@gmail.com");
    const res = await call(callback, callbackRequest({ state, code: "c-1" }, state));
    expect(statusOf(res)).toBe("expired");
    expect(await getDiscordLink("me@gmail.com")).toBeNull();
  });

  it("rejects a state that doesn't match the browser cookie", async () => {
    discordOk();
    const state = await createOAuthState("me@gmail.com");
    const res = await call(callback, callbackRequest({ state, code: "c-1" }, "other-state-value"));
    expect(statusOf(res)).toBe("expired");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a state issued to a different member", async () => {
    discordOk();
    const state = await createOAuthState("someone@gmail.com");
    const res = await call(callback, callbackRequest({ state, code: "c-1" }, state));
    expect(statusOf(res)).toBe("expired");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports cancelled and still burns the state", async () => {
    const state = await createOAuthState("me@gmail.com");
    const res = await call(callback, callbackRequest({ state, error: "access_denied" }, state));
    expect(statusOf(res)).toBe("cancelled");
    expect(db.has(`discord-oauth-state:${state}`)).toBe(false);
  });

  it("reports an error when Discord rejects the code", async () => {
    fetchMock.mockResolvedValue(new Response("bad code", { status: 400 }));
    const state = await createOAuthState("me@gmail.com");
    const res = await call(callback, callbackRequest({ state, code: "c-1" }, state));
    expect(statusOf(res)).toBe("error");
    expect(await getDiscordLink("me@gmail.com")).toBeNull();
  });

  it("always clears the state cookie", async () => {
    const res = await call(callback, callbackRequest({ state: "x", code: "c" }));
    expect(res.headers.get("set-cookie")).toContain("gbva_discord_state=;");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("POST /api/auth/discord/unlink", () => {
  it("removes the link", async () => {
    await saveDiscordLink("me@gmail.com", { id: "d-1", username: "egon" });
    const res = await call(
      unlink,
      new Request(`${ORIGIN}/api/auth/discord/unlink`, { method: "POST" }),
    );
    expect(res.status).toBe(200);
    expect(await getDiscordLink("me@gmail.com")).toBeNull();
  });
});
