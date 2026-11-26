import { PUBLIC_GOOGLE_MAPS_BROWSER_KEY } from "astro:env/client";
import { FaDirections } from "react-icons/fa";
import {
  directionsUrl,
  isUrlLocation,
  locationHref,
  mapsEmbedUrl,
} from "../../lib/member-calendar/locations";
import type { LatLng } from "../../lib/member-calendar/geo";
import type { CalendarEvent } from "../../lib/member-calendar/types";

interface Props {
  event: Pick<CalendarEvent, "location" | "mapQuery" | "mapLabel" | "mapUrl">;
  /** Member's home (browser-only), the starting point for directions (R7.4). */
  home?: LatLng | null;
  /** e.g. "~23 mi away" (R7.4). */
  distance?: string | null;
}

/**
 * Event location in the details dialog (PRD 009, R4).
 * - A place (from the location field or a Google Maps link): the place text, an
 *   embedded map, "Get directions", and "Open in Google Maps" when there's a link.
 * - A Maps link with no readable place: just "Open in Google Maps".
 * - A non-map URL (e.g. a meeting link): a link. Anything else: plain text.
 */
export default function EventLocation({ event, home = null, distance = null }: Props) {
  const { location, mapQuery, mapLabel, mapUrl } = event;
  const locationIsUrl = Boolean(location && isUrlLocation(location));
  const placeText = locationIsUrl ? mapLabel : (location ?? mapLabel);
  const apiKey = PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

  if (mapQuery) {
    return (
      <div className="mc-location">
        {placeText && (
          <div className="mc-dialog__where">
            <a
              className="mc-btn mc-btn--small"
              href={directionsUrl(mapQuery, home)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaDirections size={18} />
            </a>
            <p>
              {placeText}
              {distance && <span className="mc-distance"> · {distance}</span>}
            </p>
          </div>
        )}
        {apiKey && (
          <iframe
            className="mc-location__map"
            title={`Map of ${placeText ?? "the event location"}`}
            src={mapsEmbedUrl(apiKey, mapQuery)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        )}
        <div className="mc-location__actions">
          {mapUrl && (
            <a
              className="mc-btn mc-btn--small mc-btn--ghost"
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps<span className="sr-only"> (opens in new tab)</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  if (mapUrl) {
    return (
      <div className="mc-location">
        {location && !locationIsUrl && <p className="mc-dialog__where">{location}</p>}
        <div className="mc-location__actions">
          <a
            className="mc-btn mc-btn--small"
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Google Maps<span className="sr-only"> (opens in new tab)</span>
          </a>
        </div>
      </div>
    );
  }

  if (location && locationIsUrl) {
    return (
      <p className="mc-dialog__where">
        <a href={locationHref(location)} target="_blank" rel="noopener noreferrer">
          {location}
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      </p>
    );
  }

  return location ? <p className="mc-dialog__where">{location}</p> : null;
}
