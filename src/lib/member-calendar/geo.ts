/**
 * Geography helpers for the map panel and home location (PRD 009, R5, R7).
 * Browser-safe and pure.
 */
import type { ChapterKey } from "./chapters";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoResult extends LatLng {
  /** Google place ID, used to group events at the same venue. */
  placeId: string | null;
  /** Google's formatted address. */
  label: string | null;
}

/** Normalizes a map query for caching and grouping. */
export function normalizeGeoQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Reads "lat,lng" queries (from Maps links with coordinates) without geocoding. */
export function parseLatLng(query: string): LatLng | null {
  const match = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(query);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle ("as the crow flies") distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "~23 mi away", "<1 mi away". */
export function formatDistance(miles: number): string {
  if (miles < 1) return "<1 mi away";
  return `~${Math.round(miles)} mi away`;
}

export const WITHIN_OPTIONS = [10, 25, 50, 100] as const;
export type WithinMiles = (typeof WITHIN_OPTIONS)[number] | null;

/**
 * The "Within" filter (R7.4): events with a known location farther than the
 * limit are hidden. Events without a mappable location, or not yet located,
 * stay visible because distance doesn't apply to them.
 */
export function isWithin(
  coords: LatLng | null | undefined,
  home: LatLng | null,
  within: WithinMiles,
): boolean {
  if (!within || !home || !coords) return true;
  return distanceMiles(home, coords) <= within;
}

export interface VenueEvent {
  id: string;
  title: string;
  chapter: ChapterKey | null;
  start: string;
}

export interface Venue<E extends VenueEvent = VenueEvent> {
  key: string;
  position: LatLng;
  label: string | null;
  events: E[];
}

/**
 * Groups events at the same venue (R5.5): same place ID, or coordinates equal
 * to 5 decimal places (~1 m). Events keep their input order within a venue.
 */
export function groupVenues<E extends VenueEvent>(
  located: { event: E; geo: GeoResult }[],
): Venue<E>[] {
  const venues = new Map<string, Venue<E>>();
  for (const { event, geo } of located) {
    const key = geo.placeId ?? `${geo.lat.toFixed(5)},${geo.lng.toFixed(5)}`;
    const venue = venues.get(key);
    if (venue) venue.events.push(event);
    else
      venues.set(key, {
        key,
        position: { lat: geo.lat, lng: geo.lng },
        label: geo.label,
        events: [event],
      });
  }
  return [...venues.values()];
}

/** One chapter for a venue's marker color, or null (General) when they differ. */
export function venueChapter(venue: Venue): ChapterKey | null {
  const chapters = new Set(venue.events.map((e) => e.chapter));
  return chapters.size === 1 ? [...chapters][0] : null;
}

/* --- Home location (R7): stored only in this browser ----------------------- */

export const HOME_STORAGE_KEY = "gbva.calendar.home.v1";

export interface HomeLocation extends LatLng {
  label: string;
  savedAt: string;
  within: WithinMiles;
}

export function parseHome(raw: string | null): HomeLocation | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<HomeLocation>;
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;
    if (Math.abs(data.lat) > 90 || Math.abs(data.lng) > 180) return null;
    const within = (WITHIN_OPTIONS as readonly number[]).includes(Number(data.within))
      ? (Number(data.within) as WithinMiles)
      : null;
    return {
      lat: data.lat,
      lng: data.lng,
      label: typeof data.label === "string" && data.label ? data.label : "My location",
      savedAt: typeof data.savedAt === "string" ? data.savedAt : new Date(0).toISOString(),
      within,
    };
  } catch {
    return null;
  }
}
