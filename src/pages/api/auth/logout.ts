/** Clears the member session and applicant cookies (PRD 008, R1.5; PRD 013, R2.4). */
import type { APIRoute } from "astro";
import { apiError, isAllowedOrigin, json } from "../../../lib/member-calendar/server/http";
import { clearSessionCookieHeader } from "../../../lib/member-calendar/server/session";
import { clearApplicantCookieHeader } from "../../../lib/member-calendar/server/applicant";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) return apiError("invalid_origin", 400);
  const headers = new Headers();
  headers.append("Set-Cookie", clearSessionCookieHeader(request));
  headers.append("Set-Cookie", clearApplicantCookieHeader(request));
  return json({ ok: true }, 200, headers);
};
