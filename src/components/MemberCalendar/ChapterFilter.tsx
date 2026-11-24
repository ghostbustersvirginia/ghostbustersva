import { useEffect, useRef } from "react";
import { FaChevronDown, FaUserGroup } from "react-icons/fa6";
import { CHAPTERS, GENERAL_LABEL, type ChapterKey } from "../../lib/member-calendar/chapters";

interface Props {
  hidden: ReadonlySet<ChapterKey>;
  onChange: (hidden: Set<ChapterKey>) => void;
}

/**
 * Multi-select chapter filter (PRD 008, R4.4–R4.5). The color legend, which also
 * toggles chapters, is ChapterLegend below the calendar.
 * General (un-prefixed) events always show and aren't listed as a filter.
 * In the toolbar it's an icon plus the number of chapters shown (PRD 011, R4).
 */
export default function ChapterFilter({ hidden, onChange }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const shown = CHAPTERS.length - hidden.size;
  const filtering = hidden.size > 0;

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
    <details ref={detailsRef} className="mc-togglebar mc-menu">
      <summary
        className={`mc-togglebar__btn${filtering ? " is-active" : ""}`}
        title={filtering ? `Showing ${shown} of ${CHAPTERS.length} chapters` : "Filter by chapter"}
        aria-label={`Chapters, ${shown} shown`}
      >
        <FaUserGroup aria-hidden="true" />
        <span className="mc-menu__count" aria-hidden="true">
          {shown}
        </span>
        <FaChevronDown aria-hidden="true" className="mc-menu__chevron" />
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
  );
}
