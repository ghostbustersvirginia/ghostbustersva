/**
 * Starts "Link Discord" (PRD 010, R1.2): a top-level navigation from the
 * calendar page. Issues a single-use state bound to the member's email and to
 * this browser (cookie), then redirects to Discord.
 */
import type { APIRoute } from "astro";
import {
  clearStateCookieHeader,
  redirectTo,
  redirectToCalendar,
  stateCookieHeader,
} from "../../../../lib/member-calendar/server/discord-link-flow";
import {
  discordAuthorizeUrl,
  discordRedirectUri,
} from "../../../../lib/member-calendar/server/discord-oauth";
import {
  createOAuthState,
  discordLinkingEnabled,
  OAUTH_STATE_TTL_SECONDS,
} from "../../../../lib/member-calendar/server/discord-store";
import { requireMember } from "../../../../lib/member-calendar/server/http";
import { checkRateLimit, getIp } from "../../../../lib/rate-limit";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!discordLinkingEnabled()) return redirectToCalendar(request, "unavailable");

  const { limited } = await checkRateLimit(`discord-link:${getIp(request)}`, { max: 20 });
  if (limited) return redirectToCalendar(request, "error");

  try {
    const check = await requireMember(request);
    // Signed out or no longer a member: the calendar page shows the sign-in state.
    if (!check.ok) return redirectToCalendar(request, "expired");

    const state = await createOAuthState(check.session.email);
    const cookies = [stateCookieHeader(request, state, OAUTH_STATE_TTL_SECONDS)];
    if (check.setCookie) cookies.push(check.setCookie);
    return redirectTo(discordAuthorizeUrl(state, discordRedirectUri(request)), cookies);
  } catch (error) {
    console.error("[discord] link start failed:", error);
    return redirectToCalendar(request, "error", [clearStateCookieHeader(request)]);
  }
};
