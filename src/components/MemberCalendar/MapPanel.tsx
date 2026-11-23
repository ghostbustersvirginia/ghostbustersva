/// <reference types="google.maps" />
import { PUBLIC_GOOGLE_MAPS_BROWSER_KEY, PUBLIC_GOOGLE_MAPS_MAP_ID } from "astro:env/client";
import { useEffect, useRef, useState } from "react";
import { GENERAL_COLOR, getChapter } from "../../lib/member-calendar/chapters";
import { venueChapter, type HomeLocation, type Venue } from "../../lib/member-calendar/geo";
import type { CalendarEvent } from "../../lib/member-calendar/types";
import { formatShortDate } from "./format";
import { loadGoogleMaps } from "./google-maps";
import HomeLocationControl from "./HomeLocationControl";

interface Props {
  venues: Venue<CalendarEvent>[];
  mappedCount: number;
  unmappableCount: number;
  locating: boolean;
  error: string | null;
  home: HomeLocation | null;
  onHomeChange: (home: { label: string; lat: number; lng: number } | null) => void;
  highlightEventId: string | null;
  onSelectEvent: (event: CalendarEvent) => void;
}

/** Virginia, for an empty map. */
const DEFAULT_CENTER = { lat: 37.54, lng: -78.5 };
const HOME_COLOR = "#1a1a1a";

interface MarkerEntry {
  marker: google.maps.marker.AdvancedMarkerElement;
  pin: google.maps.marker.PinElement;
  eventIds: Set<string>;
}

/**
 * Map of the visible events' venues (PRD 009, R5), stacked below the calendar.
 * Markers use chapter colors; a venue with several events shows a count and
 * lists them when clicked. Clicking an event opens its details.
 */
export default function MapPanel({
  venues,
  mappedCount,
  unmappableCount,
  locating,
  error,
  home,
  onHomeChange,
  highlightEventId,
  onSelectEvent,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const libsRef = useRef<{
    marker: google.maps.MarkerLibrary;
    InfoWindow: typeof google.maps.InfoWindow;
  } | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const homeMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const selectRef = useRef(onSelectEvent);
  selectRef.current = onSelectEvent;
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apiKey = PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const mapId = PUBLIC_GOOGLE_MAPS_MAP_ID;

  // Load the Maps script and create the map once.
  useEffect(() => {
    if (!apiKey || !mapId) return;
    let cancelled = false;
    (async () => {
      try {
        const maps = await loadGoogleMaps(apiKey);
        const [{ Map, InfoWindow }, marker] = await Promise.all([
          maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
          maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
        ]);
        if (cancelled || !container.current) return;
        mapRef.current = new Map(container.current, {
          mapId,
          center: DEFAULT_CENTER,
          zoom: 7,
          gestureHandling: "cooperative",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        libsRef.current = { marker, InfoWindow };
        infoRef.current = new InfoWindow();
        setReady(true);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "The map couldn't load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, mapId]);

  // Draw venue and home markers, then fit the map to them.
  useEffect(() => {
    const map = mapRef.current;
    const libs = libsRef.current;
    if (!ready || !map || !libs) return;
    const { AdvancedMarkerElement, PinElement } = libs.marker;

    markersRef.current.forEach(({ marker }) => (marker.map = null));
    markersRef.current = [];
    if (homeMarkerRef.current) homeMarkerRef.current.map = null;
    infoRef.current?.close();

    const bounds = new google.maps.LatLngBounds();

    for (const venue of venues) {
      const chapter = getChapter(venueChapter(venue));
      const count = venue.events.length;
      const pin = new PinElement({
        background: chapter?.color ?? GENERAL_COLOR,
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        glyph: count > 1 ? String(count) : undefined,
      });
      const place = venue.label ?? venue.events[0].title;
      const marker = new AdvancedMarkerElement({
        map,
        position: venue.position,
        content: pin,
        title: count > 1 ? `${place}: ${count} events` : `${venue.events[0].title} at ${place}`,
        gmpClickable: true,
      });
      marker.addEventListener("gmp-click", () => {
        if (count === 1) {
          selectRef.current(venue.events[0]);
          return;
        }
        infoRef.current?.setContent(
          venueList(venue, (event) => {
            infoRef.current?.close();
            selectRef.current(event);
          }),
        );
        infoRef.current?.open({ map, anchor: marker });
      });
      markersRef.current.push({ marker, pin, eventIds: new Set(venue.events.map((e) => e.id)) });
      bounds.extend(venue.position);
    }

    if (home) {
      const pin = new PinElement({
        background: HOME_COLOR,
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        glyph: "⌂",
      });
      homeMarkerRef.current = new AdvancedMarkerElement({
        map,
        position: { lat: home.lat, lng: home.lng },
        content: pin,
        title: `My location: ${home.label}`,
        zIndex: 1000,
      });
      bounds.extend({ lat: home.lat, lng: home.lng });
    }

    const points = venues.length + (home ? 1 : 0);
    if (points === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(12);
    } else if (points > 1) {
      map.fitBounds(bounds, 48);
    } else {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(7);
    }
  }, [ready, venues, home]);

  // Highlight the marker for the event under the pointer in the calendar (R5.6).
  useEffect(() => {
    for (const entry of markersRef.current) {
      const active = highlightEventId !== null && entry.eventIds.has(highlightEventId);
      entry.pin.scale = active ? 1.4 : 1;
      entry.marker.zIndex = active ? 999 : null;
    }
  }, [highlightEventId, venues, ready]);

  const notConfigured = !apiKey || !mapId;

  return (
    <section className="mc-map" aria-label="Map of events">
      <div className="mc-map__header">
        <p className="mc-map__count" aria-live="polite">
          {locating
            ? "Finding event locations…"
            : `${mappedCount} ${mappedCount === 1 ? "event" : "events"} on the map`}
          {!locating && unmappableCount > 0 && ` · ${unmappableCount} without a mappable location`}
        </p>
        <HomeLocationControl home={home} onChange={onHomeChange} />
      </div>
      {(error || loadError || notConfigured) && (
        <p className="mc-alert mc-alert--error" role="alert">
          {notConfigured ? "The map isn't set up yet." : (loadError ?? error)}
        </p>
      )}
      {!notConfigured && !loadError && <div ref={container} className="mc-map__canvas" />}
      {!locating && mappedCount === 0 && !notConfigured && !loadError && (
        <p className="mc-map__empty">No events in this view have a mappable location.</p>
      )}
    </section>
  );
}

/** The list shown for a venue with several events. */
function venueList(venue: Venue<CalendarEvent>, onSelect: (event: CalendarEvent) => void) {
  const root = document.createElement("div");
  root.className = "mc-map__venue";
  if (venue.label) {
    const heading = document.createElement("p");
    heading.className = "mc-map__venue-title";
    heading.textContent = venue.label;
    root.append(heading);
  }
  const list = document.createElement("ul");
  for (const event of venue.events) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mc-link-btn";
    button.textContent = `${formatShortDate(event.start)}: ${event.title}`;
    button.addEventListener("click", () => onSelect(event));
    item.append(button);
    list.append(item);
  }
  root.append(list);
  return root;
}
