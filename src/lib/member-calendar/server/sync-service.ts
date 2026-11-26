/**
 * Detects RSVP changes made directly in Google Calendar (PRD 008, R7.5).
 *
 * Triggered by the events.watch push webhook and the daily cron. It compares
 * a bounded window of events with the last-known status snapshots, records
 * late Yes → other changes, and updates the snapshots. The same diffs drive
 * Discord threads for RSVPs made in Google (PRD 014, R6).
 */
import { jobsForEvent, scheduleDiscordSync, type DiscordSyncJob } from "./discord-sync";
import { memberEnv } from "./env";
import {
  listCalendarEvents,
  stopChannel,
  watchCalendarEvents,
  type GoogleEvent,
} from "./google-api";
import { diffEventSnapshot, normalizeEmail, personAttendees } from "./logic";
import type { LateChangeRecord } from "./records";
import {
  appendLateChanges,
  getMemberNames,
  getSnapshots,
  getStoredChannel,
  setStoredChannel,
  withSyncLock,
  writeSnapshots,
} from "./store";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Past events stay in the window so post-event changes are still caught. */
const SYNC_PAST_DAYS = 30;
const SYNC_FUTURE_DAYS = 120;
const CHANNEL_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function syncRecentEvents(): Promise<{ events: number; lateChanges: number }> {
  const calendarId = memberEnv.calendarId();
  const now = Date.now();
  const timeMin = new Date(now - SYNC_PAST_DAYS * DAY_MS).toISOString();
  const timeMax = new Date(now + SYNC_FUTURE_DAYS * DAY_MS).toISOString();

  return withSyncLock(async () => {
    const events: GoogleEvent[] = await listCalendarEvents(calendarId, timeMin, timeMax);
    const snapshots = await getSnapshots(events.map((e) => e.id));
    const excludedEmails = memberEnv.groupAddresses();
    const names = await getMemberNames(
      events.flatMap((e) =>
        personAttendees(e, calendarId, excludedEmails).map((a) => normalizeEmail(a.email)),
      ),
    );

    const lateChanges: LateChangeRecord[] = [];
    const updates: Parameters<typeof writeSnapshots>[0] = [];
    const discordJobs: DiscordSyncJob[] = [];
    for (const event of events) {
      const diff = diffEventSnapshot({
        event,
        calendarId,
        excludedEmails,
        snapshot: snapshots.get(event.id) ?? new Map(),
        names,
        nowMs: Date.now(),
        windowMinutes: memberEnv.lateChangeWindowMinutes(),
      });
      lateChanges.push(...diff.lateChanges);
      updates.push(...diff.updates);
      discordJobs.push(
        ...jobsForEvent({
          event,
          calendarId,
          previous: snapshots.get(event.id) ?? new Map(),
          updates: diff.updates,
          nowMs: Date.now(),
        }),
      );
    }

    await writeSnapshots(updates);
    await appendLateChanges(lateChanges);
    // After the snapshot write, and after the response (R6.3).
    scheduleDiscordSync(discordJobs, events);
    return { events: events.length, lateChanges: lateChanges.length };
  }, 15_000);
}

/** Creates a fresh push channel and stops the previous one. */
export async function renewWatchChannel(): Promise<{ id: string; expiration: string | null }> {
  const token = memberEnv.webhookToken();
  const origin = memberEnv.siteOrigin();
  if (!token) throw new Error("CALENDAR_WEBHOOK_TOKEN is not set");
  if (!origin.startsWith("https://")) throw new Error("SITE_URL must be an https origin");

  const previous = await getStoredChannel();
  const channel = await watchCalendarEvents(memberEnv.calendarId(), {
    id: crypto.randomUUID(),
    address: `${origin}/api/calendar/webhook`,
    token,
    ttlSeconds: CHANNEL_TTL_SECONDS,
  });
  const expiration = channel.expiration ? new Date(Number(channel.expiration)).toISOString() : null;
  await setStoredChannel({ id: channel.id, resourceId: channel.resourceId, expiration });

  if (previous) {
    await stopChannel({ id: previous.id, resourceId: previous.resourceId }).catch((error) =>
      console.error("[member-calendar] failed to stop previous channel:", error),
    );
  }
  return { id: channel.id, expiration };
}
