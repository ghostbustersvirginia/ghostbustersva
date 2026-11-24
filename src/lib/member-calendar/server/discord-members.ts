/**
 * Adding linked members to event threads (PRD 010, R4).
 *
 * Adds are idempotent on Discord's side, so repeat RSVPs and several instances
 * of one series are harmless. Every failure is logged with the series key and
 * Discord error code and then skipped (R5.2, R5.3); nothing here throws.
 */
import { addThreadMember, DiscordErrorCode, isDiscordError, unarchiveThread } from "./discord";
import { getDiscordLink, getMemberSeries } from "./discord-store";
import { forgetThreadRecord, getThreadRecords, type ThreadRecord } from "./discord-threads";

/** "thread-gone": the thread was deleted in Discord and its record has been dropped. */
export type AddResult = "added" | "not-in-server" | "thread-gone" | "failed";

/** DiscordApiError messages already carry the HTTP status and Discord code (R5.2). */
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Adds a Discord user to the series' thread. An archived thread is reopened and
 * the add tried once more (R4.4). A user who isn't in the server is skipped (R4.5).
 */
export async function addMemberToThread(
  seriesKey: string,
  thread: ThreadRecord,
  discordId: string,
): Promise<AddResult> {
  try {
    try {
      await addThreadMember(thread.threadId, discordId);
    } catch (error) {
      if (!isDiscordError(error, DiscordErrorCode.ThreadArchived)) throw error;
      await unarchiveThread(thread.threadId);
      await addThreadMember(thread.threadId, discordId);
    }
    return "added";
  } catch (error) {
    if (isDiscordError(error, DiscordErrorCode.UnknownChannel)) {
      console.error(`[discord] thread for ${seriesKey} was deleted; dropping its record`);
      await forgetThreadRecord(seriesKey, thread.threadId);
      return "thread-gone";
    }
    if (
      isDiscordError(error, DiscordErrorCode.UnknownMember) ||
      isDiscordError(error, DiscordErrorCode.UnknownUser)
    ) {
      console.error(`[discord] member not in server, skipped thread for ${seriesKey}`);
      return "not-in-server";
    }
    console.error(`[discord] adding member to thread for ${seriesKey} failed: ${describe(error)}`);
    return "failed";
  }
}

/** Adds the member if they've linked Discord; otherwise the backfill picks it up later. */
export async function addLinkedMember(
  email: string,
  seriesKey: string,
  thread: ThreadRecord,
): Promise<AddResult | "not-linked"> {
  const link = await getDiscordLink(email);
  if (!link) return "not-linked";
  return addMemberToThread(seriesKey, thread, link.id);
}

/**
 * Backfill on link (R4.3): adds the member to every existing thread for a series
 * they RSVP'd Yes/Maybe to. One series at a time, so Discord rate limits apply
 * per request as usual. Series without a thread yet are skipped.
 */
export async function backfillMemberThreads(email: string, discordId: string): Promise<number> {
  const series = await getMemberSeries(email);
  if (series.length === 0) return 0;
  const records = await getThreadRecords(series);
  let added = 0;
  for (const key of series) {
    const thread = records.get(key);
    if (!thread) continue;
    if ((await addMemberToThread(key, thread, discordId)) === "added") added++;
  }
  return added;
}
