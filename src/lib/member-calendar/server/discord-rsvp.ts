/**
 * Discord side effects of a site RSVP (PRD 010, R2.1, R5.1).
 *
 * Runs after the RSVP response is ready, via waitUntil, so an RSVP never fails
 * or slows down because of Discord. Only site RSVPs call this; Google-side
 * RSVPs are out of scope for v1.
 */
import { waitUntil } from "@vercel/functions";
import type { RsvpChoice } from "../types";
import { addLinkedMember } from "./discord-members";
import { addMemberSeries, removeMemberSeries } from "./discord-store";
import { ensureEventThread, seriesKey } from "./discord-threads";
import { memberEnv } from "./env";
import type { GoogleEvent } from "./google-api";

export interface SiteRsvp {
  /** The RSVP'd occurrence, as Google returned it after the patch. */
  event: GoogleEvent;
  choice: RsvpChoice;
  email: string;
}

const JOINS_THREAD: readonly RsvpChoice[] = ["accepted", "tentative"];

export async function runDiscordAfterRsvp(rsvp: SiteRsvp): Promise<void> {
  const key = seriesKey(rsvp.event);

  if (!JOINS_THREAD.includes(rsvp.choice)) {
    // No or removed RSVPs do nothing on Discord in v1 (R4.2). The series stays
    // tracked after a No. A removed RSVP on a one-off event leaves no Yes/Maybe
    // anywhere, so it's dropped; a series may still have Yes/Maybe on other
    // instances, so it stays.
    if (rsvp.choice === "remove" && !rsvp.event.recurringEventId) {
      await removeMemberSeries(rsvp.email, key);
    }
    return;
  }

  // Track first, so a member who links later is backfilled even if the thread
  // can't be made right now (R4.1, R4.3).
  await addMemberSeries(rsvp.email, key);
  const thread = await ensureEventThread(rsvp.event);
  if (!thread) return;
  if ((await addLinkedMember(rsvp.email, key, thread)) !== "thread-gone") return;

  // The thread was deleted in Discord: make a new one, once.
  const fresh = await ensureEventThread(rsvp.event);
  if (fresh) await addLinkedMember(rsvp.email, key, fresh);
}

/** Fire-and-forget wrapper for the RSVP route. */
export function scheduleDiscordAfterRsvp(rsvp: SiteRsvp): void {
  if (!memberEnv.discordEnabled()) return;
  waitUntil(
    runDiscordAfterRsvp(rsvp).catch((error) => {
      console.error("[discord] RSVP side effects failed:", error);
    }),
  );
}
