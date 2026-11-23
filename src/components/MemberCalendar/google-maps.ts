/**
 * Loads the Google Maps JavaScript API once, on demand (PRD 009, R5.4: only when
 * the map panel is first turned on).
 */
/// <reference types="google.maps" />

let loading: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<typeof google.maps> {
  if (typeof google !== "undefined" && typeof google.maps?.Map === "function") {
    return Promise.resolve(google.maps);
  }
  loading ??= new Promise((resolve, reject) => {
    const callback = "__gbvaGoogleMapsReady";
    (window as unknown as Record<string, () => void>)[callback] = () => resolve(google.maps);
    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
      callback,
    });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Google Maps couldn't be loaded."));
    };
    document.head.appendChild(script);
  });
  return loading;
}
