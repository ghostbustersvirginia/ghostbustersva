/**
 * "Within" distance filter as a compact toolbar menu (PRD 011, R3): a route
 * icon plus the chosen distance ("25 mi"), or the icon alone for any distance.
 * Shown only when a home location is set.
 */
import { useEffect, useId, useRef } from "react";
import { FaChevronDown, FaRoute } from "react-icons/fa6";
import { WITHIN_OPTIONS, type WithinMiles } from "../../lib/member-calendar/geo";

interface Props {
  within: WithinMiles;
  onChange: (within: WithinMiles) => void;
}

const CHOICES: WithinMiles[] = [null, ...WITHIN_OPTIONS];

const choiceLabel = (miles: WithinMiles) => (miles ? `Within ${miles} miles` : "Any distance");

export default function DistanceMenu({ within, onChange }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const name = useId();

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

  // Choosing with a pointer closes the menu. Arrow keys between the radios
  // leave it open; Esc closes it.
  const byPointer = useRef(false);
  const choose = (miles: WithinMiles) => {
    onChange(miles);
    const details = detailsRef.current;
    if (!byPointer.current || !details) return;
    details.open = false;
    details.querySelector("summary")?.focus();
  };

  return (
    <details ref={detailsRef} className="mc-togglebar mc-menu">
      <summary
        className={`mc-togglebar__btn${within ? " is-active" : ""}`}
        title={within ? `Showing events within ${within} miles` : "Filter by distance from home"}
        aria-label={`Distance: ${choiceLabel(within)}`}
      >
        <FaRoute aria-hidden="true" />
        {within && (
          <span className="mc-menu__count" aria-hidden="true">
            {within} mi
          </span>
        )}
        <FaChevronDown aria-hidden="true" className="mc-menu__chevron" />
      </summary>
      <div className="mc-filter__panel">
        <fieldset
          onPointerDown={() => (byPointer.current = true)}
          onKeyDown={() => (byPointer.current = false)}
        >
          <legend className="mc-filter__legend">Show events</legend>
          {CHOICES.map((miles) => (
            <label key={miles ?? "any"} className="mc-filter__option">
              <input
                type="radio"
                name={name}
                checked={within === miles}
                onChange={() => choose(miles)}
              />
              {choiceLabel(miles)}
            </label>
          ))}
        </fieldset>
      </div>
    </details>
  );
}
