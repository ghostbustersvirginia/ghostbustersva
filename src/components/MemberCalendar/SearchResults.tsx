import { useEffect, useRef } from "react";
import { FaXmark } from "react-icons/fa6";
import { getChapter, GENERAL_LABEL } from "../../lib/member-calendar/chapters";
import type { CalendarEvent } from "../../lib/member-calendar/types";
import { VirtualIcon } from "./EventDialog";
import { formatResultWhen, STATUS_LABEL } from "./format";

interface Props {
  id: string;
  /** What's in the field now; `query` is the deferred, trimmed copy results use. */
  value: string;
  onValueChange: (value: string) => void;
  query: string;
  results: CalendarEvent[];
  total: number;
  hiddenByChapter: number;
  includePast: boolean;
  loading: boolean;
  error: string | null;
  onSelect: (event: CalendarEvent) => void;
  onShowPast: () => void;
  onShowAllChapters: () => void;
  /** Clears the search and closes the box (PRD 011, R2.5). */
  onClose: () => void;
}

/**
 * The search box: the field, then results across a wide date range (the next
 * 12 months, plus the past 6 months when past events are shown). It opens from
 * the toolbar's search icon with the field focused (PRD 011, R2).
 */
export default function SearchResults(props: Props) {
  const { query, results, total, hiddenByChapter, includePast, loading, error } = props;
  const range = includePast ? "the past 6 months and next 12 months" : "the next 12 months";
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <section
      id={props.id}
      className="mc-results"
      aria-label="Search events"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          props.onClose();
        }
      }}
    >
      <div className="mc-results__bar">
        <label className="mc-search">
          <span className="sr-only">Search events by title or description</span>
          <input
            ref={inputRef}
            type="search"
            value={props.value}
            placeholder="Search events…"
            onChange={(e) => props.onValueChange(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="mc-results__close"
          onClick={props.onClose}
          aria-label="Close search"
          title="Close search"
        >
          <FaXmark aria-hidden="true" />
        </button>
      </div>

      {!query ? (
        <p className="mc-results__summary">Type to search event titles and descriptions.</p>
      ) : (
        <p className="mc-results__summary" role="status">
          {loading
            ? `Searching ${range}…`
            : error
              ? error
              : total === 0
                ? `No events in ${range} match “${query}”.`
                : `${total} ${total === 1 ? "event matches" : "events match"} “${query}” in ${range}.`}{" "}
          {!loading && hiddenByChapter > 0 && (
            <>
              {hiddenByChapter} more {hiddenByChapter === 1 ? "is" : "are"} hidden by your chapter
              filter.{" "}
              <button type="button" className="mc-link-btn" onClick={props.onShowAllChapters}>
                Show all chapters
              </button>{" "}
            </>
          )}
          {!includePast && (
            <>
              Past events aren't included.{" "}
              <button type="button" className="mc-link-btn" onClick={props.onShowPast}>
                Show past events
              </button>
            </>
          )}
        </p>
      )}

      {query && !loading && results.length > 0 && (
        <ul className="mc-results__list">
          {results.map((event) => {
            const chapter = getChapter(event.chapter);
            return (
              <li key={event.id}>
                <button
                  type="button"
                  className="mc-results__item"
                  onClick={() => props.onSelect(event)}
                >
                  <span className="mc-results__when">{formatResultWhen(event)}</span>
                  <span
                    className={`mc-chip mc-chip--small${chapter?.virtual ? " mc-chip--virtual" : ""}`}
                    style={
                      chapter
                        ? { backgroundColor: chapter.color, color: chapter.textColor }
                        : undefined
                    }
                  >
                    {chapter?.virtual && <VirtualIcon />}
                    {chapter?.label ?? GENERAL_LABEL}
                  </span>
                  {event.interest && (
                    <span className="mc-chip mc-chip--small mc-chip--interest">Interest</span>
                  )}
                  <span className="mc-results__title">{event.title}</span>
                  {event.myStatus && event.myStatus !== "needsAction" && (
                    <span className="mc-results__status">{STATUS_LABEL[event.myStatus]}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {query && !loading && total > results.length && (
        <p className="mc-results__more">
          Showing the first {results.length}. Add more words to narrow the search.
        </p>
      )}
    </section>
  );
}
