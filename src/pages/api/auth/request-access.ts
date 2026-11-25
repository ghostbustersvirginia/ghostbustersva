/**
 * Request member calendar access (PRD 013, R3).
 *  POST (no body). Who's asking comes only from the signed applicant cookie
 *  set at sign-in, never from the request.
 */
import type { APIRoute } from "astro";
import { requestAccess } from "../../../lib/member-calendar/server/access-requests";
import {
  decodeApplicant,
  readApplicantCookie,
} from "../../../lib/member-calendar/server/applicant";
import { memberEnv } from "../../../lib/member-calendar/server/env";
import {
  apiError,
  checkMembership,
  isAllowedOrigin,
  json,
  serverError,
} from "../../../lib/member-calendar/server/http";
import { checkRateLimit, getIp } from "../../../lib/rate-limit";
import type { RequestAccessResponse } from "../../../lib/member-calendar/types";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) return apiError("invalid_origin", 400);

  const { limited } = await checkRateLimit(`member-request-access:${getIp(request)}`, {
    max: 5,
    windowMinutes: 60,
  });
  if (limited) {
    return apiError("rate_limited", 429, "Too many requests. Try again in an hour.");
  }

  const applicant = decodeApplicant(readApplicantCookie(request), memberEnv.sessionSecret());
  if (!applicant) {
    return apiError("unauthorized", 401, "Your sign-in expired. Sign in again to request access.");
  }

  try {
    const membership = await checkMembership(applicant.email);
    if (membership.isMember) {
      return json({ ok: true, status: "member" } satisfies RequestAccessResponse);
    }
    const status = await requestAccess({ email: applicant.email, name: applicant.name });
    return json({ ok: true, status } satisfies RequestAccessResponse);
  } catch (error) {
    return serverError("request access", error);
  }
};
