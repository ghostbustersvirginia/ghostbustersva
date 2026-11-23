/**
 * Members-only event hero image (PRD 009, R1).
 *  GET /api/calendar/image/<eventId>?w=320|640|1200
 */
import type { APIRoute } from "astro";
import { apiError, requireMember, serverError } from "../../../../lib/member-calendar/server/http";
import { getEventImage, parseImageWidth } from "../../../../lib/member-calendar/server/images";

export const prerender = false;

export const GET: APIRoute = async ({ request, params, url }) => {
  let check;
  try {
    check = await requireMember(request);
  } catch (error) {
    return serverError("session check", error);
  }
  if (!check.ok) return check.response;

  const eventId = params.eventId ?? "";
  const width = parseImageWidth(url.searchParams.get("w"));
  if (!eventId || !width) return apiError("invalid_request", 400);

  try {
    const image = await getEventImage(eventId, width);
    if (!image) return apiError("not_found", 404);

    const headers = new Headers({
      "Content-Type": image.contentType,
      // Private: only this member's browser may cache it. The URL carries a
      // version, so a changed attachment gets a new URL.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    });
    if (check.setCookie) headers.append("Set-Cookie", check.setCookie);
    return new Response(image.body, { status: 200, headers });
  } catch (error) {
    return serverError("event image", error);
  }
};
