/**
 * Server-only configuration for the member calendar (PRD 008).
 * Values are read at request time so Vercel runtime env vars apply.
 */

function read(name: string): string | undefined {
  const fromProcess = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const fromVite = (import.meta.env as Record<string, string | undefined>)[name];
  const value = fromProcess ?? fromVite;
  return value && value.trim() ? value.trim() : undefined;
}

export class ConfigError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable ${name}`);
    this.name = "ConfigError";
  }
}

function required(name: string): string {
  const value = read(name);
  if (!value) throw new ConfigError(name);
  return value;
}

function minutes(name: string, fallback: number): number {
  const n = Number(read(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type AccessMode = "direct" | "delegated";

export const memberEnv = {
  oauthClientId: () => read("GOOGLE_OAUTH_CLIENT_ID") ?? null,
  requiredOauthClientId: () => required("GOOGLE_OAUTH_CLIENT_ID"),
  calendarId: () => required("GBVA_EVENTS_CALENDAR_ID"),
  membersGroup: () => read("GBVA_MEMBERS_GROUP") ?? "all-members@ghostbustersva.com",
  organizersGroup: () => read("GBVA_ORGANIZERS_GROUP") ?? "officers@ghostbustersva.com",
  accessMode: (): AccessMode =>
    read("GOOGLE_ACCESS_MODE") === "delegated" ? "delegated" : "direct",
  delegatedUser: () => read("GOOGLE_DELEGATED_USER") ?? "calendar-automation@ghostbustersva.com",
  serviceAccountKey: () => read("GOOGLE_SERVICE_ACCOUNT_KEY"),
  gcpProjectNumber: () => required("GCP_PROJECT_NUMBER"),
  serviceAccountEmail: () => required("GCP_SERVICE_ACCOUNT_EMAIL"),
  poolId: () => read("GCP_WORKLOAD_IDENTITY_POOL_ID") ?? "vercel",
  providerId: () => read("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID") ?? "vercel",
  sessionSecret: () => required("SESSION_SECRET"),
  webhookToken: () => read("CALENDAR_WEBHOOK_TOKEN"),
  cronSecret: () => read("CRON_SECRET"),
  // Vercel Marketplace Upstash provides KV_REST_API_*; plain Upstash uses UPSTASH_REDIS_REST_*.
  redisUrl: () => read("UPSTASH_REDIS_REST_URL") ?? read("KV_REST_API_URL"),
  redisToken: () => read("UPSTASH_REDIS_REST_TOKEN") ?? read("KV_REST_API_TOKEN"),
  /** Re-check group membership after this many minutes (default 12h). */
  membershipTtlMinutes: () => minutes("MEMBERSHIP_TTL_MINUTES", 12 * 60),
  /** Late-change window before an event's start (default 120 minutes). */
  lateChangeWindowMinutes: () => minutes("LATE_CHANGE_WINDOW_MINUTES", 120),
  /** Late-change record retention in days (default 2 years). */
  lateChangeRetentionDays: () => minutes("LATE_CHANGE_RETENTION_DAYS", 730),
  siteOrigin: (): string => {
    const site = read("SITE_URL") ?? import.meta.env.SITE ?? "";
    try {
      return new URL(site).origin;
    } catch {
      return "";
    }
  },
};
