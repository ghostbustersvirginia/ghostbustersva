/** Unlinks the member's Discord account (PRD 010, R1.5). Thread membership is left as is. */
import type { APIRoute } from "astro";
import { deleteDiscordLink } from "../../../../lib/member-calendar/server/discord-store";
import {
  apiError,
  isAllowedOrigin,
  json,
  requireMember,
  withCookie,
} from "../../../../lib/member-calendar/server/http";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) return apiError("invalid_origin", 400);
  try {
    const check = await requireMember(request);
    if (!check.ok) return check.response;
    await deleteDiscordLink(check.session.email);
    return withCookie(json({ ok: true }), check.setCookie);
  } catch (error) {
    console.error("[discord] unlink failed:", error);
    return apiError("server_error", 502, "Couldn't unlink Discord. Please try again.");
  }
};
