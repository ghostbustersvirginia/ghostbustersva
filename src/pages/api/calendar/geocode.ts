/**
 * Event venue coordinates for the map panel (PRD 009, R5.3).
 *  POST { queries: string[] } → { ok, results: { [query]: GeoResult | null } }
 * Queries missing from `results` weren't looked up yet (budget); retry later.
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
import { geocodeVenues, GeocoderConfigError } from "../../../lib/member-calendar/server/geocoder";
import { checkRateLimit } from "../../../lib/rate-limit";

export const prerender = false;

const MAX_QUERIES = 200;
const MAX_QUERY_LENGTH = 300;

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

  const { limited } = await checkRateLimit(`member-geocode:${session.email}`, { max: 120 });
  if (limited) return withCookie(apiError("rate_limited", 429), setCookie);

  let queries: string[];
  try {
    const body = (await request.json()) as { queries?: unknown };
    queries = Array.isArray(body.queries)
      ? body.queries.filter(
          (q): q is string => typeof q === "string" && q.length <= MAX_QUERY_LENGTH,
        )
      : [];
  } catch {
    return apiError("invalid_request", 400);
  }
  if (queries.length === 0 || queries.length > MAX_QUERIES) {
    return withCookie(apiError("invalid_request", 400), setCookie);
  }

  try {
    const results = await geocodeVenues(queries);
    return withCookie(json({ ok: true, results: Object.fromEntries(results) }), setCookie);
  } catch (error) {
    if (error instanceof GeocoderConfigError) {
      return withCookie(
        apiError("maps_unavailable", 503, "Event locations can't be looked up right now."),
        setCookie,
      );
    }
    return withCookie(serverError("geocode", error), setCookie);
  }
};
