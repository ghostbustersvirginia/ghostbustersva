# PRD 008: Member Calendar Integration

**Status:** in-progress
**Author:** Jonathan Cook
**Date:** 2026-11-21

## Goal

Give GBVA members a members-only calendar page on ghostbustersva.com. It shows the
"GBVA Events" Google Calendar, color-codes and filters events by chapter/prefix, and lets
members RSVP to events with their Google account. The RSVPs are real Google Calendar
RSVPs, so they stay in sync with the member's own Google Calendar.

## Scope

### Included

- Google Sign-In for visitors, plus a server-side check that they belong to
  `all-members@ghostbustersva.com`.
- A server-side proxy for all Google API access. The browser never calls Google APIs
  directly and never holds calendar scopes.
- A React calendar island using FullCalendar (`@fullcalendar/react`).
- Color-coding by title prefix, a multi-select prefix filter saved in localStorage, and an
  indicator on days that have hidden events.
- An event details popup with Yes / No / Maybe RSVP, written to Google Calendar as an
  attendee `responseStatus`.
- Recurring events: RSVP applies to one occurrence by default, or to "this and following
  events" if the member chooses.
- A "changed since you RSVP'd" flag.
- Attendee names shown to signed-in members.
- A record of late RSVP changes (Yes → anything else from 2 hours before start onward),
  available to organizers as a CSV export.

### Excluded (future PRDs)

- An organizer roster page. The CSV export of late changes is in scope.
- Reminder emails (Resend).
- Feeding the public `/events` page from the calendar.
- Personal ICS feeds.
- Creating or editing events from the site.

### Architecture exception

`AGENT.md` says there is no backend/SSR unless a PRD requires it. This PRD requires
server routes (`prerender = false`) for auth, events, and RSVP. The page shell itself stays
static.

## Architecture

```
Browser ──(Google Identity Services, scopes: openid email profile)──► POST /api/auth/session
          server verifies the ID token → checks group membership → sets the session cookie
Browser ──► GET  /api/calendar/events?start&end     (service account reads the calendar)
Browser ──► POST /api/calendar/rsvp                 (service account patches attendees)
Browser ──► POST /api/auth/logout
Browser ──► GET  /api/calendar/late-changes.csv     (organizers only)
Google  ──► POST /api/calendar/webhook              (events.watch push notifications)
Cron    ──► GET  /api/cron/renew-watch              (renews the push channel)
```

The page lives at `/members/calendar`, which leaves room for a future `/members` area.

- **Sign-in:** Google Identity Services button with FedCM enabled. It asks only for the
  non-sensitive scopes (`openid email profile`), so the OAuth app does not need Google
  verification.
- **Google API access:** through a service account. The setup steps are in
  [`docs/GOOGLE_CALENDAR_SETUP.md`](../GOOGLE_CALENDAR_SETUP.md).
  - **Preferred (`GOOGLE_ACCESS_MODE=direct`):**
    - The GBVA Events calendar is shared with the service account ("Make changes to
      events").
    - The service account is assigned the Workspace **Groups Reader** admin role.
    - There is no domain-wide delegation.
  - **Fallback (`delegated`):** domain-wide delegation, with the service account acting as
    `calendar-automation@ghostbustersva.com`.
  - In both modes, group checks use Cloud Identity
    `groups.memberships.checkTransitiveMembership`. Transitive means members of nested
    groups count too.
- **Credentials:** prefer Vercel OIDC with Google Workload Identity Federation, so there
  is no stored key. The fallback is a service account JSON key in Vercel env vars.
- **Session:** a signed `HttpOnly; Secure; SameSite=Lax` cookie containing email, name,
  an `isOrganizer` flag, and the membership-check time.
  - `isOrganizer` comes from a transitive membership check in
    `officers@ghostbustersva.com` (`GBVA_ORGANIZERS_GROUP`), done at the same time as the
    member check.
  - The membership check runs again after `MEMBERSHIP_TTL`. Membership is checked again after `MEMBERSHIP_TTL`
    The default is 12h, which also limits how long a removed member or officer keeps
    access.
- **Calendar ID:** server-side env var `GBVA_EVENTS_CALENDAR_ID`. It is never sent to the
  client.

## Requirements

### R1. Sign-in and access

1. A signed-out visitor to the calendar page sees a short explanation and a "Sign in with
   Google" button.
2. After sign-in, the server verifies the ID token: signature, `aud`, `iss`, `exp`, and
   `email_verified`.
3. The server checks transitive membership in `all-members@ghostbustersva.com`.
4. A non-member sees:
   - the email they signed in as,
   - a "Use a different Google account" action,
   - a "Think this is wrong? Contact us" link to `/contact`.

   Most members use personal Gmail accounts, so expect signing in with the wrong account
   to be common. This screen is a first-class state, not an error page.

5. A signed-in member sees their name/email and a "Sign out" control in the page header,
   and in the site header if that is practical.
6. Every `/api/calendar/*` request requires a valid session and returns 401 otherwise.

### R2. Event feed

1. `GET /api/calendar/events?start=&end=` calls `events.list` with `singleEvents=true`,
   `timeMin`/`timeMax`, `orderBy=startTime`, and follows all pages.
2. The response is normalized to the fields the UI needs:
   - id, recurringEventId, title, prefix, start, end, allDay, location
   - description, sanitized server-side
   - htmlLink
   - the current user's responseStatus
   - attendee counts by status
   - an attendee list (display name and status)
   - a `changedSinceRsvp` flag
   - an `rsvpAllowed` flag
3. Responses are sent with `Cache-Control: private, no-store`.
4. Time zone is `America/New_York`.
5. **Multi-day events:** organizers create a separate event for each day. The app treats
   every event as standalone, needs no logic for events spanning several days, and RSVPs
   are per day. A timed event that happens to cross midnight renders normally.
6. **Attendee display names:** personal Gmail attendees often have no `displayName` in
   the Calendar API.
   - On each sign-in, the server stores the member's Google profile name in Redis
     (`member-name:{email}`).
   - The name shown is the first available of: Calendar `displayName`, the stored name, the
     part of the email before the `@`.
   - Full email addresses are never shown in the UI.

### R3. Calendar UI

1. Use `@fullcalendar/react` with the MIT plugins only: daygrid, timegrid, list,
   interaction. Pin the version.
2. Views are month, week, and list. List is the default below the mobile breakpoint.
3. The page uses `BaseLayout`, `PageHeader`, and the site theme tokens from
   `src/styles/theme.css`. Restyle FullCalendar through its CSS variables to match the
   site.
4. The page is `noindex`, is excluded from the sitemap, and is linked from the nav
   dropdown as "Member Calendar".
5. Supports deep links (`?event=<id>`): the event's popup opens after sign-in.

### R4. Prefixes, colors, filtering

1. **Prefix syntax:** `<chapter> - <event title>`.
   - Split on the **first** dash surrounded by spaces. A hyphen, en dash (–) or em dash (—)
     all count, because titles pasted from elsewhere often contain en dashes.
   - Everything after the first separator is the title, so `NoVA - Zoo Boo - Day 2`
     becomes chapter NoVA, title `Zoo Boo - Day 2`.
   - Prefix matching is case-insensitive for every chapter and alias.
   - The prefix is removed from the displayed title, and the chapter chip shows it instead.
   - A leading `Interest - ` (any dash, any case) marks an event that is gauging
     interest, e.g. `Interest - NOVA - Trunk or Treat`. It is removed, the rest is parsed
     as usual, and the event shows an "Interest" badge in the calendar and the dialog.
2. Chapters are defined in config, each with `key`, `label`, `aliases`, and `color`. Each
   color must give at least 4.5:1 contrast with the event text.

   | key              | label          | aliases (case-insensitive)                  |
   | ---------------- | -------------- | ------------------------------------------- |
   | `blue-ridge`     | Blue Ridge     | Blue Ridge, CVille, Charlottesville         |
   | `central`        | Central        | Central, Richmond, RVA                      |
   | `nova`           | NoVA           | NoVA                                        |
   | `fredericksburg` | Fredericksburg | Fredericksburg, FXBG                        |
   | `southeast`      | Southeast      | Southeast, 757                              |
   | `virtual`        | Virtual        | Virtual (filterable; distinct style — R4.8) |

3. Events with no prefix, or an unknown prefix, are "General". They always show and
   cannot be filtered out.
4. The multi-select filter lists the known prefixes. The default is all selected.
5. The filter is saved in localStorage under the versioned key
   `gbva.calendar.filters.v1`.
   - Saved prefixes that no longer exist are ignored.
   - Storage errors fail silently.
6. A legend shows each prefix color. Events also show the prefix as text, so color is
   never the only cue.
7. **Hidden-event days:**
   - In month view, a day that has hidden events gets a distinct background
     treatment plus a "+N hidden" label with an accessible name.
   - In week and list views, the day header shows "N hidden".
8. **Virtual events** are a normal chapter in the filter. They are styled differently
   from the geographic chapters, so they stand out whatever their color:
   - a dashed border,
   - a small "virtual" icon (inline SVG, with an accessible label of "Virtual event").

### R5. Event details and RSVP

1. Clicking an event opens an accessible dialog with:
   - title, prefix chip, date/time, location (with a map link), sanitized description,
   - a "View in Google Calendar" link,
   - headcounts (Yes / Maybe / No),
   - attendee names grouped by status (Going / Maybe / Not going).
2. RSVP buttons: Yes / No / Maybe / Remove. The current response is highlighted.
3. **Writing the RSVP:**
   - Patch the event `attendees` as `calendar-automation@`.
   - If the user is not an attendee yet, add them with that `responseStatus`. Otherwise
     update their status.
   - "No" keeps them on the list as `declined`. It does not remove them.
   - "Remove" removes them from the list
4. **Concurrency:** read the event, change the attendees, then patch with `If-Match: <etag>`.
   On a 412 conflict, re-read and retry up to 3 times, so two members RSVPing at once
   cannot overwrite each other.
5. Always use `sendUpdates=none`. No Google emails are sent for site RSVPs.
6. Attendee emails are compared case-insensitively against the signed-in email.
7. **Recurring events:**
   - The default is "This event only", which patches that instance.
   - "This and following events" patches each instance from the selected occurrence
     onward, up to the series end or a **12-month horizon**, whichever comes first.
   - Instances beyond the horizon are not included, and the dialog says so ("Applied
     through <date>").
   - The patches run one after another, each with the same ETag/retry logic. If an
     instance fails, the member sees a partial-success message listing the dates that
     weren't updated.
   - The scope choice appears only for occurrences of a recurring event.
8. Members can change their RSVP at any time, including after the event starts.
9. If the event can't be modified, `rsvpAllowed=false` and the dialog explains why. One
   example is an event whose organizer is not the GBVA Events calendar.
10. RSVP POSTs check `Origin` (the same pattern as `api/contact.ts`) and are
    rate-limited with the existing `lib/rate-limit.ts`.
11. RSVPs made from the member's own Google Calendar show up on the site automatically,
    because Google is the source of truth.
12. Whether a site RSVP adds the event to a personal Gmail user's own calendar depends on
    that user's "Add invitations to my calendar" setting, because `sendUpdates=none` sends
    no invite. This is not guaranteed. The "View in Google Calendar" link is the reliable
    path.
13. Below the RSVP buttons, a short note tells members that late changes are tracked:
    "Changing a Yes within 2 hours of the start time is recorded for organizers."
14. **Attendee visibility in Google:** events on the GBVA Events calendar should have
    `guestsCanSeeOtherGuests=true`, so Google's view matches the site.

### R6. Change flag

1. Event `updated` cannot be used to detect changes, because every RSVP changes it.
2. When a member RSVPs, the server stores a fingerprint in Upstash Redis:
   - the fingerprint is a hash of `start`, `end`, `location`, and `summary`,
   - the key is `rsvp-fp:{eventInstanceId}:{email}`.
3. When an event's current fingerprint differs from the stored one, it shows a
   "Changed since you RSVP'd" flag on the calendar entry and in the dialog.
4. Re-submitting or confirming the RSVP stores a new fingerprint, which clears the flag.
5. If Redis is unavailable, the flag is skipped. RSVP still works.

### R7. Late RSVP-change record

1. **What gets recorded:** a member had RSVP'd **Yes** and changed it to anything else:
   Maybe, No, or Remove (taken off the attendee list).
   - Only changes at or after **2 hours before the event start** are recorded. This
     includes changes after the event starts or ends, with no cutoff.
   - The window is configurable as `LATE_CHANGE_WINDOW_MINUTES` (default 120).
   - A Yes → Yes re-confirmation is not a change.
   - A "this and following" change records one entry per affected instance that is inside
     the window. Usually that is only the selected occurrence.
2. **What is stored:** event instance id, event title, event start, member email and name,
   previous status, new status, change timestamp, and source (`site` or `google`).
3. **Storage:** an append-only list in Upstash Redis, e.g. `rsvp-late-changes:{YYYY}`.
   Records are kept for `LATE_CHANGE_RETENTION` (default 2 years).
4. **Changes made on the site:** recorded in the RSVP handler, which knows the previous
   status from the attendee list it read before patching.
5. **Changes made in Google Calendar:** these bypass the site.
   - Keep a last-known-status snapshot per `{eventInstanceId}:{email}` in Redis.
   - Update the snapshot whenever the server reads the event: on every feed load, and from
     a Google Calendar push-notification (`events.watch`) webhook.
   - The webhook needs channel renewal before expiry (a Vercel cron job).
   - Record any Yes→other change detected inside the late-change window.
   - Google doesn't report when an attendee changed their response, so for `source=google`
     the `changed_at` time is when the server _detected_ the change. That is usually within
     seconds via the webhook, but less precise if the webhook missed it.
6. **CSV export:** `GET /api/calendar/late-changes.csv?from=&to=`.
   - Restricted to sessions with `isOrganizer` (members of `officers@ghostbustersva.com`).
     Everyone else gets 403.
   - Columns: `event_date, event_start, event_title, chapter, member_name, member_email,
previous_status, new_status, changed_at, minutes_before_start, source`.
   - `minutes_before_start` is negative if the change happened after the start.
   - Times are in `America/New_York`. Cells starting with `=`, `+`, `-` or `@` are escaped,
     so a spreadsheet can't run them as formulas.
   - An "Export late RSVP changes" button appears on the calendar page for organizers
     only.
   - It is never shown to regular members.
7. If Redis is unavailable, the RSVP still succeeds. The failure to record is logged.

### R8. Security and privacy

- Event descriptions are sanitized with an allowlist (e.g. DOMPurify or sanitize-html).
  Links get `target=_blank rel="noopener noreferrer"`.
- No event data in static output, the sitemap, or any shared cache.
- Error states never leak Google error payloads to the client.

## Setup prerequisites (Phase 0, not code)

- [ ] Google Cloud project, with the Calendar API and Cloud Identity API enabled.
- [ ] OAuth client (Web), with authorized JS origins for prod, preview, and localhost.
      Consent screen branding.
- [ ] Service account, with domain-wide delegation granted by a Workspace super admin
      for the Calendar and Cloud Identity group-read scopes.
- [ ] Workload Identity Federation pool trusting Vercel OIDC (or a JSON key as the
      fallback).
- [ ] Vercel env vars: `GOOGLE_OAUTH_CLIENT_ID`, `GBVA_EVENTS_CALENDAR_ID`,
      `GBVA_MEMBERS_GROUP`, `GBVA_ORGANIZERS_GROUP`, `SESSION_SECRET`, plus the credential config. Also add them
      to the `astro.config.mjs` env schema and `.env.example`.
- [ ] Confirm `calendar-automation@` is the organizer of the events, and set
      `guestsCanSeeOtherGuests=true` on existing and future events.
- [ ] Vercel cron job for renewing the push channel, and a public HTTPS webhook URL
      that Google can reach.

## Phases

1. **Auth:** session, logout, and the member / non-member / signed-out states.
2. **Read-only calendar:** feed endpoint, FullCalendar views, details dialog, sanitization,
   theming.
3. **Prefixes:** config, colors, legend, filter, localStorage, hidden-day indicator.
4. **RSVP:** attendee patching with ETag retry, single-instance scope, headcounts.
5. **Recurring and changes:** "this and following" scope, the change-flag fingerprints, and
   the late RSVP-change record (site changes first, then the Google push-notification
   webhook).
6. **Polish:** deep links, nav and header integration, mobile list default.

## Acceptance Criteria

- [ ] A non-member Google account cannot get any event data from any endpoint (verified
      with direct API calls).
- [ ] A member signed in with the wrong account can switch accounts without clearing
      cookies.
- [ ] No Google OAuth verification warning appears during sign-in.
- [ ] Events match Google Calendar for a sample month, including all-day and recurring
      events.
- [ ] The prefix filter hides and shows events, survives a reload, and always shows
      General events.
- [ ] Days with only hidden events look different from empty days, and assistive tech
      announces the difference.
- [ ] An RSVP from the site appears in Google Calendar as the member's response, and an
      RSVP changed in Google appears on the site after a refresh.
- [ ] Two simultaneous RSVPs to the same event both persist.
- [ ] No email is sent to anyone because of a site RSVP.
- [ ] "This event only" changes only that occurrence. "This and following" changes that
      occurrence and later ones.
- [ ] Moving an event's time after RSVPing shows the change flag, and re-confirming
      clears it.
- [ ] A Yes→Maybe, Yes→No, or Yes→Remove change made 2 hours or less before the start
      (or later) is recorded in the late-change record, whether it is made on the site or in
      Google Calendar.
- [ ] Changes made earlier than 2 hours before the start, and changes that didn't start
      from Yes, are not recorded.
- [ ] Members of `officers@` can download the late-change CSV, and see the export
      button. Other members get 403 and no button.
- [ ] Virtual events can be filtered like any chapter, and show a dashed border and an
      icon with an accessible label.
- [ ] `NoVA - X`, `nova – X`, `RVA - X`, `757 - X` and `CVille - X` all resolve to the
      right chapter. `Zoo Boo - Day 2` with no chapter prefix stays General, with its
      full title.
- [ ] Attendee names show for each event, and full email addresses never appear in the
      UI.
- [ ] Unit tests cover prefix parsing, filter logic, hidden-day counting, fingerprinting,
      and the attendee-merge/retry logic.
- [ ] `npm run check` passes.

## Decisions

| #   | Topic                    | Decision                                                              |
| --- | ------------------------ | --------------------------------------------------------------------- |
| Q1  | Multi-day events         | Organizers create one event per day (R2.5)                            |
| Q2  | Prefix format / chapters | `<chapter> - <title>` with the alias table (R4)                       |
| Q3  | "This and following"     | Patch each instance, up to a 12-month horizon (R5.7)                  |
| Q4  | Attendee visibility      | Show names to members (R2.6, R5.1)                                    |
| Q5  | Member accounts          | Mostly personal Gmail, so wrong-account handling is a priority (R1.4) |
| Q6  | Route                    | `/members/calendar`                                                   |
| Q7  | Late-change definition   | Yes → any other status, from 2 hours before the start onward (R7.1)   |
| Q8  | Late-change access       | CSV export (R7.6). Members are told late changes are tracked (R5.13)  |
| Q8a | Organizers               | Members of `officers@ghostbustersva.com` (transitive)                 |
| Q9  | Virtual                  | Filterable chapter, dashed border and icon (R4.8)                     |
| Q10 | Late changes after end   | Recorded, with no cutoff (R7.1)                                       |
