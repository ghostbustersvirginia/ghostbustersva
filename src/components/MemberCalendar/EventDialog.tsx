import { useEffect, useRef, useState } from "react";
import { getChapter, GENERAL_LABEL } from "../../lib/member-calendar/chapters";
import type {
  CalendarEvent,
  GoogleResponseStatus,
  RsvpChoice,
  RsvpResponse,
  RsvpScope,
} from "../../lib/member-calendar/types";
import { sendRsvp } from "./api";
import { eventImageUrl, formatEventWhen, formatShortDate, STATUS_LABEL } from "./format";
import EventLocation from "./EventLocation";

interface Props {
  event: CalendarEvent;
  onClose: () => void;
  onUpdated: (result: RsvpResponse, scope: RsvpScope) => void;
  onAuthError: (error: unknown) => boolean;
}

const CHOICES: { value: Exclude<RsvpChoice, "remove">; label: string }[] = [
  { value: "accepted", label: "Yes" },
  { value: "tentative", label: "Maybe" },
  { value: "declined", label: "No" },
];

const GROUPS: { status: GoogleResponseStatus; label: string }[] = [
  { status: "accepted", label: "Going" },
  { status: "tentative", label: "Maybe" },
  { status: "declined", label: "Not going" },
];

/** Event details and RSVP (PRD 008, R5, R6). */
export default function EventDialog({ event, onClose, onUpdated, onAuthError }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [scope, setScope] = useState<RsvpScope>("single");
  const [pending, setPending] = useState<RsvpChoice | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    setMessage(null);
    setScope("single");
  }, [event.id]);

  const chapter = getChapter(event.chapter);
  const isRecurring = Boolean(event.recurringEventId);

  async function submit(choice: RsvpChoice) {
    setPending(choice);
    setMessage(null);
    try {
      const result = await sendRsvp(event.id, choice, isRecurring ? scope : "single");
      onUpdated(result, isRecurring ? scope : "single");
      const label = choice === "remove" ? "RSVP removed" : `RSVP saved: ${STATUS_LABEL[choice]}`;
      if (result.failed.length > 0) {
        setMessage({
          kind: "error",
          text: `${label}, but these dates couldn't be updated: ${result.failed
            .map((f) => formatShortDate(f.start))
            .join(", ")}. Try them individually.`,
        });
      } else if (scope === "following" && isRecurring && result.appliedThrough) {
        setMessage({
          kind: "ok",
          text: `${label} for this and following events, through ${formatShortDate(result.appliedThrough)}.`,
        });
      } else {
        setMessage({ kind: "ok", text: `${label}.` });
      }
    } catch (error) {
      if (onAuthError(error)) return;
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Your RSVP couldn't be saved.",
      });
    } finally {
      setPending(null);
    }
  }

  const titleId = `mc-dialog-title-${event.id}`;

  return (
    <dialog
      ref={dialogRef}
      className="mc-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className="mc-dialog__body">
        <header className="mc-dialog__header">
          <span
            className={`mc-chip${chapter?.virtual ? " mc-chip--virtual" : ""}`}
            style={
              chapter ? { backgroundColor: chapter.color, color: chapter.textColor } : undefined
            }
          >
            {chapter?.virtual && <VirtualIcon />}
            {chapter?.label ?? GENERAL_LABEL}
          </span>
          {event.interest && <span className="mc-chip mc-chip--interest">Interest</span>}
          <span className="mc-dialog__spacer" />
          <button
            type="button"
            className="mc-dialog__close"
            aria-label="Close event details"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </header>

        {event.image && (
          <img
            className="mc-dialog__image"
            src={eventImageUrl(event, 1200) ?? undefined}
            srcSet={`${eventImageUrl(event, 640)} 640w, ${eventImageUrl(event, 1200)} 1200w`}
            sizes="(max-width: 700px) 100vw, 640px"
            alt={event.title}
            decoding="async"
            onError={(e) => {
              e.currentTarget.hidden = true;
            }}
          />
        )}

        <h2 id={titleId} className="mc-dialog__title">
          {event.title}
        </h2>
        <p className="mc-dialog__when">{formatEventWhen(event)}</p>
        {event.interest && (
          <p className="mc-alert mc-alert--info">
            This event is gauging interest. RSVP to let the organizers know if you'd join.
          </p>
        )}
        {(event.location || event.mapUrl) && <EventLocation event={event} />}

        {event.changedSinceRsvp && (
          <div className="mc-alert mc-alert--warn" role="status">
            <strong>Changed since you RSVP'd.</strong> The time, place or title was updated.
            {event.myStatus && event.myStatus !== "needsAction" && (
              <>
                {" "}
                <button
                  type="button"
                  className="mc-link-btn"
                  disabled={pending !== null}
                  onClick={() => submit(event.myStatus as RsvpChoice)}
                >
                  Confirm my RSVP ({STATUS_LABEL[event.myStatus]})
                </button>
              </>
            )}
          </div>
        )}

        {event.descriptionHtml && (
          <div
            className="mc-dialog__description"
            // Sanitized server-side with an allowlist (R8).
            dangerouslySetInnerHTML={{ __html: event.descriptionHtml }}
          />
        )}

        {event.htmlLink && (
          <p>
            <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
              View in Google Calendar<span className="sr-only"> (opens in new tab)</span>
            </a>
          </p>
        )}

        <section className="mc-rsvp" aria-label="RSVP">
          <h3 className="mc-rsvp__title">Your RSVP</h3>
          {event.rsvpAllowed ? (
            <>
              {isRecurring && (
                <fieldset className="mc-rsvp__scope">
                  <legend className="sr-only">Apply RSVP to</legend>
                  <label>
                    <input
                      type="radio"
                      name={`scope-${event.id}`}
                      checked={scope === "single"}
                      onChange={() => setScope("single")}
                    />{" "}
                    This event only
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`scope-${event.id}`}
                      checked={scope === "following"}
                      onChange={() => setScope("following")}
                    />{" "}
                    This and following events
                  </label>
                </fieldset>
              )}
              <div className="mc-rsvp__buttons" role="group" aria-label="RSVP choices">
                {CHOICES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`mc-btn mc-rsvp__btn${event.myStatus === c.value ? " is-current" : ""}`}
                    aria-pressed={event.myStatus === c.value}
                    disabled={pending !== null}
                    onClick={() => submit(c.value)}
                  >
                    {pending === c.value ? "Saving…" : c.label}
                  </button>
                ))}
                {event.myStatus && (
                  <button
                    type="button"
                    className="mc-btn mc-btn--ghost mc-rsvp__btn"
                    disabled={pending !== null}
                    onClick={() => submit("remove")}
                  >
                    {pending === "remove" ? "Removing…" : "Remove RSVP"}
                  </button>
                )}
              </div>
              <p className="mc-rsvp__note">
                Changing a Yes within 2 hours of the start time is recorded for organizers.
              </p>
            </>
          ) : (
            <p className="mc-alert mc-alert--info">{event.rsvpBlockedReason}</p>
          )}
          <div aria-live="polite">
            {message && (
              <p className={`mc-alert mc-alert--${message.kind === "ok" ? "ok" : "error"}`}>
                {message.text}
              </p>
            )}
          </div>
        </section>

        <section className="mc-attendees" aria-label="Who's going">
          <h3 className="mc-rsvp__title">
            Who's going{" "}
            <span className="mc-attendees__counts">
              {event.counts.yes} yes · {event.counts.maybe} maybe · {event.counts.no} no
            </span>
          </h3>
          {GROUPS.map((group) => {
            const people = event.attendees.filter((a) => a.status === group.status);
            if (people.length === 0) return null;
            return (
              <div key={group.status} className="mc-attendees__group">
                <h4>{group.label}</h4>
                <ul>
                  {people.map((p, i) => (
                    <li key={`${p.name}-${i}`}>
                      {p.name}
                      {p.isMe && " (you)"}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {event.attendees.length === 0 && <p className="mc-panel__fine">No RSVPs yet.</p>}
        </section>
      </div>
    </dialog>
  );
}

export function VirtualIcon() {
  return (
    <svg
      className="mc-virtual-icon"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      role="img"
      aria-label="Virtual event"
    >
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="9"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M5 14h6M8 11.5V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
