# PRD 014: Discord Integration v2

**Status:** implemented
**Author:** Jonathan Cook
**Date:** 2026-11-25

## Goal

Keep each event's Discord thread up to date. [PRD 010](010-calendar-discord-integration.md)
(v1) creates one thread per event series, posts a starter message once, and adds linked
members on a Yes/Maybe site RSVP. After that, the thread never changes.

v2 makes the starter message a live summary of the event. It shows the current RSVP
counts, refreshed whenever RSVPs change, and the current title, time and location. v2
also covers the items v1 deferred:

- posting when an event changes or is cancelled;
- removing a member from the thread when they remove their RSVP;
- handling RSVPs made in Google Calendar.

## Background

What v1 does today (`src/lib/member-calendar/server/discord-*.ts`):

- `ensureEventThread` creates the thread under a Redis lock and posts `starterMessage(event)`
  with `postMessage`. **It doesn't keep the message ID**, so the message can't be edited
  later.
- `ThreadRecord` (`discord-thread:{seriesKey}`) is `{ threadId, url, createdAt }`.
- `runDiscordAfterRsvp` runs through `waitUntil` after a site RSVP. A No or removed RSVP
  does nothing on Discord.
- `syncRecentEvents` (the Google push webhook and the daily cron) diffs attendee status
  snapshots for RSVPs made in Google Calendar. It never calls Discord.
- The event feed already computes `counts: { yes, maybe, no }` in `normalizeEvent`, using
  `personAttendees` with the group addresses excluded. Awaiting-response attendees aren't
  counted.

## Scope

### Included

- **A live summary in the starter message (the main goal):** RSVP counts, plus the
  current title, time and location, edited in place after RSVP changes.
- Keeping the starter message ID, and finding it for threads that v1 created.
- Starting refreshes from site RSVPs and from the Google Calendar sync, so RSVPs made in
  Google count too.
- Rate-limit-safe refreshes: changes are merged, edits that change nothing are skipped,
  and there's one edit at a time per series.
- Posting in the thread when an event's time, place or title changes, or when it's
  cancelled (v1 D6).
- Removing a linked member from the thread when they no longer have a Yes or Maybe on
  any upcoming instance of the series (v1 D5).
- Treating Google-side Yes/Maybe RSVPs like site RSVPs: create the thread and add the
  linked member (v1 D11).

### Excluded

- **A change to No still leaves the member in the thread** (v1 D4, kept).
- Pinging people: no `@mentions` or role pings. `allowed_mentions` stays empty.
- Reminder posts before an event. Possible later, but they need a schedule.
- Discord-side RSVPs (buttons or reactions). These need a gateway bot or an interactions
  endpoint.
- Editing the Google event description. The site still never writes `description`.
- Auto-joining members to the Discord server (`guilds.join`).

## Architecture

```
Site RSVP ─────────► runDiscordAfterRsvp ─┐
                                          ├─► requestThreadRefresh(seriesKey)
Google sync ───────► syncRecentEvents ────┘        │
  (webhook / cron)    (status diffs,               ▼
                       event changes)        refreshThread(seriesKey)   [lock + dirty flag]
                                               │  read series from Google Calendar
                                               │  render summary → hash
                                               │  PATCH starter message if hash changed
                                               └─ post change/cancel notice if fingerprint changed
```

All Discord work still runs after the response, through `waitUntil`, and never blocks an
RSVP or the webhook's 204.

### Thread record (extended)

`discord-thread:{seriesKey}` gains optional fields, so v1 records still parse:

| Field             | Meaning                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `messageId`       | the starter message to edit. Missing on v1 threads until R2 finds it |
| `contentHash`     | SHA-256 of the last content written, to skip no-op edits (R3.4)      |
| `eventSignature`  | title, start, end and location last announced, for change posts (R5) |
| `cancelledPosted` | whether the cancellation notice was posted                           |

### New Redis keys

| Key                                 | Value                                               |
| ----------------------------------- | --------------------------------------------------- |
| `discord-refresh-lock:{seriesKey}`  | lock token, `SET NX`, 30s TTL                       |
| `discord-refresh-dirty:{seriesKey}` | `1`, 5 min TTL: a refresh was asked for mid-refresh |
| `discord-refresh-last:{seriesKey}`  | ms epoch of the last edit, for spacing (R3.3)       |
| `discord-sync-jobs`                 | set of queued Google-side jobs (R6.3)               |
| `discord-sync-signatures`           | hash: event ID → what the sync last saw (R5.6)      |

## Requirements

### R1. The RSVP summary

1. The starter message keeps v1's lines (title, when, location and deep link) and adds an
   **RSVPs** section below them. It is rendered from Google Calendar data at refresh
   time, not from the event as it was when the thread was created.
2. **One-off event:**

   ```
   **Ghost Hunt at the Lighthouse**
   📅 Sat, Dec 6, 2026, 7:00 PM EST
   📍 Cape Henry Lighthouse
   🔗 https://ghostbustersva.com/members/calendar?event=…

   **RSVPs:** ✅ 6 going · ❔ 2 maybe
   ```

3. **Series:** the next 3 upcoming instances (D9), one line each:
   ```
   🔁 Recurring event
   **RSVPs**
   Tue, Dec 2 · ✅ 4 · ❔ 1
   Tue, Dec 9 · ✅ 2
   Tue, Dec 16 · no RSVPs yet
   ```
   The fixed "first RSVP for <date>" line from v1 is replaced by these rows.
4. Counts follow the feed's rules exactly. Share the code with `normalizeEvent`, don't copy
   it:
   - the group addresses and the calendar itself are excluded;
   - awaiting-response attendees aren't counted.
     No is not shown (D10), and neither are names (D8).
5. **When there are no upcoming instances**, the section reads "This event has ended." For
   a series, it reads "No upcoming dates."
6. **Cancelled:** a cancelled one-off event, or a cancelled series master, replaces the
   RSVP section with "❌ **Cancelled**", and the title line is struck through.
7. A last line, `Updated <time>` (`America/New_York`), shows readers that the summary is
   live.
8. The message stays within Discord's 2,000-character limit. If it's too long, the
   location goes first, then rows from the end of the series list.

### R2. Finding the starter message

1. New threads store `messageId` from the `postMessage` response in the thread record,
   before the extended-property patch.
2. **v1 threads** (no `messageId`): on the first refresh, read the thread's oldest
   messages (`GET /channels/{thread}/messages?after={threadId}&limit=10`) and take the
   earliest one written by the bot, matching the application ID. Store its ID.
3. If there's no bot message (it was deleted), post a new summary message and store its
   ID.
4. If an edit returns `10008 Unknown Message`, clear `messageId` and repeat R2.2–R2.3
   once.

### R3. Refreshing

1. `requestThreadRefresh(seriesKey)` is called:
   - after every site RSVP (any choice, including No and removed);
   - from `syncRecentEvents` for each series where an attendee's status changed;
   - from `syncRecentEvents` when the event's title, time or place changed, or it was
     cancelled (R5.6);
   - after a thread is created (in place of the v1 static starter text).
2. **Lock and dirty flag:**
   - If `discord-refresh-lock` is free, take it and refresh.
   - If not, set `discord-refresh-dirty` and return.
   - Before releasing the lock, the holder checks the dirty flag. If it's set, it clears
     the flag and refreshes once more.
   - Many RSVPs at once therefore cause at most two edits.
3. **Spacing:** keep at least 3 seconds between edits to one message, using
   `discord-refresh-last`. Wait inside the lock rather than skipping, so the last change
   is always written.
4. **No-op skip:** hash the rendered content without the `Updated` line. If it matches
   `contentHash`, skip the edit. This keeps sync runs that change nothing from touching
   Discord.
5. **The edit:** `PATCH /channels/{thread}/messages/{messageId}` with `content` and
   `allowed_mentions: { parse: [] }`. Discord refuses edits in an archived
   thread (`50083`). The refresh doesn't reopen it (D11): it skips, stores no hash, and
   the first refresh after the thread reopens (a member add or a change notice) writes
   the summary. A Yes RSVP adds the member before refreshing, so it reopens first.
6. **Reading Google:**
   - one-off: `getCalendarEvent`;
   - series: the master, plus `events.instances` from now, `maxResults` 3, with
     `showDeleted=false`.
7. Series that only appear through the sync are refreshed only if they already have a
   thread. The sync never creates a thread except as R6 says.

### R4. Removing members (v1 D5)

1. After a site RSVP with the "removed" choice, check the member's status on the upcoming
   instances (the R3.6 read, widened to 6 months for a series).
   - If they have no Yes or Maybe left, drop the series from `member-series:{email}`.
   - If they're linked, also call `DELETE /channels/{thread}/thread-members/{discordId}`.
2. **A change to No never removes anyone** (D4).
3. An archived thread is unarchived before the delete, as in v1 R4.4. A user already gone
   from the thread (`10007`) counts as success.
4. Only the site removes people. A member who left the thread in Discord isn't added back
   until their next Yes/Maybe.

### R5. Change and cancellation posts (v1 D6)

1. The event signature is title, start, end and location (the series master's, for a
   series, with times of day rather than dates, since the master's date is the first
   occurrence). The first refresh of a thread stores it without posting, which also
   covers v1 threads. Later refreshes compare against it.
2. When a refresh sees a different signature, it posts one new message in the thread
   listing what changed, for example "🕒 Time changed: Sat Dec 6, 7:00 PM → 8:00 PM EST".
   It then stores the new signature. If the post fails, the old signature stays, so the
   next refresh tries again. This check runs before the no-op skip (R3.4), because a
   series' time of day isn't in its summary text.
   - **Series:** only changes to the master count. Moving one instance only updates its
     row in the summary.
3. When a refresh sees the event cancelled, it posts "❌ This event was cancelled." once
   (`cancelledPosted`), and R1.6 applies to the summary. If the event comes back, the flag
   is cleared, so a second cancellation is announced too.
4. Posts use `allowed_mentions: { parse: [] }`. Posting unarchives the thread, which is
   acceptable for a change notice.
5. The thread name is renamed to match a new title (`PATCH /channels/{thread}` `name`),
   cut to 100 characters. A failed rename is logged; the notice still counts as posted.
6. **Noticing changes in the sync:** `syncRecentEvents` keeps a hash
   (`discord-sync-signatures`) of title, location, start and end for each upcoming event
   whose series has a thread. When one changes, or an event drops out of the listing
   (cancelled, deleted or moved out of range), the series is queued for a refresh (R6.3),
   and the refresh works out what happened from Google. Attendee changes don't count
   here, and an event seen for the first time is only recorded. Each summary refresh
   also records its events (the one-off, or a series' upcoming dates within the sync's
   120-day window) if they aren't in the hash yet, so an event deleted before the next
   sync still gets its cancellation notice.

### R6. Google-side RSVPs (v1 D11)

1. When `syncRecentEvents` sees an attendee go to Yes/Maybe from anything else, it does
   the v1 RSVP work for that email:
   - track the series;
   - make sure the thread exists, creating it if there isn't one yet (D12);
   - add the member if they're linked.
2. When it sees an attendee removed entirely, it applies R4.1.
3. This work is queued in Redis (`discord-sync-jobs`) and run after the sync's snapshot
   write, through `waitUntil`. It runs one series at a time, and at most 20 series per
   run. The snapshots are already written by then, so a later diff wouldn't show the
   rest again: they stay in the queue, and every sync run works through it, even one
   with no new changes.
4. Only events that haven't ended, and that the site can RSVP to, create jobs. For an
   event the site can't RSVP to, the summary is refreshed but nobody joins.

### R7. Reliability

1. Every Discord failure is logged with the series key and Discord code and then skipped.
   RSVPs, the feed and the webhook response never fail because of Discord.
2. A 429 is retried once after `retry_after`, as in v1. A refresh that still fails
   leaves the dirty flag set, and the next trigger retries it.
3. A deleted thread (`10003`) drops the record, as in v1. It isn't recreated by a refresh,
   only by the next Yes/Maybe.
4. With the Discord env vars unset, none of this runs.

### R8. Privacy

1. The summary shows counts only, with no names or Discord IDs (D8).
2. Update `privacy.json`: RSVPs made in Google Calendar now also add linked members to
   threads (R6).

## Setup

- [x] Give the bot **Read Message History** in the events channel. This is new, for
      R2.2. View Channel, Send Messages in Threads and Manage Threads, from v1, cover
      the rest: editing its own messages, removing thread members and renaming.
- [x] Add the new permission to `docs/DISCORD_SETUP.md`.

## Phases

1. **Message ID:** extend `ThreadRecord`, store `messageId` on creation, find it for v1
   threads (R2), and add `editMessage` and `getMessages` to `discord.ts`.
2. **Live summary:** the renderer (R1, with shared count logic), `refreshThread` with
   lock, dirty flag, spacing and hash (R3), wired to site RSVPs.
3. **Sync triggers:** refreshes from `syncRecentEvents` (R3.1), and Google-side join and
   remove (R6).
4. **Removals:** R4.
5. **Change and cancellation posts:** R5, including the thread rename.
6. **Privacy and setup docs.**

## Acceptance Criteria

- [x] A Yes on the site updates the thread's counts within a few seconds.
- [x] A Yes/Maybe/No/remove made in Google Calendar updates the counts after the next
      sync.
- [x] Ten RSVPs in quick succession cause no more than two edits, and the final message
      shows the final counts.
- [x] A sync with no RSVP changes makes no Discord calls.
- [x] A v1 thread gets its summary on the first refresh, without a second starter
      message.
- [ ] A series thread shows the next three instances, each with its own counts.
- [ ] Moving a one-off event posts one change notice and updates the summary. Cancelling
      it posts one cancellation notice.
- [ ] Removing the only RSVP to a one-off event removes a linked member from the thread.
      A change to No doesn't.
- [x] A Yes in Google Calendar by a linked member adds them to the thread.
- [ ] No message pings anyone.
- [ ] A Discord outage doesn't fail or slow an RSVP or the webhook.
- [ ] Unit tests cover the renderer (one-off, series, ended, cancelled, the length cap),
      the lock and dirty-flag merging, the hash skip, finding the message for v1
      threads, and the removal rule.
- [ ] `npm run check` passes.

## Resolved Questions

1. **Names in the summary?** Counts only for now (D8).
2. **How many series rows?** The next 3 instances (D9).
3. **Show No counts?** No (D10).
4. **Archived threads:** a summary refresh doesn't reopen one. Only change notices and
   member adds do (D11).
5. **Google-side joins:** a Google-side Yes creates the thread if there isn't one, as a
   site RSVP does (D12).

## Decisions

| #   | Topic                | Decision                                                                 |
| --- | -------------------- | ------------------------------------------------------------------------ |
| D1  | Where RSVP info goes | Edit the starter message in place. No new message per RSVP               |
| D2  | Source of the counts | Google Calendar at refresh time, with the feed's count rules             |
| D3  | Burst handling       | Per-series lock, dirty flag, 3 s spacing and a content hash              |
| D4  | Change to No         | Member stays in the thread (unchanged from v1)                           |
| D5  | Full removal         | Removed from the thread once no upcoming Yes/Maybe is left in the series |
| D6  | Event changes        | One post per master-level change, plus the live summary                  |
| D7  | Google-side RSVPs    | Handled through `syncRecentEvents`, at most 20 series per run            |
| D8  | Names in the summary | Counts only, for now                                                     |
| D9  | Series rows          | The next 3 upcoming instances                                            |
| D10 | No counts            | Not shown                                                                |
| D11 | Archived threads     | A summary edit doesn't reopen them; change notices and member adds do    |
| D12 | Google-side Yes      | Creates the thread if needed, like a site RSVP                           |
