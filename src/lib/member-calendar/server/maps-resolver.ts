/**
 * Resolves Google Maps short links (maps.app.goo.gl) to the full URLs they
 * redirect to, so a place can be read from them (PRD 009, R4).
 *
 * Only Google hosts are contacted, only redirect headers are read, and results
 * are cached in Redis (30 days; failures for 1 day).
 */
import { createHash } from "node:crypto";
import { isShortMapsLink } from "../maps-links";
import { getRedis } from "./store";

const MAX_HOPS = 3;
const TIMEOUT_MS = 3000;
const CONCURRENCY = 5;
/** New (uncached) lookups per call; the rest are picked up on later loads. */
const BUDGET = 20;
const DAY = 24 * 60 * 60;

const cacheKey = (url: string) =>
  `maps-link:${createHash("sha256").update(url).digest("hex").slice(0, 32)}`;

function isAllowedHost(hostname: string): boolean {
  return (
    hostname === "maps.app.goo.gl" ||
    hostname === "goo.gl" ||
    /(^|\.)google\.[a-z.]+$/i.test(hostname)
  );
}

/** Follows redirects on Google hosts only; returns the final non-short URL. */
export async function followShortLink(url: string): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return null;
    }
    // Only the Location header is needed; don't download the page.
    await res.body?.cancel().catch(() => undefined);
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return null;
    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      return null;
    }
    if (next.protocol !== "https:" || !isAllowedHost(next.hostname)) return null;
    if (!isShortMapsLink(next.toString())) return next.toString();
    current = next.toString();
  }
  return null;
}

/** Resolves short links, using the Redis cache; returns short → full URL. */
export async function resolveShortLinks(links: string[]): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const unique = [...new Set(links.filter(isShortMapsLink))];
  if (unique.length === 0) return resolved;

  const redis = getRedis();
  let pending = unique;
  if (redis) {
    try {
      const cached = await redis.mget<(string | null)[]>(...unique.map(cacheKey));
      pending = [];
      unique.forEach((link, i) => {
        const value = cached[i];
        if (typeof value === "string") {
          if (value) resolved.set(link, value);
        } else {
          pending.push(link);
        }
      });
    } catch (error) {
      console.error("[member-calendar] maps link cache read failed:", error);
    }
  }

  const toFetch = pending.slice(0, BUDGET);
  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((link) => followShortLink(link)));
    batch.forEach((link, j) => {
      const full = results[j];
      if (full) resolved.set(link, full);
      if (redis) {
        redis
          .set(cacheKey(link), full ?? "", { ex: full ? 30 * DAY : DAY })
          .catch((error) =>
            console.error("[member-calendar] maps link cache write failed:", error),
          );
      }
    });
  }
  return resolved;
}
