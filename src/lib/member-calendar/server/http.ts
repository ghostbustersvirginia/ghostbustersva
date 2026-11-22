/**
 * Request helpers for member calendar API routes (PRD 008, R1.6, R5.10, R8).
 */
import { memberEnv } from "./env";
import { isGroupMember } from "./google-api";
import {
  clearSessionCookieHeader,
  decodeSession,
  needsMembershipRecheck,
  readSessionCookie,
  sessionCookieHeader,
  type MemberSession,
} from "./session";

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  h.set("Cache-Control", "private, no-store");
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function apiError(error: string, status: number, message?: string, headers?: HeadersInit) {
  return json({ ok: false, error, ...(message ? { message } : {}) }, status, headers);
}

/** Same rules as the contact form: site origin, Vercel branch previews, localhost. */
export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") ?? "";
  const expected = memberEnv.siteOrigin();
  const requestOrigin = new URL(request.url).origin;
  if (!origin) return false;
  if (origin === requestOrigin || (expected && origin === expected)) return true;
  if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) return true;
  return origin.startsWith("https://gbva-site-git") && origin.endsWith(".vercel.app");
}

export interface MembershipResult {
  isMember: boolean;
  isOrganizer: boolean;
}

export async function checkMembership(email: string): Promise<MembershipResult> {
  const [isMember, isOrganizer] = await Promise.all([
    isGroupMember(memberEnv.membersGroup(), email),
    isGroupMember(memberEnv.organizersGroup(), email).catch((error) => {
      console.error("[member-calendar] organizer check failed:", error);
      return false;
    }),
  ]);
  // Officers count as members even if they aren't in all-members@.
  return { isMember: isMember || isOrganizer, isOrganizer };
}

export type SessionCheck =
  | { ok: true; session: MemberSession; setCookie: string | null }
  | { ok: false; response: Response };

/**
 * Reads the session cookie and re-checks membership once MEMBERSHIP_TTL has
 * passed. Removed members lose access at that point (R1.6).
 */
export async function requireMember(
  request: Request,
  options: { organizer?: boolean } = {},
): Promise<SessionCheck> {
  const cookie = readSessionCookie(request);
  if (!cookie) return { ok: false, response: apiError("unauthorized", 401) };
  const secret = memberEnv.sessionSecret();
  let session = decodeSession(cookie, secret);
  if (!session) return { ok: false, response: apiError("unauthorized", 401) };

  let setCookie: string | null = null;
  if (needsMembershipRecheck(session, memberEnv.membershipTtlMinutes())) {
    const membership = await checkMembership(session.email);
    if (!membership.isMember) {
      return {
        ok: false,
        response: apiError("not_member", 403, undefined, {
          "Set-Cookie": clearSessionCookieHeader(request),
        }),
      };
    }
    session = { ...session, isOrganizer: membership.isOrganizer, checkedAt: Date.now() };
    setCookie = sessionCookieHeader(session, secret, request);
  }

  if (options.organizer && !session.isOrganizer) {
    return { ok: false, response: apiError("forbidden", 403) };
  }
  return { ok: true, session, setCookie };
}

export function withCookie(response: Response, setCookie: string | null): Response {
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  return response;
}

/** Logs the real error and returns a generic message (R8). */
export function serverError(context: string, error: unknown): Response {
  console.error(`[member-calendar] ${context}:`, error);
  return apiError("server_error", 502, "Something went wrong talking to Google. Please try again.");
}
