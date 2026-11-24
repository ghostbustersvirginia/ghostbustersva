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
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GENERAL_COLOR,
  GENERAL_TEXT_COLOR,
  getChapter,
  type ChapterKey,
} from "../../lib/member-calendar/chapters";
import {
  CALENDAR_TIME_ZONE,
  dateKeyFor,
  hiddenCountsByDay,
  isEventVisible,
  eventDayKey,
  isPastEvent,
  matchesRsvpFilter,
  matchesSearch,
  RSVP_STATES,
  type RsvpState,
  timeGridHours,
  weekKeyFor,
  weeksWithDays,
  loadHiddenChapters,
  saveHiddenChapters,
} from "../../lib/member-calendar/filters";
import type { CalendarEvent, RsvpResponse, RsvpScope } from "../../lib/member-calendar/types";
import { fetchEvent, fetchEventsRange } from "./api";
import ChapterFilter from "./ChapterFilter";
import ChapterLegend from "./ChapterLegend";
import EventDialog, { VirtualIcon } from "./EventDialog";
import { cellDateKey, eventImageUrl } from "./format";
import SearchResults from "./SearchResults";
import { FaClockRotateLeft, FaMagnifyingGlass, FaMapLocationDot } from "react-icons/fa6";
import RsvpFilterMenu from "./RsvpFilterMenu";
import DistanceMenu from "./DistanceMenu";
import EventHoverCard from "./EventHoverCard";
import MapPanel from "./MapPanel";
import { useHomeLocation, useMapToggle, useVenueCoords } from "./use-geo";
import {
  distanceMiles,
  formatDistance,
  groupVenues,
  isWithin,
  type GeoResult,
  type WithinMiles,
} from "../../lib/member-calendar/geo";
import ListRangeControls from "./ListRangeControls";
import {
  addDays,
  addMonths,
  applyRangeToParams,
  DEFAULT_PRESET,
  presetRange,
  rangeFromParams,
  rangeIgnoresHistory,
  shiftRange,
  type ListRange,
} from "../../lib/member-calendar/list-range";

const MOBILE_QUERY = "(max-width: 768px)";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Search covers the next 12 months, plus the past 6 when past events are shown. */
const SEARCH_FUTURE_DAYS = 365;
const SEARCH_PAST_DAYS = 183;
const MAX_SEARCH_RESULTS = 100;

interface SearchPool {
  includePast: boolean;
  events: CalendarEvent[];
}
const PLUGINS = [formaTheme, dayGridPlugin, timeGridPlugin, listPlugin];
/**
 * List view shows a member-chosen range (PRD 009, R6): presets or a custom range,
 * default the next 6 months. Ranges load in chunks (the API caps 100 days).
 */
const LIST_VIEW = "listRange";
// Custom nav buttons (not FullCalendar's prev/next/today): in list view they move
// the chosen range, which FullCalendar's own buttons can't do.
const HEADER_TOOLBAR = {
  start: "navPrev,navNext navToday",
  center: "title",
  end: `dayGridMonth,timeGridWeek,${LIST_VIEW}`,
};

interface Props {
  onAuthError: (error: unknown) => boolean;
  /** Rendered at the right end of the toolbar: the user menu (PRD 011, R1.1). */
  toolbarEnd?: ReactNode;
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

export default function CalendarView({ onAuthError, toolbarEnd }: Props) {
  const calendarRef = useRef<CalendarRef>(null);
  const [hidden, setHidden] = useState<Set<ChapterKey>>(() => loadHiddenChapters());
  // Past events are hidden until the member turns them on.
  const [showPast, setShowPast] = useState(false);
  // RSVP states to show (your own response); all by default.
  const [rsvpFilter, setRsvpFilter] = useState<Set<RsvpState>>(() => new Set(RSVP_STATES));
  const [search, setSearch] = useState("");
  // Search starts as an icon; the results box, with the field in it, opens on click (PRD 011, R2).
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchBoxId = useId();
  const deferredSearch = useDeferredValue(search);
  const searching = deferredSearch.trim().length > 0;
  /** Esc or the close button clears the search and closes the box (R2.5, D3). */
  const closeSearch = useCallback(() => {
    setSearch("");
    setSearchOpen(false);
    searchButtonRef.current?.focus();
  }, []);
  const [searchPool, setSearchPool] = useState<SearchPool | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [range, setRange] = useState<{ start: Date; end: Date; viewType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [listRange, setListRange] = useState<ListRange>(
    () =>
      rangeFromParams(new URLSearchParams(window.location.search), dateKeyFor(new Date())) ??
      presetRange(DEFAULT_PRESET, dateKeyFor(new Date())),
  );
  const [initialView] = useState(() => {
    // A shared range link opens the list view.
    if (rangeFromParams(new URLSearchParams(window.location.search), dateKeyFor(new Date()))) {
      return LIST_VIEW;
    }
    return window.matchMedia(MOBILE_QUERY).matches ? LIST_VIEW : "dayGridMonth";
  });
  const inListView = (range?.viewType ?? initialView) === LIST_VIEW;
  // A range chosen on purpose shows its past events even with History off (R6.3).
  const historyIgnored = inListView && rangeIgnoresHistory(listRange);
  const includePast = showPast || historyIgnored;

  const views = useMemo(
    () => ({
      [LIST_VIEW]: {
        type: "list",
        visibleRange: { start: listRange.start, end: listRange.end },
      },
    }),
    [listRange.start, listRange.end],
  );

  // In list view, prev/next move the range by its own length and Today restarts
  // it from today; other views navigate as usual.
  const buttons = useMemo(() => {
    const api = () => calendarRef.current?.getApi();
    const listActive = () => api()?.view.type === LIST_VIEW;
    return {
      [LIST_VIEW]: { text: "List" },
      navPrev: {
        text: "‹",
        hint: "Previous",
        click: () => (listActive() ? setListRange((r) => shiftRange(r, -1)) : api()?.prev()),
      },
      navNext: {
        text: "›",
        hint: "Next",
        click: () => (listActive() ? setListRange((r) => shiftRange(r, 1)) : api()?.next()),
      },
      navToday: {
        text: "Today",
        hint: "Go to today",
        click: () => {
          if (!listActive()) return api()?.today();
          const today = dateKeyFor(new Date());
          setListRange((r) =>
            r.preset !== "custom"
              ? presetRange(r.preset, today)
              : {
                  ...r,
                  start: today,
                  end:
                    "months" in r.step
                      ? addMonths(today, r.step.months)
                      : addDays(today, r.step.days),
                },
          );
        },
      },
    };
  }, []);

  // Keep the list range in the URL while the list view is showing (R6.4).
  useEffect(() => {
    const url = new URL(window.location.href);
    applyRangeToParams(url.searchParams, inListView ? listRange : null);
    if (url.toString() !== window.location.href) window.history.replaceState(null, "", url);
  }, [inListView, listRange]);

  // Load events whenever the visible range changes.
  useEffect(() => {
    if (!range) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchEventsRange(range.start, range.end, controller.signal)
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

  const toggleChapter = useCallback(
    (key: ChapterKey) => {
      const next = new Set(hidden);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      updateHidden(next);
    },
    [hidden, updateHidden],
  );

  // Re-evaluate what counts as "past" every few minutes while the page is open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // Wide-range search pool: loaded once per "include past" setting while a
  // search is active, then filtered locally as the query changes.
  useEffect(() => {
    if (!searching) {
      // Drop results when the search is cleared, so the next one loads fresh data.
      setSearchPool(null);
      setSearchError(null);
      return;
    }
    if (searchPool && searchPool.includePast === showPast) return;
    const controller = new AbortController();
    const start = showPast
      ? new Date(Date.now() - SEARCH_PAST_DAYS * DAY_MS)
      : new Date(Date.now() - DAY_MS);
    const end = new Date(Date.now() + SEARCH_FUTURE_DAYS * DAY_MS);
    setSearchLoading(true);
    setSearchError(null);
    fetchEventsRange(start, end, controller.signal)
      .then((list) => setSearchPool({ includePast: showPast, events: list }))
      .catch((e) => {
        if (controller.signal.aborted || onAuthError(e)) return;
        setSearchError(e instanceof Error ? e.message : "Search couldn't load events.");
      })
      .finally(() => !controller.signal.aborted && setSearchLoading(false));
    return () => controller.abort();
  }, [searching, showPast, searchPool, onAuthError]);

  /* --- Maps and home location (PRD 009, R5, R7) ------------------------ */

  const [mapOn, setMapOn] = useMapToggle();
  const { home, setHome, setWithin } = useHomeLocation();
  const within: WithinMiles = home?.within ?? null;
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null);
  // Venues are located while the map is showing or distances are needed.
  const geoEnabled = mapOn || Boolean(home);
  const geoQueries = useMemo(() => {
    const pool = searching && searchPool ? searchPool.events : [];
    return [...events, ...pool].flatMap((e) => (e.mapQuery ? [e.mapQuery] : []));
  }, [events, searching, searchPool]);
  const { coords, error: geoError } = useVenueCoords(geoQueries, geoEnabled);
  const coordsFor = useCallback(
    (event: CalendarEvent): GeoResult | null =>
      event.mapQuery ? (coords.get(event.mapQuery) ?? null) : null,
    [coords],
  );
  const distanceFor = useCallback(
    (event: CalendarEvent): string | null => {
      const at = coordsFor(event);
      return home && at ? formatDistance(distanceMiles(home, at)) : null;
    },
    [coordsFor, home],
  );
  const passesWithin = useCallback(
    (event: CalendarEvent) => isWithin(coordsFor(event), home, within),
    [coordsFor, home, within],
  );

  const searchMatches = useMemo(() => {
    if (!searching || !searchPool || searchPool.includePast !== showPast) return [];
    return searchPool.events.filter(
      (e) =>
        matchesSearch(e, deferredSearch) &&
        (showPast || !isPastEvent(e, now)) &&
        passesWithin(e) &&
        matchesRsvpFilter(e, rsvpFilter),
    );
  }, [searching, searchPool, showPast, deferredSearch, now, passesWithin, rsvpFilter]);
  const searchResults = useMemo(
    () => searchMatches.filter((e) => isEventVisible(e, hidden)),
    [searchMatches, hidden],
  );

  const openEvent = useCallback((event: CalendarEvent) => {
    calendarRef.current?.getApi().gotoDate(event.start.slice(0, 10));
    setSelected(event);
    writeEventParam(event.id);
  }, []);

  // Filters apply in order: search, past-events toggle, then chapters. The
  // chapter filter's "+N hidden" markers only count events that pass the first two.
  const searchedEvents = useMemo(
    () => (searching ? events.filter((e) => matchesSearch(e, deferredSearch)) : events),
    [events, deferredSearch, searching],
  );
  const timeFilteredEvents = useMemo(
    () => (includePast ? searchedEvents : searchedEvents.filter((e) => !isPastEvent(e, now))),
    [searchedEvents, includePast, now],
  );
  // "Within N miles" (R7.4) applies before the chapter filter.
  // "Within N miles" (R7.4) and the RSVP filter apply before the chapter filter.
  const nearbyEvents = useMemo(
    () =>
      timeFilteredEvents.filter(
        (e) => (!within || passesWithin(e)) && matchesRsvpFilter(e, rsvpFilter),
      ),
    [timeFilteredEvents, within, passesWithin, rsvpFilter],
  );
  const visibleEvents = useMemo(
    () => nearbyEvents.filter((e) => isEventVisible(e, hidden)),
    [nearbyEvents, hidden],
  );
  const eventInputs = useMemo(() => visibleEvents.map(toEventInput), [visibleEvents]);
  const hiddenCounts = useMemo(
    () => hiddenCountsByDay(nearbyEvents, hidden),
    [nearbyEvents, hidden],
  );
  const hiddenTotal = nearbyEvents.length - visibleEvents.length;

  // Map panel data: the visible events grouped by venue (R5.2, R5.5).
  const mapData = useMemo(() => {
    const located: { event: CalendarEvent; geo: GeoResult }[] = [];
    let unmappable = 0;
    let locating = 0;
    for (const event of visibleEvents) {
      if (!event.mapQuery) {
        unmappable++;
        continue;
      }
      if (!coords.has(event.mapQuery)) {
        locating++;
        continue;
      }
      const geo = coords.get(event.mapQuery);
      if (geo) located.push({ event, geo });
      else unmappable++;
    }
    return { venues: groupVenues(located), mapped: located.length, unmappable, locating };
  }, [visibleEvents, coords]);

  // Month view hides past weeks with nothing to show. A week with only
  // filtered-out events stays, so its "+N hidden" marker is still visible.
  const activeWeeks = useMemo(
    () => weeksWithDays([...visibleEvents.map(eventDayKey), ...hiddenCounts.keys()]),
    [visibleEvents, hiddenCounts],
  );
  // Week view trims empty hours before the first and after the last event.
  const weekHours = useMemo(() => timeGridHours(visibleEvents), [visibleEvents]);
  // Only empty weeks before the current week are hidden; this week and later always show.
  const currentWeek = weekKeyFor(dateKeyFor(now));
  const monthIsEmpty =
    range?.viewType === "dayGridMonth" &&
    visibleEvents.length === 0 &&
    hiddenTotal === 0 &&
    !loading;

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

  /* --- Hover card for month/week events (PRD 009, R3) ------------------ */

  const hoverCardId = useId();
  const [hover, setHover] = useState<{ event: CalendarEvent; anchor: HTMLElement } | null>(null);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const listeners = useRef(new WeakMap<HTMLElement, AbortController>());

  const cancelHoverTimers = useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  }, []);

  const hideHover = useCallback(() => {
    cancelHoverTimers();
    setHover(null);
  }, [cancelHoverTimers]);

  const scheduleShow = useCallback(
    (event: CalendarEvent, anchor: HTMLElement) => {
      cancelHoverTimers();
      showTimer.current = window.setTimeout(() => setHover({ event, anchor }), 300);
    },
    [cancelHoverTimers],
  );

  // A short grace period lets the pointer move from the event onto the card.
  const scheduleHide = useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHover(null), 150);
  }, []);

  const eventDidMount = useCallback(
    (info: EventDisplayInfo & { el: HTMLElement }) => {
      const source = info.event.extendedProps.source as CalendarEvent | undefined;
      if (!source) return;
      const el = info.el;
      // Highlight the event's map marker while the pointer is over it (R5.6).
      const highlight = new AbortController();
      el.addEventListener("pointerenter", () => setHighlightEventId(source.id), {
        signal: highlight.signal,
      });
      el.addEventListener("pointerleave", () => setHighlightEventId(null), {
        signal: highlight.signal,
      });
      listeners.current.set(el, highlight);
      if (info.view.type === LIST_VIEW) return;
      const controller = new AbortController();
      const { signal } = controller;
      // Mouse and pen only: a touch tap opens the dialog instead (R3.5).
      el.addEventListener(
        "pointerenter",
        (e) => e.pointerType !== "touch" && scheduleShow(source, el),
        { signal },
      );
      el.addEventListener("pointerleave", scheduleHide, { signal });
      // Keyboard focus also shows the card (R3.1).
      el.addEventListener(
        "focusin",
        () => el.matches(":focus-visible") && scheduleShow(source, el),
        { signal },
      );
      el.addEventListener("focusout", scheduleHide, { signal });
      // Abort both sets of listeners together on unmount.
      highlight.signal.addEventListener("abort", () => controller.abort());
      listeners.current.set(el, highlight);
    },
    [scheduleShow, scheduleHide],
  );

  const eventWillUnmount = useCallback((info: { el: HTMLElement }) => {
    listeners.current.get(info.el)?.abort();
    listeners.current.delete(info.el);
  }, []);

  // While the card shows: describe the event with it, close on Escape, and
  // close on scroll or resize (the card is positioned to the viewport).
  useEffect(() => {
    if (!hover) return;
    const { anchor } = hover;
    anchor.setAttribute("aria-describedby", hoverCardId);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hideHover();
    const onMove = () => hideHover();
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, { capture: true, passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      anchor.removeAttribute("aria-describedby");
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
    };
  }, [hover, hoverCardId, hideHover]);

  useEffect(() => cancelHoverTimers, [cancelHoverTimers]);

  const handleEventClick = useCallback(
    (info: EventClickInfo) => {
      info.jsEvent.preventDefault();
      hideHover();
      const source = info.event.extendedProps.source as CalendarEvent | undefined;
      if (!source) return;
      setSelected(source);
      writeEventParam(source.id);
    },
    [hideHover],
  );

  const closeDialog = useCallback(() => {
    setSelected(null);
    writeEventParam(null);
  }, []);

  const handleUpdated = useCallback((result: RsvpResponse, scope: RsvpScope) => {
    setSelected(result.event);
    setEvents((list) => list.map((e) => (e.id === result.event.id ? result.event : e)));
    setSearchPool((pool) =>
      pool
        ? {
            ...pool,
            events: pool.events.map((e) => (e.id === result.event.id ? result.event : e)),
          }
        : pool,
    );
    if (scope === "following" && result.applied.length > 1) setSearchPool(null);
    // Other instances changed too; reload them.
    if (scope === "following" && result.applied.length > 1) setReloadKey((k) => k + 1);
  }, []);

  const eventContent = useCallback((info: EventDisplayInfo) => {
    const source = info.event.extendedProps.source as CalendarEvent | undefined;
    const chapter = getChapter(source?.chapter);
    // List view: chips, then the hero image, then the title (PRD 009, R2.1).
    if (info.view.type === LIST_VIEW && source?.image) {
      const small = eventImageUrl(source, 320);
      const medium = eventImageUrl(source, 640);
      return (
        <span className="mc-event mc-event--stacked">
          <span className="mc-event__meta">
            {info.timeText && <span className="mc-event__time">{info.timeText}</span>}
            <span className="mc-event__chapter">
              {chapter?.virtual && <VirtualIcon />}
              {chapter?.label ?? "General"}
            </span>
            {source.interest && (
              <span className="mc-event__interest" title="Gauging interest">
                Interest
              </span>
            )}
            {source.myStatus === "accepted" && (
              <span className="mc-event__badge" title="You're going">
                ✓<span className="sr-only"> You're going</span>
              </span>
            )}
            {source.changedSinceRsvp && (
              <span
                className="mc-event__badge mc-event__badge--warn"
                title="Changed since you RSVP'd"
              >
                !<span className="sr-only"> Changed since you RSVP'd</span>
              </span>
            )}
          </span>
          {small && medium && (
            <img
              className="mc-event__image"
              src={medium}
              srcSet={`${small} 320w, ${medium} 640w`}
              sizes="(max-width: 768px) 100vw, 640px"
              // Decorative here: the title follows in the same button.
              alt=""
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
          )}
          <span className="mc-event__title">{info.event.title}</span>
        </span>
      );
    }
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
    (info: DayCellInfo) => {
      const key = cellDateKey(info.date);
      const classes = [];
      if (hiddenCounts.get(key)) classes.push("mc-day--hidden");
      const week = weekKeyFor(key);
      if (info.view.type === "dayGridMonth" && week < currentWeek && !activeWeeks.has(week)) {
        classes.push("mc-week--empty");
      }
      return classes.join(" ") || undefined;
    },
    [hiddenCounts, activeWeeks, currentWeek],
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
        <div className="mc-togglebar">
          <button
            ref={searchButtonRef}
            type="button"
            className={`mc-togglebar__btn${searching ? " is-active" : ""}`}
            aria-expanded={searchOpen}
            aria-controls={searchOpen ? searchBoxId : undefined}
            title={searchOpen ? "Close search" : "Search events"}
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            <FaMagnifyingGlass aria-hidden="true" />
            <span className="mc-togglebar__label">Search</span>
            {searching && <span className="sr-only">, active</span>}
          </button>
        </div>
        <div className="mc-togglebar" role="group" aria-label="Show">
          <button
            type="button"
            className="mc-togglebar__btn"
            aria-pressed={includePast}
            disabled={historyIgnored}
            title={
              historyIgnored
                ? "Past events in the chosen range always show"
                : includePast
                  ? "Hide past events"
                  : "Show past events"
            }
            onClick={() => setShowPast(!showPast)}
          >
            <FaClockRotateLeft aria-hidden="true" />
            <span className="mc-togglebar__label">History</span>
          </button>
          <button
            type="button"
            className="mc-togglebar__btn"
            aria-pressed={mapOn}
            title={mapOn ? "Hide the map" : "Show the map"}
            onClick={() => setMapOn(!mapOn)}
          >
            <FaMapLocationDot aria-hidden="true" />
            <span className="mc-togglebar__label">Map</span>
          </button>
        </div>
        <RsvpFilterMenu shown={rsvpFilter} onChange={setRsvpFilter} />
        {home && <DistanceMenu within={within} onChange={setWithin} />}
        <ChapterFilter hidden={hidden} onChange={updateHidden} />
        {inListView && <ListRangeControls range={listRange} onChange={setListRange} />}
        <div className="mc-toolbar__status" aria-live="polite">
          {loading && <span>Loading events…</span>}
        </div>
        {toolbarEnd}
      </div>

      {error && (
        <div className="mc-alert mc-alert--error" role="alert">
          {error}{" "}
          <button type="button" className="mc-link-btn" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </div>
      )}

      {searchOpen && (
        <SearchResults
          id={searchBoxId}
          value={search}
          onValueChange={setSearch}
          query={deferredSearch.trim()}
          results={searchResults.slice(0, MAX_SEARCH_RESULTS)}
          total={searchResults.length}
          hiddenByChapter={searchMatches.length - searchResults.length}
          includePast={showPast}
          loading={searchLoading || !searchPool || searchPool.includePast !== showPast}
          error={searchError}
          onSelect={openEvent}
          onShowPast={() => setShowPast(true)}
          onShowAllChapters={() => updateHidden(new Set())}
          onClose={closeSearch}
        />
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

      {monthIsEmpty && (
        <p className="mc-alert mc-alert--info">
          No events this month{showPast ? "" : " (past events are hidden)"}.
        </p>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={PLUGINS}
        initialView={initialView}
        headerToolbar={HEADER_TOOLBAR}
        views={views}
        buttons={buttons}
        timeZone={CALENDAR_TIME_ZONE}
        height="auto"
        events={eventInputs}
        eventDisplay="block"
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        eventDidMount={eventDidMount}
        eventWillUnmount={eventWillUnmount}
        eventContent={eventContent}
        eventClass={eventClass}
        dayCellClass={dayCellClass}
        dayCellTopContent={dayCellTopContent}
        dayHeaderContent={dayHeaderContent}
        dayMaxEvents={4}
        slotMinTime={weekHours.slotMinTime}
        slotMaxTime={weekHours.slotMaxTime}
        nowIndicator
      />

      {hover && !selected && (
        <EventHoverCard
          id={hoverCardId}
          event={hover.event}
          anchor={hover.anchor}
          onPointerEnter={() => window.clearTimeout(hideTimer.current)}
          onPointerLeave={scheduleHide}
          distance={distanceFor(hover.event)}
        />
      )}

      {mapOn && (
        <MapPanel
          venues={mapData.venues}
          mappedCount={mapData.mapped}
          unmappableCount={mapData.unmappable}
          locating={mapData.locating > 0 && !geoError}
          error={geoError}
          home={home}
          onHomeChange={setHome}
          highlightEventId={highlightEventId}
          onSelectEvent={openEvent}
        />
      )}

      <ChapterLegend hidden={hidden} onToggle={toggleChapter} />

      {selected && (
        <EventDialog
          key={selected.id}
          event={selected}
          onClose={closeDialog}
          onUpdated={handleUpdated}
          onAuthError={onAuthError}
          home={home}
          distance={distanceFor(selected)}
        />
      )}
    </div>
  );
}
