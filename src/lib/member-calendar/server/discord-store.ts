/**
 * Redis records for the Discord integration (PRD 010, Architecture → Redis keys).
 *
 * Unlike the PRD 008 store, linking needs Redis: without it these calls throw
 * DiscordStoreUnavailableError, and the routes report that linking is unavailable.
 */
import { randomBytes } from "node:crypto";
import type { DiscordLinkState } from "../types";
import { memberEnv } from "./env";
import { getRedis } from "./store";

const DAY = 24 * 60 * 60;
/** OAuth state lifetime (R6.2). */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;
/** Links are refreshed whenever the member re-links; drop ones untouched for ~2 years. */
const LINK_TTL_SECONDS = 730 * DAY;

export class DiscordStoreUnavailableError extends Error {
  constructor() {
    super("Redis is not configured");
    this.name = "DiscordStoreUnavailableError";
  }
}

function redis() {
  const client = getRedis();
  if (!client) throw new DiscordStoreUnavailableError();
  return client;
}

export interface DiscordLink {
  id: string;
  username: string;
  /** ms epoch. */
  linkedAt: number;
}

/** Same normalization as RSVPs (logic.normalizeEmail), so keys match across features. */
const norm = (email: string) => email.trim().toLowerCase();
const linkKey = (email: string) => `discord-link:${norm(email)}`;
/** Reverse index so one Discord account maps to one member email (R1.4). */
const userKey = (discordId: string) => `discord-user:${discordId}`;
const stateKey = (state: string) => `discord-oauth-state:${state}`;

function parseLink(value: unknown): DiscordLink | null {
  const data = typeof value === "string" ? safeJson(value) : value;
  if (!data || typeof data !== "object") return null;
  const { id, username, linkedAt } = data as Record<string, unknown>;
  if (typeof id !== "string" || typeof username !== "string") return null;
  return { id, username, linkedAt: typeof linkedAt === "number" ? linkedAt : 0 };
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/* --- OAuth state (R1.2, R1.3, R6.2) ------------------------------------ */

export async function createOAuthState(email: string): Promise<string> {
  const state = randomBytes(24).toString("base64url");
  await redis().set(stateKey(state), norm(email), { ex: OAUTH_STATE_TTL_SECONDS });
  return state;
}

/** Returns the email the state was issued to, deleting it so it can't be reused. */
export async function consumeOAuthState(state: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(state)) return null;
  const email = await redis().getdel<string>(stateKey(state));
  return typeof email === "string" && email ? email : null;
}

/* --- Links (R1.4, R1.5) ------------------------------------------------- */

export async function getDiscordLink(email: string): Promise<DiscordLink | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    return parseLink(await client.get(linkKey(email)));
  } catch (error) {
    console.error("[discord] Redis getDiscordLink failed:", error);
    return null;
  }
}

/**
 * Links a Discord account to a member email. If that Discord account was linked
 * to a different email, that older link is removed (R1.4). A member re-linking a
 * different Discord account replaces their own old link too.
 */
export async function saveDiscordLink(
  email: string,
  identity: { id: string; username: string },
  now = Date.now(),
): Promise<DiscordLink> {
  const client = redis();
  const link: DiscordLink = { id: identity.id, username: identity.username, linkedAt: now };

  const [previousOwner, previousLink] = await Promise.all([
    client.get<string>(userKey(identity.id)),
    client.get(linkKey(email)).then(parseLink),
  ]);

  const tx = client.multi();
  if (typeof previousOwner === "string" && previousOwner && previousOwner !== norm(email)) {
    tx.del(linkKey(previousOwner));
  }
  if (previousLink && previousLink.id !== identity.id) {
    tx.del(userKey(previousLink.id));
  }
  tx.set(linkKey(email), JSON.stringify(link), { ex: LINK_TTL_SECONDS });
  tx.set(userKey(identity.id), norm(email), { ex: LINK_TTL_SECONDS });
  await tx.exec();
  return link;
}

export async function deleteDiscordLink(email: string): Promise<void> {
  const client = redis();
  const link = parseLink(await client.get(linkKey(email)));
  const tx = client.multi();
  tx.del(linkKey(email));
  if (link) {
    // Only drop the reverse entry if it still points at this member.
    const owner = await client.get<string>(userKey(link.id));
    if (owner === norm(email)) tx.del(userKey(link.id));
  }
  await tx.exec();
}

/* --- Session view (R1.1) ------------------------------------------------ */

/** Linking needs both the Discord env vars and Redis (the PRD 010 feature switch). */
export function discordLinkingEnabled(): boolean {
  return memberEnv.discordEnabled() && getRedis() !== null;
}

export async function discordLinkState(email: string): Promise<DiscordLinkState> {
  if (!discordLinkingEnabled()) return { enabled: false, username: null };
  const link = await getDiscordLink(email);
  return { enabled: true, username: link?.username ?? null };
}

/* --- Series a member RSVP'd Yes/Maybe to (R4.1–R4.3) -------------------- */

const seriesSetKey = (email: string) => `member-series:${norm(email)}`;

/** Refreshed on every Yes/Maybe RSVP, so only long-idle members expire. */
const SERIES_TTL_SECONDS = 730 * DAY;

/** Best effort: a Redis failure is logged and never blocks the RSVP's other Discord work. */
export async function addMemberSeries(email: string, seriesKey: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    const key = seriesSetKey(email);
    await client.sadd(key, seriesKey);
    await client.expire(key, SERIES_TTL_SECONDS);
  } catch (error) {
    console.error(`[discord] Redis addMemberSeries failed for ${seriesKey}:`, error);
  }
}

export async function removeMemberSeries(email: string, seriesKey: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.srem(seriesSetKey(email), seriesKey);
  } catch (error) {
    console.error(`[discord] Redis removeMemberSeries failed for ${seriesKey}:`, error);
  }
}

export async function getMemberSeries(email: string): Promise<string[]> {
  const client = getRedis();
  if (!client) return [];
  try {
    const members = await client.smembers(seriesSetKey(email));
    return members.filter((m): m is string => typeof m === "string" && m.length > 0);
  } catch (error) {
    console.error("[discord] Redis getMemberSeries failed:", error);
    return [];
  }
}
