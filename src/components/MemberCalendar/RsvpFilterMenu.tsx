import { useEffect, useRef } from "react";
import { FaChevronDown, FaListCheck } from "react-icons/fa6";
import { RSVP_STATE_LABELS, RSVP_STATES, type RsvpState } from "../../lib/member-calendar/filters";

interface Props {
  shown: ReadonlySet<RsvpState>;
  onChange: (shown: Set<RsvpState>) => void;
}

/**
 * One "RSVP" button in the toolbar bar with a menu of the RSVP states to show
 * (Going, Maybe, Not going, No response). All are shown by default; the button
 * is highlighted while any state is hidden.
 */
export default function RsvpFilterMenu({ shown, onChange }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const filtering = shown.size < RSVP_STATES.length;

  // Close on outside click or Escape, like the Chapters menu.
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

  const toggle = (state: RsvpState) => {
    const next = new Set(shown);
    if (next.has(state)) next.delete(state);
    else next.add(state);
    onChange(next);
  };

  return (
    <details ref={detailsRef} className="mc-togglebar mc-menu">
      <summary
        className={`mc-togglebar__btn${filtering ? " is-active" : ""}`}
        title={filtering ? "Filtering by your RSVP" : "Filter by your RSVP"}
      >
        <FaListCheck aria-hidden="true" />
        <span className="mc-togglebar__label">
          RSVP{filtering ? `: ${shown.size} of ${RSVP_STATES.length}` : ""}
        </span>
        {filtering && <span className="sr-only">, filtering</span>}
        <FaChevronDown aria-hidden="true" className="mc-menu__chevron" />
      </summary>
      <div className="mc-filter__panel">
        <fieldset>
          <legend className="mc-filter__legend">Show events where you're</legend>
          {RSVP_STATES.map((state) => (
            <label key={state} className="mc-filter__option">
              <input type="checkbox" checked={shown.has(state)} onChange={() => toggle(state)} />
              {RSVP_STATE_LABELS[state]}
            </label>
          ))}
        </fieldset>
        <div className="mc-filter__quick">
          <button
            type="button"
            className="mc-link-btn"
            onClick={() => onChange(new Set(RSVP_STATES))}
          >
            Show all
          </button>
        </div>
      </div>
    </details>
  );
}
