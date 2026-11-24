/**
 * Thin REST wrapper for the Discord API v10, authenticated as the bot (PRD 010).
 *
 * No gateway connection: every call is a plain HTTPS request from a Vercel
 * Function. A 429 is retried once after `retry_after` (R5.3); anything else
 * throws a DiscordApiError. Discord error bodies are logged server-side and
 * never returned to clients (R6.1).
 */
import { ConfigError, memberEnv } from "./env";

const API_BASE = "https://discord.com/api/v10";
// Discord requires bot User-Agents in the form "DiscordBot ($url, $version)".
const USER_AGENT = "DiscordBot (https://ghostbustersva.com, 1.0)";
/** Longest rate-limit wait we accept before giving up, in milliseconds. */
const MAX_RETRY_WAIT_MS = 10_000;

/** Discord JSON error codes this integration reacts to. */
export const DiscordErrorCode = {
  UnknownChannel: 10003,
  UnknownMember: 10007,
  UnknownUser: 10013,
  MissingAccess: 50001,
  MissingPermissions: 50013,
  ThreadArchived: 50083,
} as const;

export class DiscordApiError extends Error {
  constructor(
    /** HTTP status. */
    public readonly status: number,
    /** Discord JSON error code, or 0 when the body had none. */
    public readonly code: number,
    message: string,
  ) {
    super(`Discord API error ${status} (code ${code}): ${message}`);
    this.name = "DiscordApiError";
  }
}

export class DiscordRateLimitError extends DiscordApiError {
  constructor(public readonly retryAfterMs: number) {
    super(429, 0, `rate limited, retry after ${retryAfterMs}ms`);
    this.name = "DiscordRateLimitError";
  }
}

interface DiscordErrorBody {
  code?: number;
  message?: string;
  retry_after?: number;
}

function botToken(): string {
  const token = memberEnv.discordBotToken();
  if (!token) throw new ConfigError("DISCORD_BOT_TOKEN");
  return token;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Milliseconds to wait from a 429 response: JSON `retry_after` (seconds), then the header. */
function retryAfterMs(body: DiscordErrorBody | null, res: Response): number {
  const seconds = body?.retry_after ?? Number(res.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 1000;
}

async function readBody(res: Response): Promise<DiscordErrorBody | null> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as DiscordErrorBody;
  } catch {
    return { message: text.slice(0, 200) };
  }
}

export async function discordFetch<T>(
  path: string,
  init: RequestInit & { reason?: string } = {},
): Promise<T | null> {
  const { reason, ...rest } = init;
  const headers: Record<string, string> = {
    Authorization: `Bot ${botToken()}`,
    "User-Agent": USER_AGENT,
    Accept: "application/json",
    ...(rest.body ? { "Content-Type": "application/json" } : {}),
    ...(reason ? { "X-Audit-Log-Reason": encodeURIComponent(reason) } : {}),
    ...((rest.headers as Record<string, string> | undefined) ?? {}),
  };

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });

    if (res.status === 204) return null;
    if (res.ok) {
      const text = await res.text();
      return text ? (JSON.parse(text) as T) : null;
    }

    const body = await readBody(res);
    if (res.status === 429) {
      const wait = retryAfterMs(body, res);
      if (attempt === 1 && wait <= MAX_RETRY_WAIT_MS) {
        await sleep(wait);
        continue;
      }
      console.error(`[discord] rate limited on ${rest.method ?? "GET"} ${path}, gave up`);
      throw new DiscordRateLimitError(wait);
    }

    const code = body?.code ?? 0;
    const message = body?.message ?? res.statusText;
    console.error(
      `[discord] ${res.status} code=${code} ${rest.method ?? "GET"} ${path}: ${message}`,
    );
    throw new DiscordApiError(res.status, code, message);
  }
}

export function isDiscordError(error: unknown, code: number): error is DiscordApiError {
  return error instanceof DiscordApiError && error.code === code;
}

/* ------------------------------------------------------------------ */
/* Channels and threads                                                */
/* ------------------------------------------------------------------ */

export const ChannelType = { PublicThread: 11, PrivateThread: 12 } as const;

export interface DiscordThreadMetadata {
  archived: boolean;
  locked?: boolean;
  auto_archive_duration?: number;
}

export interface DiscordChannel {
  id: string;
  type: number;
  guild_id?: string;
  name?: string;
  thread_metadata?: DiscordThreadMetadata;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
}

/** Thread names are limited to 100 characters (R2.3). */
export const THREAD_NAME_MAX = 100;
/** 7 days, the longest auto-archive Discord allows (R2.3). */
export const THREAD_AUTO_ARCHIVE_MINUTES = 10080;

export function threadName(title: string): string {
  const name = title.trim() || "Event";
  return name.length <= THREAD_NAME_MAX ? name : `${name.slice(0, THREAD_NAME_MAX - 1)}…`;
}

/** Browser link to a channel or thread. */
export function channelUrl(guildId: string, channelId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

/** Starts a public thread in a text channel, without a starter message (R2.3). */
export async function createPublicThread(channelId: string, name: string): Promise<DiscordChannel> {
  const thread = await discordFetch<DiscordChannel>(
    `/channels/${encodeURIComponent(channelId)}/threads`,
    {
      method: "POST",
      body: JSON.stringify({
        name: threadName(name),
        type: ChannelType.PublicThread,
        auto_archive_duration: THREAD_AUTO_ARCHIVE_MINUTES,
      }),
      reason: "Member calendar event thread",
    },
  );
  if (!thread) throw new DiscordApiError(500, 0, "Empty create-thread response");
  return thread;
}

/** Posts a plain-text message. Mentions are disabled so the text can't ping anyone. */
export async function postMessage(channelId: string, content: string): Promise<DiscordMessage> {
  const message = await discordFetch<DiscordMessage>(
    `/channels/${encodeURIComponent(channelId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    },
  );
  if (!message) throw new DiscordApiError(500, 0, "Empty create-message response");
  return message;
}

export async function getChannel(channelId: string): Promise<DiscordChannel> {
  const channel = await discordFetch<DiscordChannel>(`/channels/${encodeURIComponent(channelId)}`);
  if (!channel) throw new DiscordApiError(500, 0, "Empty get-channel response");
  return channel;
}

/** Reopens an archived thread so members can be added (R4.4). */
export async function unarchiveThread(threadId: string): Promise<DiscordChannel> {
  const thread = await discordFetch<DiscordChannel>(`/channels/${encodeURIComponent(threadId)}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: false }),
    reason: "Adding an RSVP'd member",
  });
  if (!thread) throw new DiscordApiError(500, 0, "Empty modify-channel response");
  return thread;
}

/** Adds a user to a thread. Idempotent: adding a current member is a no-op (R4.1). */
export async function addThreadMember(threadId: string, userId: string): Promise<void> {
  await discordFetch(
    `/channels/${encodeURIComponent(threadId)}/thread-members/${encodeURIComponent(userId)}`,
    { method: "PUT" },
  );
}
