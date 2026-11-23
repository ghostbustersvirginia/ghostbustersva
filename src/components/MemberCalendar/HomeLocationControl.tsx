import { useState } from "react";
import type { HomeLocation } from "../../lib/member-calendar/geo";
import { lookupHomeLocation } from "./api";

interface Props {
  home: HomeLocation | null;
  onChange: (home: { label: string; lat: number; lng: number } | null) => void;
}

const PROMPT_DISMISSED_KEY = "gbva.calendar.home-prompt.v1";

function promptDismissed(): boolean {
  try {
    return window.localStorage.getItem(PROMPT_DISMISSED_KEY) === "dismissed";
  } catch {
    return false;
  }
}

/**
 * "My location" for the map panel (PRD 009, R7): a ZIP code or address, or the
 * browser's current location. Saved only in this browser.
 */
export default function HomeLocationControl({ home, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(promptDismissed);

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await lookupHomeLocation(query.trim());
      onChange({ label: result.label, lat: result.lat, lng: result.lng });
      setQuery("");
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Location lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("This browser can't share its location.");
      return;
    }
    setBusy(true);
    setError(null);
    // Only the browser sees these coordinates; they're never sent to GBVA.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          label: "Current location",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setBusy(false);
        setEditing(false);
      },
      () => {
        setError("Your location couldn't be found. You can enter a ZIP code instead.");
        setBusy(false);
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(PROMPT_DISMISSED_KEY, "dismissed");
    } catch {
      /* storage unavailable */
    }
  }

  if (home && !editing) {
    return (
      <div className="mc-home">
        <span>
          <strong>My location:</strong> {home.label}
        </span>
        <button type="button" className="mc-link-btn" onClick={() => setEditing(true)}>
          Change
        </button>
        <button type="button" className="mc-link-btn" onClick={() => onChange(null)}>
          Clear my location
        </button>
      </div>
    );
  }

  if (!home && !editing && dismissed) {
    return (
      <div className="mc-home">
        <button type="button" className="mc-link-btn" onClick={() => setEditing(true)}>
          Add my location
        </button>
      </div>
    );
  }

  return (
    <form className="mc-home mc-home--form" onSubmit={submit}>
      {!home && !editing && (
        <span className="mc-home__prompt">
          Add your ZIP code to see events near you.{" "}
          <button type="button" className="mc-link-btn" onClick={dismiss}>
            Not now
          </button>
        </span>
      )}
      <label className="mc-home__field">
        <span className="sr-only">ZIP code or address</span>
        <input
          type="text"
          inputMode="text"
          autoComplete="postal-code"
          placeholder="ZIP code or address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={busy}
        />
      </label>
      <button type="submit" className="mc-btn mc-btn--small" disabled={busy || !query.trim()}>
        {busy ? "Finding…" : "Set"}
      </button>
      <button
        type="button"
        className="mc-btn mc-btn--small mc-btn--ghost"
        onClick={useCurrentLocation}
        disabled={busy}
      >
        Use my current location
      </button>
      {editing && (
        <button type="button" className="mc-link-btn" onClick={() => setEditing(false)}>
          Cancel
        </button>
      )}
      <span className="mc-home__note">Saved only in this browser.</span>
      {error && (
        <p className="mc-home__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
