/**
 * Account menu at the right end of the toolbar (PRD 011, R1). Replaces the
 * signed-in bar: the member's name, their Discord link, then the actions.
 */
import { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaDiscord, FaRegUser } from "react-icons/fa6";
import type { DiscordLinkState, DiscordLinkStatus } from "../../lib/member-calendar/types";
import {
  UPDATING_CALENDAR,
  updateCalendarNotice,
  type Notice,
} from "../../lib/member-calendar/update-calendar";
import { DISCORD_LINK_START, unlinkDiscord, updateMyCalendar } from "./api";
import { DISCORD_STATUS_MESSAGES } from "./discord-status";

const LATE_CHANGES_CSV = "/api/calendar/late-changes.csv";

interface Props {
  name: string;
  isOrganizer: boolean;
  discord: DiscordLinkState;
  onDiscordChange: (next: DiscordLinkState, status?: DiscordLinkStatus) => void;
  onDiscordError: (message: string) => void;
  /** Progress and results of "Update My Calendar" (PRD 012, R4). */
  onNotice: (notice: Notice | null) => void;
  onSignOut: () => void;
}

export default function UserMenu({
  name,
  isOrganizer,
  discord,
  onDiscordChange,
  onDiscordError,
  onNotice,
  onSignOut,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Close on an outside click, or on Esc with focus back on the icon (R1.5).
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

  const close = () => {
    if (detailsRef.current) detailsRef.current.open = false;
  };

  const handleUnlink = async () => {
    setBusy(true);
    try {
      await unlinkDiscord();
      onDiscordChange({ ...discord, username: null }, "unlinked");
      close();
    } catch (e) {
      onDiscordError(e instanceof Error ? e.message : DISCORD_STATUS_MESSAGES.error.text);
    } finally {
      setBusy(false);
    }
  };

  // It can take a while, so the menu closes and the page shows progress.
  const handleUpdateCalendar = async () => {
    close();
    setUpdating(true);
    onNotice({ tone: "ok", text: UPDATING_CALENDAR });
    try {
      onNotice(updateCalendarNotice(await updateMyCalendar()));
    } catch (e) {
      onNotice({
        tone: "error",
        text: e instanceof Error ? e.message : "Couldn't update your calendar. Try again later.",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <details ref={detailsRef} className="mc-togglebar mc-menu mc-user">
      <summary className="mc-togglebar__btn" title="Account" aria-label={`Account menu, ${name}`}>
        <FaRegUser aria-hidden="true" />
        <FaChevronDown aria-hidden="true" className="mc-menu__chevron" />
      </summary>
      <div className="mc-user__panel">
        <p className="mc-user__name">{name}</p>
        {discord.enabled &&
          (discord.username ? (
            <p className="mc-user__discord">
              <FaDiscord aria-hidden="true" />
              <span className="mc-user__discord-name">
                <span className="sr-only">Discord: </span>
                {discord.username}
              </span>
            </p>
          ) : (
            <a className="mc-user__item mc-user__discord" href={DISCORD_LINK_START}>
              <FaDiscord aria-hidden="true" /> Link Discord
            </a>
          ))}
        <hr className="mc-user__sep" />
        <button
          type="button"
          className="mc-user__item"
          onClick={handleUpdateCalendar}
          disabled={updating}
          title="Send Google Calendar invitations for your upcoming Yes and Maybe RSVPs"
        >
          {updating ? "Updating My Calendar…" : "Update My Calendar"}
        </button>
        {discord.enabled && discord.username && (
          <button type="button" className="mc-user__item" onClick={handleUnlink} disabled={busy}>
            Unlink Discord
          </button>
        )}
        {isOrganizer && (
          <a className="mc-user__item" href={LATE_CHANGES_CSV} download onClick={close}>
            Export Late Changes
          </a>
        )}
        <button
          type="button"
          className="mc-user__item"
          onClick={() => {
            close();
            onSignOut();
          }}
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
