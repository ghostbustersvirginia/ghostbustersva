/**
 * Google Maps links in event locations and descriptions (PRD 009, R4).
 * Organizers often paste a Maps link instead of filling in the location, so the
 * map can be derived from the link or its target. Browser-safe and pure.
 */
import type { ChapterKey } from "./chapters";
import { isMappableLocation, isUrlLocation } from "./locations";

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi;
const HREF = /<a\b[^>]*\bhref="([^"]+)"/gi;
const TRAILING_PUNCTUATION = /[).,;:!?\]}>'"]+$/;

/** Short links that only reveal the place after a redirect. */
export function isShortMapsLink(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "maps.app.goo.gl" ||
      (u.hostname === "goo.gl" && u.pathname.startsWith("/maps"))
    );
  } catch {
    return false;
  }
}

function isGoogleHost(hostname: string): boolean {
  return /(^|\.)google\.[a-z.]+$/i.test(hostname);
}

/** Is this a Google Maps link (full or short)? */
export function isMapsLink(url: string): boolean {
  if (isShortMapsLink(url)) return true;
  try {
    const u = new URL(url);
    return (
      isGoogleHost(u.hostname) && (u.hostname.startsWith("maps.") || u.pathname.startsWith("/maps"))
    );
  } catch {
    return false;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"');
}

/** Unwraps Google's redirector links (https://www.google.com/url?q=<target>). */
function unwrapRedirect(url: string): string {
  try {
    const u = new URL(url);
    if (isGoogleHost(u.hostname) && u.pathname === "/url") {
      return u.searchParams.get("q") ?? u.searchParams.get("url") ?? url;
    }
  } catch {
    /* not a URL */
  }
  return url;
}

function cleanUrl(raw: string): string {
  return unwrapRedirect(decodeHtmlEntities(raw.trim()).replace(TRAILING_PUNCTUATION, ""));
}

/** All Google Maps links in the location and description, in order, de-duplicated. */
export function findMapsLinks(...texts: (string | null | undefined)[]): string[] {
  const links: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    // In the order they appear, whether bare or inside an <a href>.
    const candidates = [
      ...[...text.matchAll(HREF)].map((m) => ({ index: m.index ?? 0, url: m[1] })),
      ...[...text.matchAll(URL_IN_TEXT)].map((m) => ({ index: m.index ?? 0, url: m[0] })),
    ]
      .sort((a, b) => a.index - b.index)
      .map((c) => c.url);
    for (const raw of candidates) {
      const url = cleanUrl(raw);
      if (isMapsLink(url) && !links.includes(url)) links.push(url);
    }
  }
  return links;
}

const plusDecode = (s: string) => decodeURIComponent(s.replace(/\+/g, " ")).trim();

export interface MapsPlace {
  /** Text or "lat,lng" for the Embed API and directions. */
  query: string;
  /** Human-readable place, when the link has one. */
  label: string | null;
}

/**
 * Reads a place from a full Google Maps URL: ?q= / ?query=, /maps/place/<name>,
 * /maps/search/<query>, directions destinations, or @lat,lng coordinates.
 * Returns null for links without a usable place (e.g. a bare place ID).
 */
export function parseMapsUrl(url: string): MapsPlace | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  for (const key of ["q", "query", "destination", "daddr"]) {
    const value = u.searchParams.get(key)?.trim();
    if (value) return { query: value, label: /[a-z]/i.test(value) ? value : null };
  }

  const path = u.pathname;
  const segment = (prefix: string) => {
    const match = new RegExp(`/maps/${prefix}/([^/@]+)`).exec(path);
    return match ? plusDecode(match[1]) : "";
  };
  const name = segment("place") || segment("search");
  if (name) return { query: name, label: name };

  const dir = /\/maps\/dir\/(?:[^/]*\/)*?([^/@]+)\/?(?:@|$)/.exec(path);
  if (dir && dir[1]) {
    const destination = plusDecode(dir[1]);
    if (destination) return { query: destination, label: destination };
  }

  const coords = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(path);
  if (coords) return { query: `${coords[1]},${coords[2]}`, label: null };

  return null;
}

export interface MapLocation {
  /** For the Embed API and directions; null when there's no usable place. */
  mapQuery: string | null;
  /** Place text to show; null when only coordinates or a link are known. */
  mapLabel: string | null;
  /** The original Google Maps link, for "Open in Google Maps". */
  mapUrl: string | null;
}

const NONE: MapLocation = { mapQuery: null, mapLabel: null, mapUrl: null };

/**
 * Works out where an event is: a mappable location field first, then the first
 * Google Maps link in the location or description. `resolvedLinks` maps short
 * links to the full URLs they redirect to (resolved server-side).
 */
export function deriveMapLocation(input: {
  location: string | null | undefined;
  description: string | null | undefined;
  chapter: ChapterKey | null;
  resolvedLinks?: ReadonlyMap<string, string>;
}): MapLocation {
  if (input.chapter === "virtual") return NONE;
  const location = input.location?.trim() ?? "";
  const links = findMapsLinks(location, input.description);

  if (location && !isUrlLocation(location) && isMappableLocation(location, input.chapter)) {
    return { mapQuery: location, mapLabel: location, mapUrl: links[0] ?? null };
  }

  for (const link of links) {
    const target = isShortMapsLink(link) ? input.resolvedLinks?.get(link) : link;
    const place = target ? parseMapsUrl(target) : null;
    if (place) return { mapQuery: place.query, mapLabel: place.label, mapUrl: link };
  }

  return links.length > 0 ? { ...NONE, mapUrl: links[0] } : NONE;
}
