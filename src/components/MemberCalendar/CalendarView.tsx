/**
 * FullCalendar v7 view with chapter colors, filtering, hidden-day markers
 * and the event dialog (PRD 008, R3, R4).
 */
import FullCalendar, {
  type CalendarRef,
  type DatesSetInfo,
  type DayCellInfo,
  type DayHeaderInfo,
  type EventClickInfo,
  type EventDisplayInfo,
  type EventInput,
} from "@fullcalendar/react";
import formaTheme from "@fullcalendar/react/themes/forma";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import listPlugin from "@fullcalendar/react/list";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/forma/theme.css";
import "@fullcalendar/react/themes/forma/palettes/green.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GENERAL_COLOR,
  GENERAL_TEXT_COLOR,
  getChapter,
  type ChapterKey,
} from "../../lib/member-calendar/chapters";
import {
  CALENDAR_TIME_ZONE,
  hiddenCountsByDay,
  isEventVisible,
  loadHiddenChapters,
  saveHiddenChapters,
} from "../../lib/member-calendar/filters";
import type { CalendarEvent, RsvpResponse, RsvpScope } from "../../lib/member-calendar/types";
import { fetchEvent, fetchEvents } from "./api";
import ChapterFilter from "./ChapterFilter";
import EventDialog, { VirtualIcon } from "./EventDialog";
import { cellDateKey } from "./format";

const MOBILE_QUERY = "(max-width: 768px)";
const PLUGINS = [formaTheme, dayGridPlugin, timeGridPlugin, listPlugin];
const HEADER_TOOLBAR = {
  start: "prev,next today",
  center: "title",
  end: "dayGridMonth,timeGridWeek,listMonth",
};

interface Props {
  onAuthError: (error: unknown) => boolean;
}

function toEventInput(event: CalendarEvent): EventInput {
  const chapter = getChapter(event.chapter);
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    color: chapter?.color ?? GENERAL_COLOR,
    contrastColor: chapter?.textColor ?? GENERAL_TEXT_COLOR,
    extendedProps: { source: event },
  };
}

function readEventParam(): string | null {
  return new URLSearchParams(window.location.search).get("event");
}

function writeEventParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("event", id);
  else url.searchParams.delete("event");
  window.history.replaceState(null, "", url);
}

export default function CalendarView({ onAuthError }: Props) {
  const calendarRef = useRef<CalendarRef>(null);
  const [hidden, setHidden] = useState<Set<ChapterKey>>(() => loadHiddenChapters());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [range, setRange] = useState<{ start: Date; end: Date; viewType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [initialView] = useState(() =>
    window.matchMedia(MOBILE_QUERY).matches ? "listMonth" : "dayGridMonth",
  );

  // Load events whenever the visible range changes.
  useEffect(() => {
    if (!range) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchEvents(range.start, range.end, controller.signal)
      .then((list) => setEvents(list))
      .catch((e) => {
        if (controller.signal.aborted || onAuthError(e)) return;
        setError(e instanceof Error ? e.message : "Events couldn't be loaded.");
      })
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [range?.start.getTime(), range?.end.getTime(), reloadKey, onAuthError]);

  // Deep link: ?event=<id> opens that event (R3.5).
  useEffect(() => {
    const id = readEventParam();
    if (!id) return;
    fetchEvent(id)
      .then((event) => {
        if (!event) {
          setError("That event link is no longer valid.");
          writeEventParam(null);
          return;
        }
        calendarRef.current?.getApi().gotoDate(event.start.slice(0, 10));
        setSelected(event);
      })
      .catch((e) => {
        if (!onAuthError(e)) setError(e instanceof Error ? e.message : "Event couldn't be loaded.");
      });
  }, [onAuthError]);

  const updateHidden = useCallback((next: Set<ChapterKey>) => {
    setHidden(next);
    saveHiddenChapters(next);
  }, []);

  const visibleEvents = useMemo(
    () => events.filter((e) => isEventVisible(e, hidden)),
    [events, hidden],
  );
  const eventInputs = useMemo(() => visibleEvents.map(toEventInput), [visibleEvents]);
  const hiddenCounts = useMemo(() => hiddenCountsByDay(events, hidden), [events, hidden]);
  const hiddenTotal = events.length - visibleEvents.length;

  const handleDatesSet = useCallback((info: DatesSetInfo) => {
    setRange((prev) =>
      prev &&
      prev.start.getTime() === info.start.getTime() &&
      prev.end.getTime() === info.end.getTime() &&
      prev.viewType === info.view.type
        ? prev
        : { start: info.start, end: info.end, viewType: info.view.type },
    );
  }, []);

  const handleEventClick = useCallback((info: EventClickInfo) => {
    info.jsEvent.preventDefault();
    const source = info.event.extendedProps.source as CalendarEvent | undefined;
    if (!source) return;
    setSelected(source);
    writeEventParam(source.id);
  }, []);

  const closeDialog = useCallback(() => {
    setSelected(null);
    writeEventParam(null);
  }, []);

  const handleUpdated = useCallback((result: RsvpResponse, scope: RsvpScope) => {
    setSelected(result.event);
    setEvents((list) => list.map((e) => (e.id === result.event.id ? result.event : e)));
    // Other instances changed too; reload them.
    if (scope === "following" && result.applied.length > 1) setReloadKey((k) => k + 1);
  }, []);

  const eventContent = useCallback((info: EventDisplayInfo) => {
    const source = info.event.extendedProps.source as CalendarEvent | undefined;
    const chapter = getChapter(source?.chapter);
    return (
      <span className="mc-event">
        {info.timeText && <span className="mc-event__time">{info.timeText}</span>}
        <span className="mc-event__chapter">
          {chapter?.virtual && <VirtualIcon />}
          {chapter?.label ?? "General"}
        </span>
        {source?.interest && (
          <span className="mc-event__interest" title="Gauging interest">
            Interest
          </span>
        )}
        <span className="mc-event__title">{info.event.title}</span>
        {source?.myStatus === "accepted" && (
          <span className="mc-event__badge" title="You're going">
            ✓<span className="sr-only"> You're going</span>
          </span>
        )}
        {source?.changedSinceRsvp && (
          <span className="mc-event__badge mc-event__badge--warn" title="Changed since you RSVP'd">
            !<span className="sr-only"> Changed since you RSVP'd</span>
          </span>
        )}
      </span>
    );
  }, []);

  const eventClass = useCallback((info: EventDisplayInfo) => {
    const source = info.event.extendedProps.source as CalendarEvent | undefined;
    const chapter = getChapter(source?.chapter);
    return chapter?.virtual ? "mc-fc-event mc-fc-event--virtual" : "mc-fc-event";
  }, []);

  const dayCellClass = useCallback(
    (info: DayCellInfo) =>
      hiddenCounts.get(cellDateKey(info.date)) ? "mc-day--hidden" : undefined,
    [hiddenCounts],
  );

  const dayCellTopContent = useCallback(
    (info: DayCellInfo) => {
      const count = hiddenCounts.get(cellDateKey(info.date)) ?? 0;
      return (
        <span className="mc-daytop">
          <span>{info.dayNumberText}</span>
          {count > 0 && (
            <span className="mc-hidden-badge">
              +{count}
              <span className="sr-only"> {count === 1 ? "event" : "events"} hidden by filter</span>
              <span aria-hidden="true"> hidden</span>
            </span>
          )}
        </span>
      );
    },
    [hiddenCounts],
  );

  const dayHeaderContent = useCallback(
    (info: DayHeaderInfo) => {
      if (!info.view.type.startsWith("timeGrid")) return true;
      const count = hiddenCounts.get(cellDateKey(info.date)) ?? 0;
      return (
        <span className="mc-dayheader">
          <span>{info.text}</span>
          {count > 0 && <span className="mc-hidden-badge">{count} hidden</span>}
        </span>
      );
    },
    [hiddenCounts],
  );

  return (
    <div className="mc-calendar">
      <div className="mc-toolbar">
        <ChapterFilter hidden={hidden} onChange={updateHidden} />
        <div className="mc-toolbar__status" aria-live="polite">
          {loading && <span>Loading events…</span>}
        </div>
      </div>

      {error && (
        <div className="mc-alert mc-alert--error" role="alert">
          {error}{" "}
          <button type="button" className="mc-link-btn" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </div>
      )}

      {hiddenTotal > 0 && (
        <p className="mc-alert mc-alert--info">
          {hiddenTotal} {hiddenTotal === 1 ? "event is" : "events are"} hidden in this view by your
          chapter filter.{" "}
          <button type="button" className="mc-link-btn" onClick={() => updateHidden(new Set())}>
            Show all chapters
          </button>
        </p>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={PLUGINS}
        initialView={initialView}
        headerToolbar={HEADER_TOOLBAR}
        timeZone={CALENDAR_TIME_ZONE}
        height="auto"
        events={eventInputs}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        eventContent={eventContent}
        eventClass={eventClass}
        dayCellClass={dayCellClass}
        dayCellTopContent={dayCellTopContent}
        dayHeaderContent={dayHeaderContent}
        dayMaxEvents={4}
        nowIndicator
      />

      {selected && (
        <EventDialog
          key={selected.id}
          event={selected}
          onClose={closeDialog}
          onUpdated={handleUpdated}
          onAuthError={onAuthError}
        />
      )}
    </div>
  );
}
