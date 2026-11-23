/**
 * RSVP to an event (PRD 008, R5).
 *  POST { eventId, choice: accepted|tentative|declined|remove, scope: single|following }
 */
import type { APIRoute } from "astro";
import { normalizeForViewer } from "../../../lib/member-calendar/server/events-service";
import {
  apiError,
  isAllowedOrigin,
  json,
  requireMember,
  serverError,
  withCookie,
} from "../../../lib/member-calendar/server/http";
import {
  applyRsvp,
  EventNotFoundError,
  RsvpNotAllowedError,
} from "../../../lib/member-calendar/server/rsvp-service";
import { checkRateLimit } from "../../../lib/rate-limit";
import type { RsvpChoice, RsvpResponse, RsvpScope } from "../../../lib/member-calendar/types";

export const prerender = false;

const CHOICES: readonly RsvpChoice[] = ["accepted", "tentative", "declined", "remove"];
const SCOPES: readonly RsvpScope[] = ["single", "following"];

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

  const { limited } = await checkRateLimit(`member-rsvp:${session.email}`, { max: 60 });
  if (limited) {
    return withCookie(
      apiError("rate_limited", 429, "That's a lot of RSVPs at once. Wait a few minutes."),
      setCookie,
    );
  }

  let body: { eventId?: unknown; choice?: unknown; scope?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_request", 400);
  }
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const choice = body.choice as RsvpChoice;
  const scope = (body.scope ?? "single") as RsvpScope;
  if (!eventId || !CHOICES.includes(choice) || !SCOPES.includes(scope)) {
    return apiError("invalid_request", 400);
  }

  try {
    const outcome = await applyRsvp({
      eventId,
      choice,
      scope,
      member: { email: session.email, name: session.name },
    });
    const [event] = await normalizeForViewer([outcome.primary], session.email);
    return withCookie(
      json({
        ok: true,
        event,
        applied: outcome.applied,
        failed: outcome.failed,
        appliedThrough: outcome.appliedThrough,
      } satisfies RsvpResponse),
      setCookie,
    );
  } catch (error) {
    if (error instanceof EventNotFoundError) {
      return withCookie(apiError("not_found", 404, "This event no longer exists."), setCookie);
    }
    if (error instanceof RsvpNotAllowedError) {
      return withCookie(apiError("rsvp_not_allowed", 409, error.message), setCookie);
    }
    return withCookie(serverError("rsvp", error), setCookie);
  }
};
