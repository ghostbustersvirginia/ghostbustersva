/**
 * Event location helpers for maps (PRD 009, R4).
 * Browser-safe and pure.
 */
import type { ChapterKey } from "./chapters";

const URL_PATTERN = /(https?:\/\/|www\.)|\b[a-z0-9-]+\.(com|org|net|us|io|gg|tv)\b/i;
const VIDEO_SERVICES =
  /\b(zoom|google meet|meet\.google|microsoft teams|teams\.microsoft|discord|twitch|youtube|facebook live)\b/i;

/** Location text that means "not a physical place". */
const NON_PLACE = new Set([
  "online",
  "virtual",
  "remote",
  "tbd",
  "tba",
  "to be determined",
  "to be announced",
  "n/a",
  "na",
  "none",
  "various",
  "various locations",
  "multiple locations",
  "see description",
  "see details",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[()[\]{}.!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Is the location a URL (e.g. a meeting link)? */
export function isUrlLocation(location: string | null | undefined): boolean {
  return Boolean(location && URL_PATTERN.test(location.trim()));
}

/**
 * Can this location be shown on a map? Rejects empty text, Virtual events, URLs,
 * online-meeting services, and placeholders like "Online" or "TBD".
 */
export function isMappableLocation(
  location: string | null | undefined,
  chapter: ChapterKey | null = null,
): boolean {
  if (!location || chapter === "virtual") return false;
  const text = location.trim();
  if (!/[a-z]/i.test(text)) return false;
  if (isUrlLocation(text) || VIDEO_SERVICES.test(text)) return false;
  return !NON_PLACE.has(normalize(text));
}

/** Google Maps Embed API (place mode) URL for the event dialog. */
export function mapsEmbedUrl(apiKey: string, location: string): string {
  const params = new URLSearchParams({ key: apiKey, q: location.trim() });
  return `https://www.google.com/maps/embed/v1/place?${params}`;
}

/** Google Maps directions to the location, optionally from a starting point. */
export function directionsUrl(
  location: string,
  origin?: { lat: number; lng: number } | null,
): string {
  const params = new URLSearchParams({ api: "1", destination: location.trim() });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Normalizes a URL location so it can be linked; bare domains get https://. */
export function locationHref(location: string): string {
  const text = location.trim();
  const match = /(https?:\/\/\S+)|((?:www\.)?[a-z0-9-]+\.[a-z]{2,}\S*)/i.exec(text);
  if (!match) return text;
  return match[1] ?? `https://${match[2]}`;
}
