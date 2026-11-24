/**
 * Shared pieces of the "Link Discord" routes (PRD 010, R1): the browser-bound
 * state cookie and the redirect back to the calendar with a status for the UI.
 */
import type { DiscordLinkStatus } from "../types";

export const DISCORD_STATE_COOKIE = "gbva_discord_state";
const STATE_COOKIE_PATH = "/api/auth/discord";
export const CALENDAR_PATH = "/members/calendar";

function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

function cookie(request: Request, value: string, maxAge: number): string {
  // SameSite=Lax: the callback is a top-level GET navigation from discord.com.
  const parts = [
    `${DISCORD_STATE_COOKIE}=${value}`,
    `Path=${STATE_COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

export const stateCookieHeader = (request: Request, state: string, maxAge: number) =>
  cookie(request, state, maxAge);

export const clearStateCookieHeader = (request: Request) => cookie(request, "", 0);

export function readStateCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === DISCORD_STATE_COOKIE) return rest.join("=") || null;
  }
  return null;
}

/** 302 back to the calendar with `?discord=<status>` (R1.3). */
export function redirectToCalendar(
  request: Request,
  status: Exclude<DiscordLinkStatus, "unlinked">,
  setCookies: string[] = [],
): Response {
  const location = new URL(CALENDAR_PATH, request.url);
  location.searchParams.set("discord", status);
  return redirectTo(location.toString(), setCookies);
}

export function redirectTo(location: string, setCookies: string[] = []): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "private, no-store" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}
