/**
 * "Update My Calendar" (PRD 012, R4): re-sends Google invitations for the
 * member's Yes and Maybe RSVPs in the next 3 months. Once per member per hour.
 *  POST (no body)
 */
import type { APIRoute } from "astro";
import {
  apiError,
  isAllowedOrigin,
  json,
  requireMember,
  serverError,
  withCookie,
} from "../../../lib/member-calendar/server/http";
import { updateMyCalendar } from "../../../lib/member-calendar/server/update-calendar-service";
import { checkRateLimit } from "../../../lib/rate-limit";
import type { UpdateCalendarResponse } from "../../../lib/member-calendar/types";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) return apiError("invalid_origin", 400);

  let check;
  try {
    check = await requireMember(request);
  } catch (error) {
    return serverError("session check", error);
  }
  if (!check.ok) return check.response;
  const { session, setCookie } = check;

  const { limited } = await checkRateLimit(`member-update-calendar:${session.email}`, {
    max: 1,
    windowMinutes: 60,
  });
  if (limited) {
    return withCookie(
      apiError("rate_limited", 429, "You already updated your calendar recently. Try again later."),
      setCookie,
    );
  }

  try {
    const { sent, total } = await updateMyCalendar({ email: session.email });
    return withCookie(json({ ok: true, sent, total } satisfies UpdateCalendarResponse), setCookie);
  } catch (error) {
    return withCookie(serverError("update-my-calendar", error), setCookie);
  }
};
