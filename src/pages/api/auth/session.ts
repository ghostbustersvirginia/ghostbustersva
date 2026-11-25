/**
 * Member session (PRD 008, R1).
 *  GET  → current state: signed-out | member (+ the OAuth client ID)
 *  POST → { credential } Google ID token → verify, check groups, set cookie
 */
import type { APIRoute } from "astro";
import { memberEnv } from "../../../lib/member-calendar/server/env";
import { verifyGoogleIdToken } from "../../../lib/member-calendar/server/google-auth";
import {
  apiError,
  checkMembership,
  isAllowedOrigin,
  json,
  requireMember,
  serverError,
  withCookie,
} from "../../../lib/member-calendar/server/http";
import { newSession, sessionCookieHeader } from "../../../lib/member-calendar/server/session";
import {
  applicantCookieHeader,
  clearApplicantCookieHeader,
} from "../../../lib/member-calendar/server/applicant";
import { hasRequest } from "../../../lib/member-calendar/server/membership-sheet";
import { saveMemberName } from "../../../lib/member-calendar/server/store";
import { discordLinkState } from "../../../lib/member-calendar/server/discord-store";
import { checkRateLimit, getIp } from "../../../lib/rate-limit";
import type { SessionState } from "../../../lib/member-calendar/types";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const clientId = memberEnv.oauthClientId();
  try {
    const check = await requireMember(request);
    if (!check.ok) {
      const response = json({ state: "signed-out", clientId } satisfies SessionState);
      const cleared = check.response.headers.get("Set-Cookie");
      if (cleared) response.headers.set("Set-Cookie", cleared);
      return response;
    }
    const { session } = check;
    return withCookie(
      json({
        state: "member",
        clientId,
        user: { email: session.email, name: session.name, isOrganizer: session.isOrganizer },
        discord: await discordLinkState(session.email),
      } satisfies SessionState),
      check.setCookie,
    );
  } catch (error) {
    return serverError("session GET", error);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) return apiError("invalid_origin", 400);

  const { limited } = await checkRateLimit(`member-signin:${getIp(request)}`, { max: 20 });
  if (limited) return apiError("rate_limited", 429, "Too many sign-in attempts. Try again soon.");

  let credential = "";
  try {
    const body = (await request.json()) as { credential?: unknown };
    credential = typeof body.credential === "string" ? body.credential : "";
  } catch {
    return apiError("invalid_request", 400);
  }
  if (!credential) return apiError("invalid_request", 400);

  let user;
  try {
    user = await verifyGoogleIdToken(credential);
  } catch (error) {
    console.error("[member-calendar] ID token rejected:", error);
    return apiError("invalid_credential", 401, "Google sign-in could not be verified.");
  }

  try {
    const membership = await checkMembership(user.email);
    const clientId = memberEnv.oauthClientId();
    if (!membership.isMember) {
      // Whether they've already asked. If the sheet can't be read, the
      // button still shows and the request reports any problem (PRD 013, R4.5).
      const pending = await hasRequest(user.email).catch((error) => {
        console.error("[member-calendar] membership sheet check failed:", error);
        return false;
      });
      // Proves who's asking if they request access (PRD 013, R2).
      return json(
        {
          state: "not-member",
          email: user.email,
          clientId,
          request: pending ? "pending" : "none",
        } satisfies SessionState,
        200,
        { "Set-Cookie": applicantCookieHeader(user, memberEnv.sessionSecret(), request) },
      );
    }

    await saveMemberName(user.email, user.name);
    const session = newSession({
      email: user.email,
      name: user.name,
      isOrganizer: membership.isOrganizer,
    });
    const headers = new Headers();
    headers.append("Set-Cookie", sessionCookieHeader(session, memberEnv.sessionSecret(), request));
    headers.append("Set-Cookie", clearApplicantCookieHeader(request));
    return json(
      {
        state: "member",
        clientId,
        user: { email: user.email, name: user.name, isOrganizer: membership.isOrganizer },
        discord: await discordLinkState(user.email),
      } satisfies SessionState,
      200,
      headers,
    );
  } catch (error) {
    return serverError("membership check", error);
  }
};
