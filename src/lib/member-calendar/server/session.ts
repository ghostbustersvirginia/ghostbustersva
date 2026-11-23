/**
 * Signed session cookie for the member area (PRD 008, Architecture → Session).
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 * The cookie is HttpOnly; Secure; SameSite=Lax.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gbva_member_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface MemberSession {
  email: string;
  name: string;
  isOrganizer: boolean;
  /** ms epoch of the last group-membership check. */
  checkedAt: number;
  /** ms epoch when the session expires. */
  expiresAt: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function encodeSession(session: MemberSession, secret: string): string {
  const payload = b64url(
    JSON.stringify({
      e: session.email,
      n: session.name,
      o: session.isOrganizer ? 1 : 0,
      c: session.checkedAt,
      x: session.expiresAt,
    }),
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeSession(
  value: string | undefined | null,
  secret: string,
  now = Date.now(),
): MemberSession | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      e?: unknown;
      n?: unknown;
      o?: unknown;
      c?: unknown;
      x?: unknown;
    };
    if (typeof data.e !== "string" || typeof data.c !== "number" || typeof data.x !== "number") {
      return null;
    }
    if (data.x <= now) return null;
    return {
      email: data.e,
      name: typeof data.n === "string" ? data.n : "",
      isOrganizer: data.o === 1,
      checkedAt: data.c,
      expiresAt: data.x,
    };
  } catch {
    return null;
  }
}

export function newSession(
  input: Pick<MemberSession, "email" | "name" | "isOrganizer">,
  now = Date.now(),
): MemberSession {
  return { ...input, checkedAt: now, expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000 };
}

function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export function sessionCookieHeader(
  session: MemberSession,
  secret: string,
  request: Request,
): string {
  const maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  const parts = [
    `${SESSION_COOKIE}=${encodeSession(session, secret)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(request: Request): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

export function needsMembershipRecheck(
  session: MemberSession,
  ttlMinutes: number,
  now = Date.now(),
): boolean {
  return now - session.checkedAt > ttlMinutes * 60 * 1000;
}
