import { useEffect, useId, useRef, useState } from "react";
import { FaCalendarDays, FaChevronDown } from "react-icons/fa6";
import { dateKeyFor } from "../../lib/member-calendar/filters";
import {
  addDays,
  customRange,
  MAX_RANGE_MONTHS,
  PRESET_LABELS,
  presetRange,
  RANGE_ERROR_MESSAGES,
  type ListRange,
  type RangePreset,
} from "../../lib/member-calendar/list-range";

interface Props {
  range: ListRange;
  onChange: (range: ListRange) => void;
}

const PRESETS: RangePreset[] = ["30d", "3m", "6m", "year", "custom"];

/**
 * List view period (PRD 009, R6): presets, or a custom From–To range. In the
 * toolbar it's a calendar icon with a dropdown, shown only in list view
 * (PRD 011, R5).
 */
export default function ListRangeControls({ range, onChange }: Props) {
  const id = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [showCustom, setShowCustom] = useState(range.preset === "custom");
  const [from, setFrom] = useState(range.start);
  const [to, setTo] = useState(addDays(range.end, -1));
  const [error, setError] = useState<string | null>(null);

  // Keep the inputs in step when prev/next or Today move the range.
  useEffect(() => {
    setFrom(range.start);
    setTo(addDays(range.end, -1));
    if (range.preset === "custom") setShowCustom(true);
  }, [range.start, range.end, range.preset]);

  // Close on an outside click, or on Esc with focus back on the button.
  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;
    const onDocClick = (e: MouseEvent) => {
      if (details.open && !details.contains(e.target as Node)) details.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && details.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const close = () => {
    const details = detailsRef.current;
    if (!details) return;
    details.open = false;
    details.querySelector("summary")?.focus();
  };

  const chosen: RangePreset = showCustom ? "custom" : range.preset;
  const currentLabel = range.preset === "custom" ? "Custom dates" : PRESET_LABELS[range.preset];

  function choosePreset(value: RangePreset) {
    setError(null);
    if (value === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(presetRange(value, dateKeyFor(new Date())));
    if (byPointer.current) close();
  }

  // Choosing a preset with a pointer closes the menu (R5.4). Arrow keys
  // between the radios leave it open; Esc closes it.
  const byPointer = useRef(false);

  function applyCustom(event: { preventDefault(): void }) {
    event.preventDefault();
    const result = customRange(from, to);
    if (!result.ok) {
      setError(RANGE_ERROR_MESSAGES[result.error]);
      return;
    }
    setError(null);
    onChange(result.range);
    close();
  }

  return (
    <details ref={detailsRef} className="mc-togglebar mc-menu mc-period">
      <summary
        className="mc-togglebar__btn"
        title={`List period: ${currentLabel}`}
        aria-label={`List period: ${currentLabel}`}
      >
        <FaCalendarDays aria-hidden="true" />
        <span className="mc-togglebar__label" aria-hidden="true">
          {currentLabel}
        </span>
        <FaChevronDown aria-hidden="true" className="mc-menu__chevron" />
      </summary>
      <form className="mc-filter__panel mc-range" onSubmit={applyCustom} aria-label="List period">
        <fieldset
          onPointerDown={() => (byPointer.current = true)}
          onKeyDown={() => (byPointer.current = false)}
        >
          <legend className="mc-filter__legend">Show</legend>
          {PRESETS.map((preset) => (
            <label key={preset} className="mc-filter__option">
              <input
                type="radio"
                name={`${id}-preset`}
                checked={chosen === preset}
                onChange={() => choosePreset(preset)}
              />
              {PRESET_LABELS[preset]}
            </label>
          ))}
        </fieldset>

        {showCustom && (
          <div className="mc-range__custom">
            <label className="mc-range__field">
              <span>From</span>
              <input
                type="date"
                value={from}
                required
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="mc-range__field">
              <span>To</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                required
                aria-describedby={error ? `${id}-error` : `${id}-hint`}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <button type="submit" className="mc-btn mc-btn--small">
              Apply
            </button>
            {!error && (
              <span id={`${id}-hint`} className="mc-range__hint">
                Up to {MAX_RANGE_MONTHS} months
              </span>
            )}
          </div>
        )}

        {error && (
          <p id={`${id}-error`} className="mc-range__error" role="alert">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
