/**
 * "Link Discord" control in the signed-in bar (PRD 010, R1.1).
 * Linking is a full-page navigation through Discord; unlinking is a POST.
 */
import { useState } from "react";
import { FaDiscord } from "react-icons/fa6";
import type { DiscordLinkState, DiscordLinkStatus } from "../../lib/member-calendar/types";
import { DISCORD_LINK_START, unlinkDiscord } from "./api";

export const DISCORD_STATUS_MESSAGES: Record<
  DiscordLinkStatus,
  { tone: "ok" | "warn" | "error"; text: string }
> = {
  linked: {
    tone: "ok",
    text: "Discord linked. You'll be added to the Discord thread for events you RSVP Yes or Maybe to, including ones you've already RSVP'd to.",
  },
  unlinked: {
    tone: "ok",
    text: "Discord unlinked. You stay in threads you've already joined; you can leave them in Discord.",
  },
  cancelled: { tone: "warn", text: "Discord linking was cancelled." },
  expired: { tone: "warn", text: "That Discord link attempt expired. Please try again." },
  unavailable: { tone: "warn", text: "Discord linking isn't available right now." },
  error: { tone: "error", text: "Couldn't link Discord. Please try again." },
};

/** Reads and strips `?discord=<status>` left by the link callback. */
export function takeDiscordStatus(): DiscordLinkStatus | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const value = url.searchParams.get("discord");
  if (!value) return null;
  url.searchParams.delete("discord");
  window.history.replaceState(window.history.state, "", url.toString());
  // "unlinked" is set by this page itself, never by a redirect.
  return value in DISCORD_STATUS_MESSAGES && value !== "unlinked"
    ? (value as DiscordLinkStatus)
    : null;
}

interface Props {
  discord: DiscordLinkState;
  onChange: (next: DiscordLinkState, status?: DiscordLinkStatus) => void;
  onError: (message: string) => void;
}

export default function DiscordLinkControl({ discord, onChange, onError }: Props) {
  const [busy, setBusy] = useState(false);

  if (!discord.enabled) return null;

  if (!discord.username) {
    return (
      <a
        className="mc-btn mc-btn--small mc-btn--ghost mc-discord"
        href={DISCORD_LINK_START}
        title="Join each event's Discord thread when you RSVP Yes or Maybe"
      >
        <FaDiscord aria-hidden="true" /> Link Discord
      </a>
    );
  }

  const handleUnlink = async () => {
    setBusy(true);
    try {
      await unlinkDiscord();
      onChange({ ...discord, username: null }, "unlinked");
    } catch (e) {
      onError(e instanceof Error ? e.message : DISCORD_STATUS_MESSAGES.error.text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="mc-discord mc-discord--linked">
      <FaDiscord aria-hidden="true" />
      <span className="mc-discord__name" title="Linked Discord account">
        {discord.username}
      </span>
      <button
        type="button"
        className="mc-btn mc-btn--small mc-btn--ghost"
        onClick={handleUnlink}
        disabled={busy}
        aria-label={`Unlink Discord account ${discord.username}`}
      >
        Unlink
      </button>
    </span>
  );
}
