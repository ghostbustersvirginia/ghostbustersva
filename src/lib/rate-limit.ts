import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const DEFAULT_WINDOW_MINUTES = 10;
const DEFAULT_MAX_REQUESTS = 5;

export interface RateLimitOptions {
  /** Requests allowed per window (default 5). */
  max?: number;
  /** Window length in minutes (default 10). */
  windowMinutes?: number;
}

const memoryStore = new Map<string, number[]>();

function checkMemoryRateLimit(key: string, max: number, windowMs: number): { limited: boolean } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (memoryStore.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= max) return { limited: true };
  timestamps.push(now);
  memoryStore.set(key, timestamps);
  return { limited: false };
}

const limiters = new Map<string, Ratelimit>();

/** Runtime env first (Vercel), then build-time values. Accepts Marketplace KV_* names. */
function readEnv(name: string): string | undefined {
  const value =
    (typeof process !== "undefined" ? process.env?.[name] : undefined) ??
    (import.meta.env as Record<string, string | undefined>)[name];
  return value && value.trim() ? value.trim() : undefined;
}

function getLimiter(max: number, windowMinutes: number): Ratelimit | null {
  const url = readEnv("UPSTASH_REDIS_REST_URL") ?? readEnv("KV_REST_API_URL");
  const token = readEnv("UPSTASH_REDIS_REST_TOKEN") ?? readEnv("KV_REST_API_TOKEN");
  if (!url || !token) return null;
  const id = `${max}/${windowMinutes}`;
  let limiter = limiters.get(id);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(max, `${windowMinutes} m`),
      prefix: id === `${DEFAULT_MAX_REQUESTS}/${DEFAULT_WINDOW_MINUTES}` ? undefined : `rl:${id}`,
    });
    limiters.set(id, limiter);
  }
  return limiter;
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions = {},
): Promise<{ limited: boolean }> {
  const max = options.max ?? DEFAULT_MAX_REQUESTS;
  const windowMinutes = options.windowMinutes ?? DEFAULT_WINDOW_MINUTES;
  try {
    const rl = getLimiter(max, windowMinutes);
    if (!rl) return checkMemoryRateLimit(key, max, windowMinutes * 60 * 1000);
    const { success } = await rl.limit(key);
    return { limited: !success };
  } catch {
    return checkMemoryRateLimit(key, max, windowMinutes * 60 * 1000);
  }
}

export function getIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
