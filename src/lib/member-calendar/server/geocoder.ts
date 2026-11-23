/**
 * Server-side geocoding with the Google Geocoding API (PRD 009, R5.3, R7.2).
 *
 * Event venues are cached in Redis for 30 days (Google's limit for caching
 * coordinates); failures for 7 days. Member home lookups are never cached or
 * logged.
 */
import { createHash } from "node:crypto";
import { normalizeGeoQuery, parseLatLng, type GeoResult } from "../geo";
import { readEnv } from "./env";
import { getRedis } from "./store";

const ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const DAY = 24 * 60 * 60;
const TIMEOUT_MS = 5000;
const CONCURRENCY = 5;
/** New (uncached) venue lookups per request; the rest come on later loads. */
export const NEW_LOOKUP_BUDGET = 50;

export class GeocoderConfigError extends Error {}

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results?: {
    place_id?: string;
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
    address_components?: { short_name: string; types: string[] }[];
  }[];
}

/**
 * One Geocoding API call. Returns null for no result (or a non-US result when
 * `usOnly`). Throws on configuration or transport errors.
 */
export async function geocodeOnce(
  query: string,
  options: { usOnly?: boolean } = {},
): Promise<GeoResult | null> {
  const key = readEnv("GOOGLE_GEOCODING_KEY");
  if (!key) throw new GeocoderConfigError("GOOGLE_GEOCODING_KEY is not set");

  const params = new URLSearchParams({ address: query, key, region: "us" });
  if (options.usOnly) params.set("components", "country:US");
  const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = (await res.json()) as GoogleGeocodeResponse;

  if (data.status === "ZERO_RESULTS") return null;
  // Key problems (restrictions, API not enabled, billing) affect every lookup.
  if (data.status === "REQUEST_DENIED" || data.status === "OVER_DAILY_LIMIT") {
    console.error(`[member-calendar] Geocoding ${data.status}: ${data.error_message ?? ""}`);
    throw new GeocoderConfigError(`Geocoding ${data.status}`);
  }
  if (data.status !== "OK") throw new Error(`Geocoding status ${data.status}`);
  const top = data.results?.[0];
  const loc = top?.geometry?.location;
  if (!top || !loc) return null;
  if (options.usOnly) {
    const country = top.address_components?.find((c) => c.types.includes("country"));
    if (country && country.short_name !== "US") return null;
  }
  return {
    lat: loc.lat,
    lng: loc.lng,
    placeId: top.place_id ?? null,
    label: top.formatted_address ?? null,
  };
}

const cacheKey = (query: string) =>
  `geo:${createHash("sha256").update(normalizeGeoQuery(query)).digest("hex").slice(0, 32)}`;

/**
 * Geocodes event map queries, using the Redis cache. "lat,lng" queries are
 * parsed without an API call. Returns query → result (null = no location, or
 * a lookup that failed this time). Queries left over after the budget are
 * omitted, so the client can retry. Key problems throw GeocoderConfigError.
 */
export async function geocodeVenues(
  queries: string[],
  budget = NEW_LOOKUP_BUDGET,
): Promise<Map<string, GeoResult | null>> {
  const results = new Map<string, GeoResult | null>();
  const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  const toLookUp: string[] = [];

  for (const query of unique) {
    const coords = parseLatLng(query);
    if (coords) results.set(query, { ...coords, placeId: null, label: null });
    else toLookUp.push(query);
  }

  const redis = getRedis();
  let pending = toLookUp;
  if (redis && toLookUp.length > 0) {
    try {
      const cached = await redis.mget<(GeoResult | "" | null)[]>(...toLookUp.map(cacheKey));
      pending = [];
      toLookUp.forEach((query, i) => {
        const value = cached[i];
        if (value === "") results.set(query, null);
        else if (value && typeof value === "object") results.set(query, value);
        else pending.push(query);
      });
    } catch (error) {
      console.error("[member-calendar] geocode cache read failed:", error);
    }
  }

  const batch = pending.slice(0, budget);
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = batch.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map((q) => geocodeOnce(q)));
    chunk.forEach((query, j) => {
      const outcome = settled[j];
      if (outcome.status === "rejected") {
        if (outcome.reason instanceof GeocoderConfigError) throw outcome.reason;
        console.error("[member-calendar] geocode failed:", (outcome.reason as Error).message);
        // Shown as "no mappable location" now; not cached, so retried on a later load.
        results.set(query, null);
        return;
      }
      results.set(query, outcome.value);
      redis
        ?.set(cacheKey(query), outcome.value ?? "", { ex: outcome.value ? 30 * DAY : 7 * DAY })
        .catch((error) => console.error("[member-calendar] geocode cache write failed:", error));
    });
  }
  return results;
}
