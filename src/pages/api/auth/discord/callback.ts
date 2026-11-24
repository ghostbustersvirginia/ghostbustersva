/**
 * Discord OAuth2 callback for "Link Discord" (PRD 010, R1.3).
 *
 * The state must match the browser's state cookie, still exist in Redis
 * (single use, 10 minutes), and belong to the current session's email. The
 * Discord token is used once to read the user ID, then revoked; it is never stored.
 */
import type { APIRoute } from "astro";
import { waitUntil } from "@vercel/functions";
import { backfillMemberThreads } from "../../../../lib/member-calendar/server/discord-members";
import {
  clearStateCookieHeader,
  readStateCookie,
  redirectToCalendar,
} from "../../../../lib/member-calendar/server/discord-link-flow";
import {
  discordRedirectUri,
  exchangeDiscordCode,
  fetchDiscordIdentity,
  revokeDiscordToken,
} from "../../../../lib/member-calendar/server/discord-oauth";
import {
  consumeOAuthState,
  discordLinkingEnabled,
  saveDiscordLink,
} from "../../../../lib/member-calendar/server/discord-store";
import { requireMember } from "../../../../lib/member-calendar/server/http";
import { timingSafeEqual } from "node:crypto";

export const prerender = false;

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const GET: APIRoute = async ({ request }) => {
  const clear = [clearStateCookieHeader(request)];
  if (!discordLinkingEnabled()) return redirectToCalendar(request, "unavailable", clear);

  const params = new URL(request.url).searchParams;
  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";
  const cookieState = readStateCookie(request) ?? "";

  try {
    // Consume the state first so it can't be replayed, whatever happens next.
    const stateEmail = state ? await consumeOAuthState(state) : null;

    // The member pressed Cancel on Discord's screen (or prompt=none needs consent).
    if (params.get("error")) {
      return redirectToCalendar(
        request,
        params.get("error") === "access_denied" ? "cancelled" : "error",
        clear,
      );
    }

    if (!stateEmail || !cookieState || !sameState(state, cookieState) || !code) {
      return redirectToCalendar(request, "expired", clear);
    }

    const check = await requireMember(request);
    if (!check.ok || check.session.email.toLowerCase() !== stateEmail) {
      return redirectToCalendar(request, "expired", clear);
    }

    const accessToken = await exchangeDiscordCode(code, discordRedirectUri(request));
    let identity;
    try {
      identity = await fetchDiscordIdentity(accessToken);
    } finally {
      await revokeDiscordToken(accessToken);
    }

    await saveDiscordLink(check.session.email, identity);
    // Add the member to threads for series they already RSVP'd to (R4.3),
    // after the redirect so linking doesn't wait on Discord.
    waitUntil(
      backfillMemberThreads(check.session.email, identity.id).catch((error) => {
        console.error("[discord] backfill after link failed:", error);
      }),
    );

    if (check.setCookie) clear.push(check.setCookie);
    return redirectToCalendar(request, "linked", clear);
  } catch (error) {
    console.error("[discord] link callback failed:", error);
    return redirectToCalendar(request, "error", clear);
  }
};
