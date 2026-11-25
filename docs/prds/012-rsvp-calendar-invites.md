# PRD 012: RSVP Calendar Invites

**Status:** implemented; verifying on staging
**Author:** Jonathan Cook
**Date:** 2026-11-24

## Goal

When a member RSVPs Yes or Maybe on the site, Google sends them a calendar invitation and
the event appears on their own Google Calendar (on its own, or once they accept, depending
on their Google settings). When they remove their RSVP, it disappears from their calendar
again. Members
who RSVP'd before this ships can add their upcoming events with one "Update My Calendar"
action.

## Background

Site RSVPs already add the member to the event's `attendees` list as
`calendar-automation@`, and "Remove" takes them off it (PRD 008, R5.3). But every write
uses `sendUpdates=none` (PRD 008, R5.5), so Google sends no invitation. PRD 008 (R5.12)
expected the event might still appear, depending on the member's "Add invitations to my
calendar" setting. **In practice, events don't show up on members' calendars today.**

This PRD changes how attendee additions and removals are sent to Google so that Google
delivers a real invitation or cancellation. The attendee data the site writes stays the
same.

## Scope

### Included

- A Google Calendar invitation when a site RSVP moves a member into Yes or Maybe from not
  being on the event, or from No.
- A cancellation when a site RSVP removes a member who was Yes or Maybe.
- Handling "This and following" RSVPs on recurring events without one email per instance.
- An "Update My Calendar" item in the user menu that sends invitations for the member's
  upcoming Yes/Maybe events.
- A test calendar and a test script, used to confirm Google's behavior before any
  production change.
- Updating PRD 008's `sendUpdates` decision, the RSVP dialog's note, and the privacy
  policy.

### Excluded

- A setting to turn invitations off. Invitations are always on for now (D6).
- Writing to members' own calendars directly. The site only has `openid email profile`
  scopes. GBVA doesn't use domain-wide delegation for members' calendars (D7).
- Adding members to a whole recurring series (the series master) instead of to
  instances (D8).
- An iCal/ICS feed per member.
- RSVPs made directly in Google Calendar. Google already handles those.
- Changes to the Discord integration (PRD 010).

## Requirements

### R1. Phase 0: test setup and verification

No production write changes until this is done and its results are written into this PRD.

Setup steps, the run command, and what each step checks are in
[`docs/CALENDAR_INVITE_TESTING.md`](../CALENDAR_INVITE_TESTING.md).

1. **Test calendar:** create a calendar for testing only, for example "GBVA Events
   (test)". `calendar-automation@` must be able to edit it, the same way it edits the real
   calendar. Record its ID in `.env.local` as a test-only value. It's never set in
   Vercel.
2. **Test accounts:** at least three personal Gmail accounts, one for each "Add
   invitations to my calendar" setting:
   - From everyone;
   - Only if the sender is known;
   - When I respond to the invitation in email.

   Also one GBVA Workspace account if possible.

3. **Test script** (`scripts/calendar-invite-probe.ts`):
   - runs the steps in R1.4 against the test calendar, using the existing Google API
     code;
   - refuses to run if the calendar ID is the production `GBVA_EVENTS_CALENDAR_ID`;
   - prints each step, so a person can check the test accounts' inboxes and calendars
     after each one.
4. **What to check**, for each test account:
   1. Adding the account as an attendee with `responseStatus` accepted and
      `sendUpdates=all` delivers an invitation, and the event appears on their calendar.
   2. Whether the event shows as accepted, as tentative (for Maybe), or as awaiting a
      response.
   3. Whether **other** attendees or the organizer get any email when one attendee is
      added or removed.
   4. Removing the attendee with `sendUpdates=all` sends a cancellation and takes the
      event off their calendar.
   5. **Re-inviting an existing attendee** for "Update My Calendar": removing them with
      `sendUpdates=none`, then adding them back with `sendUpdates=all`. Does that send one
      invitation to them only?
   6. **Recurring events:** adding the attendee to one instance with an invitation, then
      to the following instances with `sendUpdates=none`. Do the later instances appear on
      their calendar? How many emails arrive?
   7. Who the invitation says it's from: the GBVA Events calendar or
      `calendar-automation@`.
5. **Stop condition:** if check 3 shows that other guests get email from a guest-list
   change, stop and revisit this PRD before going further.

### R2. Invite and cancel on site RSVPs

For each instance a site RSVP patches, the `sendUpdates` value is chosen from the
member's status before and after the patch:

| Before                  | After        | `sendUpdates` | Why                                        |
| ----------------------- | ------------ | ------------- | ------------------------------------------ |
| Not on the event, or No | Yes or Maybe | `all`         | They're going: put it on their calendar    |
| Yes or Maybe            | Removed      | `all`         | Take it off their calendar                 |
| Yes ↔ Maybe             | Maybe ↔ Yes  | `none`        | Already on their calendar                  |
| Yes or Maybe            | No           | `none`        | Stays on their calendar, shown as declined |
| Not on the event        | No           | `none`        | They said no; no invitation                |
| No                      | Removed      | `none`        | They may never have been invited           |

1. "Awaiting a response" (a guest added in Google who hasn't answered) counts as No: going
   sends an invitation, and removing sends nothing.
2. A change to the same status sends nothing.
3. `all` here only reaches the member being added or removed. That's what R1.4.3
   confirms.
4. The choice is a pure function of the two statuses, with unit tests for every row.
5. The existing ETag and retry logic (PRD 008, R5.4) is unchanged. A retry recomputes the
   choice from the freshly read event.

### R3. Recurring events

1. "This event only" follows R2 for that instance.
2. "This and following" sends one invitation, not one per instance (**option A**, chosen
   in phase 0): send `all` for the first instance where R2 says to, and `none` for the
   rest. Phase 0 showed the later instances appear on the member's calendar anyway.
   Option C (`all` for the first 4 instances) is kept as a fallback if open question 2
   in the phase 0 results goes the wrong way.
3. Removing with "This and following" follows the same rule.

### R4. Update My Calendar

1. The user menu always shows an **Update My Calendar** item for signed-in members.
2. Choosing it calls `POST /api/calendar/update-my-calendar`. The server:
   - finds the member's Yes and Maybe RSVPs on events starting in the next **3 months**;
   - re-invites them by removing with `sendUpdates=none`, then adding back with the same
     status and `sendUpdates=all` (confirmed in phase 0, check 5);
   - for recurring series, follows R3's rule per series, so a weekly meeting doesn't
     send a dozen emails: the first instance in the window is re-invited, and the later
     ones are removed and re-added silently, mirroring phase 0 step 5. If the first
     instance's invitation fails, the next instance gets it.
3. Re-inviting must not change anything else:
   - the member's RSVP status stays the same;
   - no late-change record is written (PRD 008, R7), including from the push-notification
     webhook seeing the brief removal;
   - the "changed since you RSVP'd" flag isn't set;
   - nothing happens on Discord.
4. It runs under the same sync lock as RSVPs, so it can't race a member's own RSVP. Each
   event takes the lock for its own remove and re-add, so a long update doesn't hold the
   lock past its expiry, and the push-notification sync never sees the member removed.
   Each event is re-read under the lock and skipped if the RSVP is no longer Yes or Maybe.
   The member's attendee entry goes back exactly as it was, comment included.
5. **Rate limit:** once per member per hour. A second try within the hour gets "You
   already updated your calendar recently. Try again later."
6. The result tells the member how many invitations were sent, for example "Sent 5
   calendar invitations. Check your email if they don't appear." With nothing to send:
   "You don't have any upcoming Yes or Maybe RSVPs."
7. Partial failures are reported ("Sent 4 of 5. Try again later for the rest") and
   logged. They never change an RSVP.

### R5. Member-facing copy

1. The RSVP dialog's note says that Yes or Maybe makes Google email them an invitation
   from `calendar-automation@ghostbustersva.com`, and that Remove takes it off again.
   Depending on their Google Calendar settings, the event appears on its own or after they
   accept the invitation from the email.
2. The privacy policy says that RSVPing makes Google send the member a calendar
   invitation from `calendar-automation@ghostbustersva.com`, and a cancellation when they
   remove it, and that "Update My Calendar" sends invitations for their upcoming RSVPs.
3. PRD 008 R5.5 and R5.12 get a note pointing to this PRD.

### R6. Reliability

1. A failed invitation never fails an RSVP. The attendee change is the source of truth,
   as today.
2. Invitation choices and any failures are logged with the event ID and the R2 row, never
   with the member's email.

## Phase 0 results

Run on 2026-11-24 against "GBVA Events (test)" with four test accounts and a bystander
(account positions as in [`docs/CALENDAR_INVITE_TESTING.md`](../CALENDAR_INVITE_TESTING.md)):
1 "from everyone", 2 "only if the sender is known", 3 "when I respond in email", 4 GBVA
Workspace.

| Check | Result                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Every added account got an invitation. The event appeared on the calendars of accounts 1 and 4 only. Accounts 2 and 3 got the email but no calendar entry.                      |
| 2     | Where the event appears, it shows the status the site set (Yes, or Maybe), not "awaiting response".                                                                             |
| 3     | **No other guest was emailed.** The bystander and earlier-added accounts got nothing when an account was added or removed. The stop condition wasn't hit.                       |
| 4     | Removing account 1 with `sendUpdates=all` sent it a cancellation and took the event off its calendar. Nobody else was emailed.                                                  |
| 5     | Re-inviting account 2 (remove with `none`, add with `all`) sent it exactly one new invitation, and nobody else any email. The event still wasn't on its calendar (its setting). |
| 6     | Adding account 1 to all 6 weeks, with `all` on the first week only: **1 email, and all 6 weeks appeared** on its calendar. Nobody else was emailed.                             |
| 7     | The invitation says it's from **`calendar-automation@`**, not the GBVA Events calendar.                                                                                         |

What this decides:

1. **The plan works.** Guest-list changes only email the guest being added or removed.
2. **Recurring events use option A** (R3): an invitation on the first instance only. Only
   tested with a "from everyone" account; see open question 2.
3. **"Update My Calendar" re-invites** by removing with `sendUpdates=none` and adding back
   with `sendUpdates=all` (R4.2).
4. **Whether the event appears depends on the member's Google setting.** With "only if the
   sender is known" or "when I respond in email", the member gets the invitation but has
   to accept it from the email before it appears. Copy must say so (R5).
5. **The sender is `calendar-automation@`**, so the copy and privacy policy name that
   account instead of "the GBVA Events calendar" (R5.2).

Open questions, not blocking phase 1:

1. Does accepting one invitation from `calendar-automation@` (or adding it to Contacts)
   make it a "known sender" for account 2, so later invitations appear on their own? If
   so, the RSVP note can suggest it.
2. For accounts 2 and 3, once the member accepts the first instance's invitation, do the
   later instances of a "This and following" RSVP appear too? If not, those members only
   get the first week, and option C may be worth revisiting.
3. Accepting a Maybe invitation from the email changes the member's status to Yes in
   Google. The push-notification webhook already treats that as a Google-side RSVP.
4. Phase 0 only tested adding to a series. When "This and following" removes a member,
   the first instance gets the cancellation and the rest are silent. Check that the
   later instances also leave their calendar.

## Phases

0. **Verify:** ✅ Done (results above). R1. Test calendar and accounts, the test script,
   the checks, and the results written into this PRD. R3's A-or-C choice and R4's
   re-invite method are decided here.
1. **Invite and cancel:** ✅ Done (PR #56). R2 for single-instance RSVPs, with unit tests
   for every row.
2. **Recurring:** ✅ Done (PR #56). R3, using option A, chosen in phase 0.
3. **Update My Calendar:** ✅ Done (PR #56). R4.
4. **Copy:** ✅ Done (PR #56). R5.

## Acceptance Criteria

- [x] Phase 0 results are recorded in this PRD, and no other guest is emailed by a
      guest-list change.
- [ ] A member RSVPs Yes on the site and gets an invitation. With "from everyone" (or a
      Workspace account), the event appears on their Google Calendar without them doing
      anything.
- [ ] A member who said No and then switches to Yes gets an invitation.
- [ ] Changing between Yes and Maybe, or from Yes to No, sends no email.
- [ ] Removing a Yes or Maybe RSVP takes the event off their calendar.
- [ ] A "This and following" RSVP across a weekly series sends at most the agreed number
      of invitations.
- [ ] "Update My Calendar" sends invitations for the next 3 months of Yes/Maybe RSVPs,
      doesn't change any RSVP, writes no late-change records, and is limited to once an
      hour.
- [ ] RSVPs still succeed when Google fails to send the invitation.
- [x] The RSVP note and privacy policy describe the invitations.
- [x] Unit tests cover the R2 table and the R3 rule.

## Decisions

| #   | Topic             | Decision                                                                    |
| --- | ----------------- | --------------------------------------------------------------------------- |
| D1  | Mechanism         | Google invitations via `sendUpdates`, not writes to members' own calendars  |
| D2  | What sends email  | Joining (Yes/Maybe from absent or No) and leaving (removed from Yes/Maybe)  |
| D3  | No → Yes          | Sends an invitation                                                         |
| D4  | Verify first      | Phase 0 on a test calendar, set up as part of this PRD                      |
| D5  | PRD 008 R5.5      | Superseded for joining and leaving; `none` kept for everything else         |
| D6  | Opting out        | Always on for now                                                           |
| D7  | Who's emailed     | `sendUpdates=all`. No delegation; Workspace members are invited like anyone |
| D8  | Whole-series adds | Not used: it would edit the series for every member                         |
| D9  | Recurring emails  | A (first instance only), confirmed in phase 0; C (first 4) is the fallback  |
| D10 | Existing RSVPs    | "Update My Calendar", always in the user menu                               |
| D11 | Update window     | Events in the next 3 months, once per member per hour                       |
| D12 | Sender            | Invitations come from `calendar-automation@`; the copy names it             |
| D13 | Member settings   | Some members must accept from the email; the copy says so, the site can't   |
