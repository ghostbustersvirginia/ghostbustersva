import { useEffect, useId, useState } from "react";
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

/** List view period: presets, or a custom From–To range (PRD 009, R6). */
export default function ListRangeControls({ range, onChange }: Props) {
  const id = useId();
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

  const selectValue: RangePreset = showCustom ? "custom" : range.preset;

  function choosePreset(value: RangePreset) {
    setError(null);
    if (value === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(presetRange(value, dateKeyFor(new Date())));
  }

  function applyCustom(event: { preventDefault(): void }) {
    event.preventDefault();
    const result = customRange(from, to);
    if (!result.ok) {
      setError(RANGE_ERROR_MESSAGES[result.error]);
      return;
    }
    setError(null);
    onChange(result.range);
  }

  return (
    <form className="mc-range" onSubmit={applyCustom} aria-label="List date range">
      <label className="mc-range__field">
        <span>Show</span>
        <select value={selectValue} onChange={(e) => choosePreset(e.target.value as RangePreset)}>
          {PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {PRESET_LABELS[preset]}
            </option>
          ))}
        </select>
      </label>

      {showCustom && (
        <>
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
        </>
      )}

      {error && (
        <p id={`${id}-error`} className="mc-range__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
