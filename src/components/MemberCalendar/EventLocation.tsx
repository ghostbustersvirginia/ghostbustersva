import { PUBLIC_GOOGLE_MAPS_BROWSER_KEY } from "astro:env/client";
import {
  directionsUrl,
  isUrlLocation,
  locationHref,
  mapsEmbedUrl,
} from "../../lib/member-calendar/locations";
import type { CalendarEvent } from "../../lib/member-calendar/types";

interface Props {
  event: Pick<CalendarEvent, "location" | "mapQuery" | "mapLabel" | "mapUrl">;
}

/**
 * Event location in the details dialog (PRD 009, R4).
 * - A place (from the location field or a Google Maps link): the place text, an
 *   embedded map, "Get directions", and "Open in Google Maps" when there's a link.
 * - A Maps link with no readable place: just "Open in Google Maps".
 * - A non-map URL (e.g. a meeting link): a link. Anything else: plain text.
 */
export default function EventLocation({ event }: Props) {
  const { location, mapQuery, mapLabel, mapUrl } = event;
  const locationIsUrl = Boolean(location && isUrlLocation(location));
  const placeText = locationIsUrl ? mapLabel : (location ?? mapLabel);
  const apiKey = PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

  if (mapQuery) {
    return (
      <div className="mc-location">
        {placeText && <p className="mc-dialog__where">{placeText}</p>}
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
          <a
            className="mc-btn mc-btn--small"
            href={directionsUrl(mapQuery)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get directions<span className="sr-only"> (opens Google Maps in new tab)</span>
          </a>
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
