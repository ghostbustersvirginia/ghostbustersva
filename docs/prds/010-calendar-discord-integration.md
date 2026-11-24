# PRD 010: Calendar Discord Integration

**Status:** draft
**Author:** Jonathan Cook
**Date:** 2026-11-23

## Goal

Give each member-calendar event a Discord thread where attendees can talk about it. The
first Yes or Maybe RSVP to an event creates the thread in the GBVA events channel. Members
who link their Discord account in the calendar app are added to the thread when they RSVP
Yes or Maybe, including for RSVPs they made before linking. The calendar shows a link to
the thread.

## Scope

### Included

- A "Link Discord" flow in the calendar app (Discord OAuth2, `identify` scope). It does
  not replace Google sign-in.
- One public thread per event series. A one-off event counts as its own series.
- Thread creation on the first Yes/Maybe RSVP made on the site, with a lock so that only
  one thread is created.
- A minimal starter message in the new thread.
- Storing the thread link on the Google Calendar event as a private extended property,
  and showing it in the event details popup.
- Adding linked members to the thread on each Yes/Maybe RSVP.
- Backfill on link: when a member links Discord, they are added to the threads of every
  series they have already RSVP'd Yes/Maybe to.

### Excluded (v2 or later)

- **RSVPs made directly in Google Calendar.** Only site RSVPs (`POST /api/calendar/rsvp`)
  trigger Discord work. The webhook/sync path is unchanged.
- **Removals.** Nobody is removed from a thread in v1. A change to No leaves the member
  in the thread (this is the intended behavior in every version). A full RSVP removal
  will remove the member in v2.
- **Message updates.** v1 never edits or adds to a thread after the starter message. Posts
  for event changes and cancellations come in v2.
- **An RSVP counter** in the thread. This needs message edits, so it moves to v2.
- **A list of RSVP'd members** who aren't on Discord. Not planned.
- **Editing the event description.** The site never writes to `description`.
- Auto-joining members to the Discord server (`guilds.join`).
- Discord as a sign-in method.

### Architecture exception

Like PRD 008, this needs server routes (`prerender = false`) for the OAuth flow. All
Discord API calls are REST calls with a bot token, made from Vercel Functions. No
long-running gateway bot is needed.

## Architecture

```
Browser ──► GET  /api/auth/discord/start      → 302 to Discord authorize (state cookie)
Discord ──► GET  /api/auth/discord/callback   → exchange code, GET /users/@me,
                                                 store link, backfill threads, 302 back
Browser ──► POST /api/auth/discord/unlink
Browser ──► POST /api/calendar/rsvp           (existing) → after success: Discord side effects
Server  ──► Discord REST v10 (Bot token)
Server  ──► Google Calendar events.patch      (extendedProperties.private only)
```

- **Channel:** a text channel, configured by `DISCORD_GUILD_ID` (`998292963127988284`)
  and `DISCORD_EVENTS_CHANNEL_ID` (`1233635927490826340`).
- **Series key:** `recurringEventId ?? eventId`. Threads, locks, and membership tracking
  all use it.
- **Source of truth:** Redis holds the thread record. The extended property on the event
  is a copy for the app.
- **Feature switch:** if the Discord env vars are not set, all Discord behavior is skipped
  and the "Link Discord" control is hidden. RSVPs work exactly as before.

### Redis keys

| Key                               | Value                                                |
| --------------------------------- | ---------------------------------------------------- |
| `discord-link:{email}`            | `{ id, username, linkedAt }`                         |
| `discord-user:{discordId}`        | member email (one Discord account ↔ one email, R1.4) |
| `discord-thread:{seriesKey}`      | `{ threadId, url, createdAt }`                       |
| `discord-thread-lock:{seriesKey}` | lock token, `SET NX`, 30s TTL                        |
| `member-series:{email}`           | set of series keys with a Yes/Maybe site RSVP        |
| `discord-oauth-state:{state}`     | email the state was issued to, 10 min TTL            |

## Requirements

### R1. Linking Discord

1. A signed-in member sees a "Link Discord" control in the calendar page header. Once
   linked, it shows the Discord username and an "Unlink" action.
2. `GET /api/auth/discord/start` requires a member session. It creates a random `state`,
   stores it with the member's email, and redirects to Discord's authorize URL with
   `scope=identify` and `prompt=none` when possible.
3. `GET /api/auth/discord/callback`:
   - checks that `state` exists, has not expired, and belongs to the current session's
     email, then deletes it;
   - exchanges the code for a token, calls `GET /users/@me`, and stores
     `discord-link:{email}`;
   - does not store the Discord access or refresh token;
   - runs the backfill (R4.3);
   - redirects to `/members/calendar` with a success or error indicator for the UI.
4. A Discord account can be linked to only one member email. Linking it to a second email
   replaces the first link.
5. `POST /api/auth/discord/unlink` deletes `discord-link:{email}`. It does not remove the
   member from any threads.

### R2. Thread creation

1. After a site RSVP succeeds with Yes or Maybe on at least one instance, the server
   ensures a thread exists for the series key.
2. **Lock:** if `discord-thread:{seriesKey}` exists, use it. Otherwise take
   `discord-thread-lock:{seriesKey}` with `SET NX`.
   - The request that gets the lock checks the record again, then creates the thread and
     writes the record.
   - A request that doesn't get the lock polls for the record for up to about 8 seconds,
     then goes on to R4 if it appears. If it doesn't appear, it skips. The next RSVP or
     backfill picks it up.
3. The thread is created with `POST /channels/{channel}/threads`, `type: 11`
   (public thread), and `auto_archive_duration: 10080` (7 days, the maximum).
   - **Name:** the event title exactly as it appears in Google Calendar, chapter prefix
     included. It is cut to 100 characters.
   - The site never archives threads. Discord archives a thread automatically after 7
     days with no activity. Before adding a member, the server unarchives an archived
     thread (R4.4).
4. **Starter message**, posted once right after creation:
   - event title;
   - for a one-off event, its date and time (`America/New_York`). For a series, "Recurring
     event" plus the date of the RSVP'd occurrence;
   - location, if any;
   - a link to `https://ghostbustersva.com/members/calendar?event=<instanceId>`.

   No member names and no counts.

5. If thread creation fails, no record is written and the lock is released. The next
   Yes/Maybe RSVP to the series tries again.

### R3. Thread link on the event

1. After creating the thread, the server patches the event with
   `extendedProperties.private.discordThreadUrl = <url>`.
   - For a series, it patches the series master (`recurringEventId`). For a one-off
     event, it patches the event itself.
   - It uses `If-Match` and retries on 412, like `rsvpOne`. It merges with any existing
     private properties and sends `sendUpdates=none`.
   - It never sends `description`, `summary`, `start`, `end`, `location`, or `attendees`
     in this patch.
2. The patch doesn't affect `eventFingerprint`, so it doesn't trigger the "changed since
   you RSVP'd" flag.
3. If the patch fails, it is logged and not retried. The Redis record is still the source
   of truth.
4. The event feed (`GET /api/calendar/events`) adds `discordThreadUrl` to each normalized
   event. It is read from the instance's extended property, falling back to
   `discord-thread:{seriesKey}`. The fallback covers modified instances that don't inherit
   the master's properties.
5. The event details popup shows a "Discuss on Discord" link when `discordThreadUrl` is
   present. It is shown to all members, linked or not.

### R4. Adding members

1. After a Yes/Maybe site RSVP:
   - add the series key to `member-series:{email}`;
   - once the thread exists (R2), if `discord-link:{email}` exists, call
     `PUT /channels/{threadId}/thread-members/{discordId}`.

   This is idempotent, so repeat RSVPs and multiple instances in one series are fine.

2. A No or removed RSVP does nothing on Discord in v1.
   - `member-series:{email}` keeps the series key after a change to No.
   - It drops the series key only when a removed RSVP leaves the member with no Yes/Maybe
     on it: a removal on a one-off event. A series keeps its key, since other instances
     may still have a Yes/Maybe. This is so a v2 removal can use the same data.
3. **Backfill on link:** for each series key in `member-series:{email}` that has a
   `discord-thread` record, add the member (R4.1). The series are processed one after
   another, with rate limiting handled as in R5.3.
4. If the thread is archived (Discord error, or the thread's `thread_metadata.archived`),
   unarchive it with `PATCH /channels/{threadId}` `{ archived: false }` and try the add
   once more.
5. If the Discord user isn't in the server, Discord returns an error (for example
   `10007 Unknown Member`). That is logged and skipped. The link stays.

### R5. Reliability

1. Discord and extended-property work runs after the RSVP response is ready, using
   `waitUntil` from `@vercel/functions`. An RSVP never fails or slows down because of
   Discord.
2. Discord errors are logged with the series key and the Discord error code. They are not
   shown to the member, except the link/unlink result in R1.
3. **Rate limits:** a 429 is retried once after `retry_after`. Anything still failing is
   logged and skipped.
4. "This and following" RSVPs across many instances of a series still make only one
   thread and one member add.

### R6. Security and privacy

1. The bot token, client secret, and calendar IDs stay server-side. The browser only ever
   receives the thread URL and the member's own Discord username.
2. OAuth `state` is single-use, tied to the session email, and expires after 10 minutes.
3. Discord IDs and usernames are never shown to other members.
4. Update `src/content/page-copy/privacy.json`: say that linking Discord stores the
   Discord user ID and username, and that they're used to add the member to event
   threads.

## Setup prerequisites (Phase 0, not code)

Step-by-step instructions are in [`docs/DISCORD_SETUP.md`](../DISCORD_SETUP.md).

- [ ] Discord application with a bot user. OAuth2 redirect URIs for prod, preview (if
      practical), and localhost: `/api/auth/discord/callback`.
- [ ] Invite the bot to guild `998292963127988284` with: View Channel, Send Messages,
      Create Public Threads, Send Messages in Threads, Manage Threads. Check that the
      channel's permission overrides allow these for the bot role in
      `1233635927490826340`.
- [ ] Vercel env vars: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`,
      `DISCORD_GUILD_ID`, `DISCORD_EVENTS_CHANNEL_ID`. Also add them to the
      `astro.config.mjs` env schema and `.env.example`.

## Phases

1. **Discord client:** a small REST wrapper (`src/lib/member-calendar/server/discord.ts`)
   with bot auth, 429 handling, and typed errors.
2. **Linking:** start, callback, and unlink routes, the Redis link record, and the header
   UI.
3. **Threads:** series key, lock, creation, starter message, extended-property patch, and
   the feed and popup link.
4. **Membership:** add on RSVP, `member-series` tracking, backfill on link, unarchive
   retry.
5. **Privacy copy and polish.**

## Acceptance Criteria

- [ ] With the Discord env vars unset, the app behaves exactly as before PRD 010.
- [ ] The first Yes or Maybe site RSVP to an event creates exactly one thread in the
      events channel, even when two members RSVP at the same moment.
- [ ] A No RSVP to an event with no thread doesn't create one.
- [ ] RSVPing "this and following" across a recurring series creates one thread, and
      later RSVPs to other instances reuse it.
- [ ] The starter message has the title, date, location, and deep link, and no member
      names.
- [ ] The event's `extendedProperties.private.discordThreadUrl` is set, and its
      description is unchanged.
- [ ] Setting the property doesn't trigger the "changed since you RSVP'd" flag.
- [ ] The popup shows "Discuss on Discord" for events with a thread, including modified
      instances of a series.
- [ ] A linked member who RSVPs Yes/Maybe is added to the thread. A member who changes to
      No stays in it.
- [ ] A member who RSVPs first and links Discord later is added to every matching thread.
- [ ] Adding a member to an archived thread unarchives it and succeeds.
- [ ] A Discord outage or bad token doesn't fail or slow down an RSVP.
- [ ] A forged or reused OAuth `state` is rejected.
- [ ] Unit tests cover the series key, the lock (create/wait/skip), the `member-series`
      bookkeeping, the extended-property merge patch, and the 429/archived retry paths.
- [ ] `npm run check` passes.

## Decisions

| #   | Topic              | Decision                                                                                  |
| --- | ------------------ | ----------------------------------------------------------------------------------------- |
| D1  | Duplicate threads  | Redis `SET NX` lock per series key (R2.2)                                                 |
| D2  | Thread granularity | One thread per event series (`recurringEventId ?? eventId`)                               |
| D3  | Link after RSVP    | Backfill on link (R4.3)                                                                   |
| D4  | RSVP changed to No | Member stays in the thread                                                                |
| D5  | RSVP removed       | Remove from thread, in v2                                                                 |
| D6  | Thread content     | Minimal starter message in v1. Change/cancel posts in v2. Never auto-archived by the site |
| D7  | Channel            | Text channel `1233635927490826340` in guild `998292963127988284`                          |
| D8  | Attendee list      | Not shown. A counter may come in v2                                                       |
| D9  | Timing             | After the RSVP succeeds, using `waitUntil` (R5.1)                                         |
| D10 | Link on event      | Private extended property only. Description never edited (R3)                             |
| D11 | Google-side RSVPs  | Out of scope for v1                                                                       |
