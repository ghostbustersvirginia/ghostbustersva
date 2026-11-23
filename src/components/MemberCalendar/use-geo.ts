/**
 * Browser state for maps (PRD 009, R5, R7): venue coordinates fetched from the
 * server in batches, and the member's home location kept only in localStorage.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  HOME_STORAGE_KEY,
  parseHome,
  type GeoResult,
  type HomeLocation,
  type WithinMiles,
} from "../../lib/member-calendar/geo";
import { geocodeVenueQueries } from "./api";

const MAX_PER_REQUEST = 200;

/**
 * Coordinates for the given map queries. Fetches only queries it hasn't seen;
 * the server caches results, and queries it skipped (budget) are retried once.
 */
export function useVenueCoords(queries: string[], enabled: boolean) {
  const [coords, setCoords] = useState<Map<string, GeoResult | null>>(() => new Map());
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(new Set<string>());
  const latest = useRef(queries);
  latest.current = queries;
  // Changes only when the set of queries does, not on every render.
  const key = enabled ? [...new Set(queries)].sort().join("␟") : "";

  useEffect(() => {
    if (!enabled) return;
    const missing = [...new Set(latest.current)].filter((q) => !requested.current.has(q));
    if (missing.length === 0) return;
    missing.forEach((q) => requested.current.add(q));
    let cancelled = false;
    (async () => {
      for (let i = 0; i < missing.length; i += MAX_PER_REQUEST) {
        const batch = missing.slice(i, i + MAX_PER_REQUEST);
        try {
          const results = await geocodeVenueQueries(batch);
          if (cancelled) return;
          setCoords((prev) => {
            const next = new Map(prev);
            for (const [q, r] of Object.entries(results)) next.set(q, r);
            return next;
          });
          // Skipped by the server's per-request budget: allow a retry later.
          batch.filter((q) => !(q in results)).forEach((q) => requested.current.delete(q));
          setError(null);
        } catch (e) {
          batch.forEach((q) => requested.current.delete(q));
          if (!cancelled) setError(e instanceof Error ? e.message : "Locations couldn't load.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  return { coords, error };
}

function readHome(): HomeLocation | null {
  try {
    return parseHome(window.localStorage.getItem(HOME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeHome(home: HomeLocation | null) {
  try {
    if (home) window.localStorage.setItem(HOME_STORAGE_KEY, JSON.stringify(home));
    else window.localStorage.removeItem(HOME_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** The member's home location: browser-only, never sent to the server again. */
export function useHomeLocation() {
  const [home, setHomeState] = useState<HomeLocation | null>(() => readHome());

  const setHome = useCallback((location: { label: string; lat: number; lng: number } | null) => {
    setHomeState((prev) => {
      const next = location
        ? { ...location, savedAt: new Date().toISOString(), within: prev?.within ?? null }
        : null;
      writeHome(next);
      return next;
    });
  }, []);

  const setWithin = useCallback((within: WithinMiles) => {
    setHomeState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, within };
      writeHome(next);
      return next;
    });
  }, []);

  return { home, setHome, setWithin };
}

const MAP_STORAGE_KEY = "gbva.calendar.map.v1";

/** Map panel on/off, remembered in this browser (R5.1). */
export function useMapToggle() {
  const [on, setOn] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(MAP_STORAGE_KEY) === "on";
    } catch {
      return false;
    }
  });
  const toggle = useCallback((value: boolean) => {
    setOn(value);
    try {
      window.localStorage.setItem(MAP_STORAGE_KEY, value ? "on" : "off");
    } catch {
      /* storage unavailable */
    }
  }, []);
  return [on, toggle] as const;
}
