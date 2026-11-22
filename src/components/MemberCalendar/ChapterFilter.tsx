import { useEffect, useRef } from "react";
import {
  CHAPTERS,
  GENERAL_COLOR,
  GENERAL_LABEL,
  type ChapterKey,
} from "../../lib/member-calendar/chapters";

interface Props {
  hidden: ReadonlySet<ChapterKey>;
  onChange: (hidden: Set<ChapterKey>) => void;
}

/**
 * Multi-select chapter filter with a legend (PRD 008, R4.4–R4.6).
 * General (un-prefixed) events always show and aren't listed as a filter.
 */
export default function ChapterFilter({ hidden, onChange }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const shown = CHAPTERS.length - hidden.size;

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

  const toggle = (key: ChapterKey) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  return (
    <div className="mc-filter">
      <details ref={detailsRef} className="mc-filter__menu">
        <summary className="mc-btn mc-btn--small">
          Chapters: {shown === CHAPTERS.length ? "All" : `${shown} of ${CHAPTERS.length}`}
          <span aria-hidden="true"> ▾</span>
        </summary>
        <div className="mc-filter__panel">
          <fieldset>
            <legend className="mc-filter__legend">Show events from</legend>
            {CHAPTERS.map((chapter) => (
              <label key={chapter.key} className="mc-filter__option">
                <input
                  type="checkbox"
                  checked={!hidden.has(chapter.key)}
                  onChange={() => toggle(chapter.key)}
                />
                <span
                  className={`mc-swatch${chapter.virtual ? " mc-swatch--virtual" : ""}`}
                  style={{ backgroundColor: chapter.color }}
                  aria-hidden="true"
                />
                {chapter.label}
              </label>
            ))}
          </fieldset>
          <div className="mc-filter__quick">
            <button type="button" className="mc-link-btn" onClick={() => onChange(new Set())}>
              Show all
            </button>
            <button
              type="button"
              className="mc-link-btn"
              onClick={() => onChange(new Set(CHAPTERS.map((c) => c.key)))}
            >
              Hide all
            </button>
          </div>
          <p className="mc-filter__note">{GENERAL_LABEL} events (no chapter prefix) always show.</p>
        </div>
      </details>

      <ul className="mc-legend" aria-label="Chapter colors">
        {CHAPTERS.map((chapter) => (
          <li
            key={chapter.key}
            className={`mc-legend__item${hidden.has(chapter.key) ? " is-hidden" : ""}`}
          >
            <span
              className={`mc-swatch${chapter.virtual ? " mc-swatch--virtual" : ""}`}
              style={{ backgroundColor: chapter.color }}
              aria-hidden="true"
            />
            {chapter.label}
            {hidden.has(chapter.key) && <span className="sr-only"> (hidden)</span>}
          </li>
        ))}
        <li className="mc-legend__item">
          <span
            className="mc-swatch"
            style={{ backgroundColor: GENERAL_COLOR }}
            aria-hidden="true"
          />
          {GENERAL_LABEL}
        </li>
      </ul>
    </div>
  );
}
