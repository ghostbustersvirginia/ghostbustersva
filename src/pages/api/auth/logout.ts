/** Clears the member session cookie (PRD 008, R1.5). */
import type { APIRoute } from "astro";
import { apiError, isAllowedOrigin, json } from "../../../lib/member-calendar/server/http";
import { clearSessionCookieHeader } from "../../../lib/member-calendar/server/session";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) return apiError("invalid_origin", 400);
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookieHeader(request) });
};
