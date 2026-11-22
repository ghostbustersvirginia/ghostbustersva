/**
 * Google credentials for the member calendar proxy (PRD 008).
 *
 * Credential source:
 *  - GOOGLE_SERVICE_ACCOUNT_KEY (base64 JSON key), if set: fallback.
 *  - Otherwise, Vercel OIDC → Google Workload Identity Federation (preferred).
 *
 * Access mode (GOOGLE_ACCESS_MODE):
 *  - "direct": the service account acts as itself (calendar shared with it,
 *    Groups Reader admin role assigned to it).
 *  - "delegated": domain-wide delegation, acting as GOOGLE_DELEGATED_USER.
 */
import { ExternalAccountClient, JWT, OAuth2Client } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";
import { memberEnv } from "./env";

export const SCOPES = {
  calendar: "https://www.googleapis.com/auth/calendar.events",
  groups: "https://www.googleapis.com/auth/cloud-identity.groups.readonly",
  cloudPlatform: "https://www.googleapis.com/auth/cloud-platform",
} as const;

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const EXPIRY_MARGIN_MS = 60_000;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function parseKey(raw: string): ServiceAccountKey {
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const key = JSON.parse(text) as ServiceAccountKey;
  if (!key.client_email || !key.private_key) throw new Error("Invalid service account key");
  return key;
}

function externalAccountClient(scopes: string[]) {
  const projectNumber = memberEnv.gcpProjectNumber();
  const pool = memberEnv.poolId();
  const provider = memberEnv.providerId();
  const serviceAccount = memberEnv.serviceAccountEmail();
  const client = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
    scopes,
  });
  if (!client) throw new Error("Could not create Workload Identity Federation client");
  return client;
}

async function tokenFromClient(client: {
  getAccessToken(): Promise<{ token?: string | null }>;
}): Promise<string> {
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Google did not return an access token");
  return token;
}

/**
 * Delegated access without a key: sign a JWT-bearer assertion through the
 * IAM Credentials API, then exchange it for a token acting as the user.
 */
async function delegatedTokenViaSignJwt(scopes: string[], subject: string): Promise<string> {
  const serviceAccount = memberEnv.serviceAccountEmail();
  const saToken = await tokenFromClient(externalAccountClient([SCOPES.cloudPlatform]));
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount,
    sub: subject,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const signRes = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccount)}:signJwt`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${saToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payload: JSON.stringify(claims) }),
    },
  );
  if (!signRes.ok) throw new Error(`signJwt failed (${signRes.status})`);
  const { signedJwt } = (await signRes.json()) as { signedJwt: string };

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Delegated token exchange failed (${tokenRes.status})`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  return access_token;
}

async function fetchAccessToken(scopes: string[]): Promise<string> {
  const delegated = memberEnv.accessMode() === "delegated";
  const subject = delegated ? memberEnv.delegatedUser() : undefined;
  const rawKey = memberEnv.serviceAccountKey();

  if (rawKey) {
    const key = parseKey(rawKey);
    const jwt = new JWT({ email: key.client_email, key: key.private_key, scopes, subject });
    return tokenFromClient(jwt);
  }

  if (subject) return delegatedTokenViaSignJwt(scopes, subject);
  return tokenFromClient(externalAccountClient(scopes));
}

/** Cached access token for the given scopes. */
export async function getGoogleAccessToken(scopes: string[]): Promise<string> {
  const cacheKey = [...scopes].sort().join(" ");
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return cached.token;

  const token = await fetchAccessToken(scopes);
  // Google access tokens last an hour; refresh a little early.
  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + 55 * 60 * 1000 });
  return token;
}

let idTokenClient: OAuth2Client | null = null;

export interface VerifiedGoogleUser {
  email: string;
  name: string;
}

/** Verifies a Google Identity Services ID token (signature, aud, iss, exp). */
export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleUser> {
  const clientId = memberEnv.requiredOauthClientId();
  idTokenClient ??= new OAuth2Client(clientId);
  const ticket = await idTokenClient.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error("ID token has no email");
  if (payload.email_verified !== true) throw new Error("Google email is not verified");
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    throw new Error("Unexpected ID token issuer");
  }
  return {
    email: payload.email.toLowerCase(),
    name: payload.name?.trim() || payload.email.split("@")[0],
  };
}
