/**
 * Discord OAuth2 for "Link Discord" (PRD 010, R1).
 *
 * Authorization-code flow with the `identify` scope only. The access token is
 * used once to read the member's Discord user, then revoked. No Discord token
 * is ever stored (R1.3).
 */
import { ConfigError, memberEnv } from "./env";
import { DiscordApiError } from "./discord";

const API_BASE = "https://discord.com/api/v10";
const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
export const DISCORD_SCOPE = "identify";

/** The callback URL for the origin serving this request. It must be registered in Discord. */
export function discordRedirectUri(request: Request): string {
  return `${new URL(request.url).origin}/api/auth/discord/callback`;
}

function clientCredentials(): { id: string; secret: string } {
  const id = memberEnv.discordClientId();
  if (!id) throw new ConfigError("DISCORD_CLIENT_ID");
  const secret = memberEnv.discordClientSecret();
  if (!secret) throw new ConfigError("DISCORD_CLIENT_SECRET");
  return { id, secret };
}

export function discordAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientCredentials().id,
    scope: DISCORD_SCOPE,
    state,
    redirect_uri: redirectUri,
    // Skips the consent screen when the member has already authorized the app.
    prompt: "none",
  });
  return `${AUTHORIZE_URL}?${params}`;
}

async function oauthPost(path: string, form: Record<string, string>): Promise<Response> {
  const { id, secret } = clientCredentials();
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(form),
  });
}

async function failure(res: Response, context: string): Promise<DiscordApiError> {
  const text = await res.text().catch(() => "");
  console.error(`[discord] ${context} ${res.status}: ${text.slice(0, 200)}`);
  return new DiscordApiError(res.status, 0, `${context} failed`);
}

/** Exchanges an authorization code for an access token. */
export async function exchangeDiscordCode(code: string, redirectUri: string): Promise<string> {
  const res = await oauthPost("/oauth2/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  if (!res.ok) throw await failure(res, "token exchange");
  const data = (await res.json()) as { access_token?: unknown; scope?: unknown };
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new DiscordApiError(500, 0, "token exchange returned no access token");
  }
  return data.access_token;
}

export interface DiscordIdentity {
  id: string;
  /** Unique Discord username. */
  username: string;
  /** Display name, when the member has set one. */
  globalName: string | null;
}

export async function fetchDiscordIdentity(accessToken: string): Promise<DiscordIdentity> {
  const res = await fetch(`${API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw await failure(res, "users/@me");
  const data = (await res.json()) as { id?: unknown; username?: unknown; global_name?: unknown };
  if (typeof data.id !== "string" || typeof data.username !== "string") {
    throw new DiscordApiError(500, 0, "users/@me returned no user");
  }
  return {
    id: data.id,
    username: data.username,
    globalName: typeof data.global_name === "string" ? data.global_name : null,
  };
}

/** Best-effort: revokes the access token once it has been used. */
export async function revokeDiscordToken(accessToken: string): Promise<void> {
  try {
    const res = await oauthPost("/oauth2/token/revoke", {
      token: accessToken,
      token_type_hint: "access_token",
    });
    if (!res.ok) console.error(`[discord] token revoke ${res.status}`);
  } catch (error) {
    console.error("[discord] token revoke failed:", error);
  }
}
