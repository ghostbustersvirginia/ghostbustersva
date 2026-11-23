import {
  CHAPTERS,
  GENERAL_COLOR,
  GENERAL_LABEL,
  type ChapterKey,
} from "../../lib/member-calendar/chapters";

interface Props {
  hidden: ReadonlySet<ChapterKey>;
  onToggle: (key: ChapterKey) => void;
}

/**
 * Chapter color legend below the calendar. Each chapter is a toggle button that
 * shows or hides that chapter's events (same state as the Chapters menu).
 * General events always show, so General is a plain label.
 */
export default function ChapterLegend({ hidden, onToggle }: Props) {
  return (
    <div className="mc-legend-bar">
      <span className="mc-legend-bar__label" id="mc-legend-label">
        Chapters
      </span>
      <ul className="mc-legend" aria-labelledby="mc-legend-label">
        {CHAPTERS.map((chapter) => {
          const isHidden = hidden.has(chapter.key);
          return (
            <li key={chapter.key}>
              <button
                type="button"
                className={`mc-legend__item mc-legend__toggle${isHidden ? " is-hidden" : ""}`}
                aria-pressed={!isHidden}
                title={`${isHidden ? "Show" : "Hide"} ${chapter.label} events`}
                onClick={() => onToggle(chapter.key)}
              >
                <span
                  className={`mc-swatch${chapter.virtual ? " mc-swatch--virtual" : ""}`}
                  style={{ backgroundColor: chapter.color }}
                  aria-hidden="true"
                />
                {chapter.label}
              </button>
            </li>
          );
        })}
        <li className="mc-legend__item" title="General events always show">
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
