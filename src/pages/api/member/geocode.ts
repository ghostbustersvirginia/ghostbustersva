/**
 * Looks up a member's home location (PRD 009, R7.2, R7.5).
 *  POST { query } → { ok, label, lat, lng }
 * Nothing is stored or logged; the result is kept only in the member's browser.
 */
import type { APIRoute } from "astro";
import {
  apiError,
  isAllowedOrigin,
  json,
  requireMember,
  withCookie,
} from "../../../lib/member-calendar/server/http";
import { geocodeOnce, GeocoderConfigError } from "../../../lib/member-calendar/server/geocoder";
import { checkRateLimit } from "../../../lib/rate-limit";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) return apiError("invalid_origin", 400);

  let check;
  try {
    check = await requireMember(request);
  } catch {
    return apiError("server_error", 502);
  }
  if (!check.ok) return check.response;
  const { session, setCookie } = check;

  const { limited } = await checkRateLimit(`member-home:${session.email}`, { max: 20 });
  if (limited) {
    return withCookie(
      apiError("rate_limited", 429, "Too many lookups. Try again soon."),
      setCookie,
    );
  }

  let query = "";
  try {
    const body = (await request.json()) as { query?: unknown };
    query = typeof body.query === "string" ? body.query.trim() : "";
  } catch {
    return apiError("invalid_request", 400);
  }
  if (!query || query.length > 200) {
    return withCookie(apiError("invalid_request", 400, "Enter a ZIP code or address."), setCookie);
  }

  try {
    const result = await geocodeOnce(query, { usOnly: true });
    if (!result) {
      return withCookie(
        apiError("not_found", 404, "We couldn't find that location in the US."),
        setCookie,
      );
    }
    const label = /^\d{5}(-\d{4})?$/.test(query) ? query : (result.label ?? query);
    return withCookie(json({ ok: true, label, lat: result.lat, lng: result.lng }), setCookie);
  } catch (error) {
    if (error instanceof GeocoderConfigError) {
      return withCookie(apiError("maps_unavailable", 503, "Maps aren't set up yet."), setCookie);
    }
    // Deliberately no details: the query is the member's location.
    console.error("[member-calendar] home lookup failed");
    return withCookie(
      apiError("server_error", 502, "Location lookup failed. Please try again."),
      setCookie,
    );
  }
};
