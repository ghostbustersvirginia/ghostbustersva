/**
 * Applicant cookie (PRD 013, R2): proves which Google account is asking for
 * member calendar access. Set when sign-in verifies an account that isn't a
 * member; grants no calendar access.
 *
 * Format: base64url(JSON payload) + "." + HMAC-SHA256 over "applicant." +
 * payload, so a member session cookie can never pass as one, or the reverse.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const APPLICANT_COOKIE = "gbva_member_applicant";
export const APPLICANT_MAX_AGE_SECONDS = 30 * 60;

export interface Applicant {
  email: string;
  name: string;
  /** ms epoch when the cookie expires. */
  expiresAt: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`applicant.${payload}`).digest("base64url");
}

export function encodeApplicant(applicant: Applicant, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ e: applicant.email, n: applicant.name, x: applicant.expiresAt }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeApplicant(
  value: string | null | undefined,
  secret: string,
  now = Date.now(),
): Applicant | null {
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
      x?: unknown;
    };
    if (typeof data.e !== "string" || !data.e || typeof data.x !== "number") return null;
    if (data.x <= now) return null;
    return { email: data.e, name: typeof data.n === "string" ? data.n : "", expiresAt: data.x };
  } catch {
    return null;
  }
}

function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

function cookie(value: string, maxAge: number, request: Request): string {
  const parts = [
    `${APPLICANT_COOKIE}=${value}`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

export function applicantCookieHeader(
  input: { email: string; name: string },
  secret: string,
  request: Request,
  now = Date.now(),
): string {
  const applicant = { ...input, expiresAt: now + APPLICANT_MAX_AGE_SECONDS * 1000 };
  return cookie(encodeApplicant(applicant, secret), APPLICANT_MAX_AGE_SECONDS, request);
}

export function clearApplicantCookieHeader(request: Request): string {
  return cookie("", 0, request);
}

export function readApplicantCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === APPLICANT_COOKIE) return rest.join("=");
  }
  return null;
}
