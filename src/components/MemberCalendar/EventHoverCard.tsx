import { useLayoutEffect, useRef, useState } from "react";
import { getChapter, GENERAL_LABEL } from "../../lib/member-calendar/chapters";
import { isUrlLocation } from "../../lib/member-calendar/locations";
import type { CalendarEvent } from "../../lib/member-calendar/types";
import { VirtualIcon } from "./EventDialog";
import { eventImageUrl, formatEventWhen, STATUS_LABEL } from "./format";
import { placeHoverCard, type Placement } from "./hover-position";

interface Props {
  id: string;
  event: CalendarEvent;
  anchor: HTMLElement;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

/**
 * Preview card for month/week events (PRD 009, R3): image, chips, title, time,
 * place, your RSVP and counts. Display only; clicking the event opens the dialog.
 */
export default function EventHoverCard({
  id,
  event,
  anchor,
  onPointerEnter,
  onPointerLeave,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const chapter = getChapter(event.chapter);
  const image = eventImageUrl(event, 320);
  const place = event.location && !isUrlLocation(event.location) ? event.location : event.mapLabel;

  useLayoutEffect(() => {
    const card = ref.current;
    if (!card) return;
    const position = () => {
      const a = anchor.getBoundingClientRect();
      setPlacement(
        placeHoverCard(
          { top: a.top, left: a.left, width: a.width, height: a.height },
          { width: card.offsetWidth, height: card.offsetHeight },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    };
    position();
    // Re-place once the image has its height.
    const img = card.querySelector("img");
    img?.addEventListener("load", position);
    return () => img?.removeEventListener("load", position);
  }, [anchor, event.id]);

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={`mc-hovercard${placement ? ` mc-hovercard--${placement.side}` : ""}`}
      style={
        placement
          ? { top: placement.top, left: placement.left }
          : { top: 0, left: 0, visibility: "hidden" }
      }
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {image && (
        <img
          className="mc-hovercard__image"
          src={image}
          alt=""
          decoding="async"
          onError={(e) => {
            e.currentTarget.hidden = true;
          }}
        />
      )}
      <div className="mc-hovercard__body">
        <div className="mc-hovercard__chips">
          <span
            className={`mc-chip mc-chip--small${chapter?.virtual ? " mc-chip--virtual" : ""}`}
            style={
              chapter ? { backgroundColor: chapter.color, color: chapter.textColor } : undefined
            }
          >
            {chapter?.virtual && <VirtualIcon />}
            {chapter?.label ?? GENERAL_LABEL}
          </span>
          {event.interest && (
            <span className="mc-chip mc-chip--small mc-chip--interest">Interest</span>
          )}
        </div>
        <p className="mc-hovercard__title">{event.title}</p>
        <p className="mc-hovercard__line">{formatEventWhen(event)}</p>
        {place && <p className="mc-hovercard__line">{place}</p>}
        <p className="mc-hovercard__line mc-hovercard__rsvp">
          {event.myStatus && event.myStatus !== "needsAction" && (
            <strong>You: {STATUS_LABEL[event.myStatus]} · </strong>
          )}
          {event.counts.yes} yes · {event.counts.maybe} maybe · {event.counts.no} no
        </p>
      </div>
    </div>
  );
}
