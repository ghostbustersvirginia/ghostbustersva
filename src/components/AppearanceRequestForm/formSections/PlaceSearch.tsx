import { useEffect, useRef } from "react";
import { useAppearanceRequest } from "../AppearanceRequestContext";
import FormLabel from "../FormLabel";

import { GOOGLE_MAPS_API_KEY as MAPS_API_KEY } from "astro:env/client";

const SCRIPT_ID = "gbva-google-maps-api";
const CALLBACK_NAME = "__gbvaMapsReady";

// Module-level promise so the script is only injected once across remounts.
let mapsReadyPromise: Promise<void> | null = null;

function loadMapsAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));

  if (window.google?.maps?.places?.Autocomplete) return Promise.resolve();

  if (!mapsReadyPromise) {
    mapsReadyPromise = new Promise<void>((resolve, reject) => {
      (window as unknown as Record<string, unknown>)[CALLBACK_NAME] = resolve;

      if (!document.getElementById(SCRIPT_ID)) {
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places&callback=${CALLBACK_NAME}`;
        script.async = true;
        script.defer = true;
        script.onerror = () => reject(new Error("Failed to load Google Maps API"));
        document.head.appendChild(script);
      }
    });
  }

  return mapsReadyPromise;
}

/**
 * Google Maps Places Autocomplete search input.
 * When a place is selected it auto-populates the address fields and stores the
 * Google Place ID via the shared form context.
 */
export default function PlaceSearch() {
  const { update, copy } = useAppearanceRequest();

  const inputRef = useRef<HTMLInputElement>(null);
  // Hold the latest `update` without re-running the initialization effect.
  const updateRef = useRef(update);
  updateRef.current = update;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    loadMapsAPI()
      .then(() => {
        if (cancelled || !inputRef.current) return;

        const AC = window.google?.maps?.places?.Autocomplete;
        if (!AC) return;

        acRef.current = new AC(inputRef.current, {
          fields: ["place_id", "formatted_address", "address_components", "name"],
        });

        acRef.current.addListener("place_changed", () => {
          const place = acRef.current?.getPlace() as google.maps.places.PlaceResult | undefined;
          if (!place?.place_id) return;

          updateRef.current("placeId", place.place_id);

          let streetNumber = "";
          let route = "";
          let city = "";
          let state = "";
          let zip = "";

          for (const comp of place.address_components ?? []) {
            if (comp.types.includes("street_number")) streetNumber = comp.long_name;
            else if (comp.types.includes("route")) route = comp.long_name;
            else if (comp.types.includes("locality")) city = comp.long_name;
            else if (comp.types.includes("administrative_area_level_1"))
              state = comp.short_name;
            else if (comp.types.includes("postal_code")) zip = comp.long_name;
          }

          const line1 = [streetNumber, route].filter(Boolean).join(" ");
          if (line1) updateRef.current("addressLine1", line1);
          if (city) updateRef.current("city", city);
          if (state) updateRef.current("state", state);
          if (zip) updateRef.current("zipCode", zip);

          // Pre-fill location description with the venue name when available.
          if (place.name) updateRef.current("locationDescription", place.name);
        });
      })
      .catch(() => {
        /* Maps API failed to load — address fields still work manually */
      });

    return () => {
      cancelled = true;
      if (acRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(acRef.current);
      }
    };
  }, []); // intentionally empty — initialization runs once

  return (
    <div className="arf__group">
      <FormLabel htmlFor="placeSearch">{copy.locationSearchLabel}</FormLabel>
      <input
        ref={inputRef}
        id="placeSearch"
        type="text"
        className="arf__input"
        placeholder={copy.locationSearchPlaceholder}
        autoComplete="off"
      />
    </div>
  );
}

