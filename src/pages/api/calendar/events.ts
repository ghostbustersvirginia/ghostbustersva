/**
 * Member event feed (PRD 008, R2).
 *  GET ?start=ISO&end=ISO  → events in range
 *  GET ?id=<eventId>       → one event (deep links, R3.5)
 */
import type { APIRoute } from "astro";
import {
  getEventForViewer,
  getEventsForViewer,
  parseRange,
  RangeError400,
} from "../../../lib/member-calendar/server/events-service";
import {
  apiError,
  json,
  requireMember,
  serverError,
  withCookie,
} from "../../../lib/member-calendar/server/http";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  let check;
  try {
    check = await requireMember(request);
  } catch (error) {
    return serverError("session check", error);
  }
  if (!check.ok) return check.response;
  const { session, setCookie } = check;

  try {
    const id = url.searchParams.get("id");
    if (id) {
      const event = await getEventForViewer(id, session.email);
      if (!event) return withCookie(apiError("not_found", 404), setCookie);
      return withCookie(json({ ok: true, events: [event] }), setCookie);
    }

    const { timeMin, timeMax } = parseRange(
      url.searchParams.get("start"),
      url.searchParams.get("end"),
    );
    const events = await getEventsForViewer(timeMin, timeMax, session.email);
    return withCookie(json({ ok: true, events }), setCookie);
  } catch (error) {
    if (error instanceof RangeError400) return apiError("invalid_range", 400, error.message);
    return serverError("events", error);
  }
};
