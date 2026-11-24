/**
 * Discord link/unlink notices for the member calendar (PRD 010, R1.3).
 * The link and unlink actions themselves live in the user menu (PRD 011, R1).
 */
import type { DiscordLinkStatus } from "../../lib/member-calendar/types";

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
