# Calendar Invite Testing (PRD 012, Phase 0)

Before the site starts sending Google Calendar invitations for RSVPs, this test confirms
how Google actually behaves. It runs against a **test calendar only**, never the real GBVA
Events calendar.

The script, `scripts/calendar-invite-probe.ts`, uses the site's own Google credentials. It
pauses after each step so you can check the test accounts' inboxes and calendars, and asks
what you saw. At the end it prints a results table to copy into PRD 012.

## 1. Create the test calendar

Set it up the same way as the real GBVA Events calendar, so the results carry over.

- [x] Sign in to Google Calendar as the account that owns the real GBVA Events calendar.
- [x] Create a calendar (Settings → Add calendar → Create new calendar). Its name **must
      contain "test"**, for example `GBVA Events (test)`. The script refuses to run on a
      calendar without "test" in its name.
- [x] Share it with `calendar-automation@ghostbustersva.com` with the same permission the
      real calendar gives it (at least "Make changes to events").
- [x] Copy its **Calendar ID** (Settings → the calendar → Integrate calendar).

## 2. Create the test accounts

You need personal Gmail accounts you can sign in to. They can be new, throwaway accounts.

- [x] **Three test accounts**, each with a different "Add invitations to my calendar"
      setting (Google Calendar → Settings → General → Event settings):
  - [x] **From everyone**
  - [x] **Only if the sender is known**
  - [x] **When I respond to the invitation in email**
- [x] **One bystander account.** It's on every test event from the start, so you can see
      whether existing guests get emailed when someone else is added or removed. Any
      setting.
- [x] Optional: a GBVA Workspace account as a fourth test account.

Write down which account has which setting; the results only make sense with it.

Keep the real addresses in `.env.local` only; this repo is public. In
`INVITE_PROBE_ACCOUNTS`, list them in this order, which is the order the script uses:

| Position | "Add invitations" setting   | Role in the script                                        |
| -------- | --------------------------- | --------------------------------------------------------- |
| 1        | From everyone               | Yes; then removed (check 4); every week of the series (6) |
| 2        | Only if the sender is known | Maybe; then re-invited (check 5)                          |
| 3        | When I respond in email     | Yes                                                       |
| 4        | Workspace (optional)        | Yes                                                       |

## 3. Configure and run

Add these to `.env.local` (local only, never in Vercel):

```bash
INVITE_PROBE_CALENDAR_ID=<the test calendar ID>
INVITE_PROBE_ACCOUNTS=<everyone>@gmail.com,<known-only>@gmail.com,<respond-in-email>@gmail.com,<workspace>@ghostbustersva.com
INVITE_PROBE_BYSTANDER=<bystander>@gmail.com
```

`.env.local` also needs the site's usual Google settings, including
`GOOGLE_ACCESS_MODE=delegated`. If it uses Vercel OIDC rather than a key, refresh the token
first, because it expires after 12 hours:

```bash
vercel env pull .env.local   # then re-add the three INVITE_PROBE_ lines if they were overwritten
```

Then run:

```bash
npm run probe:invites
```

Before it changes anything, the script checks that:

- the calendar isn't the production `GBVA_EVENTS_CALENDAR_ID`;
- the calendar's name contains "test";
- no test address is the automation account or a member group;
- `GOOGLE_ACCESS_MODE` is `delegated`.

## 4. What the script does

Each step pauses for you to look. Give Google a minute before checking.

| Step | What the script does                                                                                          | PRD check  |
| ---- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| 1    | Creates a one-off event two weeks out with only the bystander, silently                                       | —          |
| 2    | Adds every test account with invitations on: the second as Maybe, the rest as Yes                             | 1, 2, 3, 7 |
| 3    | Removes the first account with a cancellation                                                                 | 4          |
| 4    | Re-invites the second account: removes it silently, then adds it back as Maybe with an invitation             | 5          |
| 5    | Creates a weekly series of 6, then adds the first account to every week, with an invitation on the first only | 6          |
| 6    | Prints and saves the results, then offers to delete the test events                                           | —          |

Deleting sends cancellations to the test accounts, which clears their calendars. All test
events' titles start with `[PRD 012 test]` if you keep them.

## 5. Record the results

Paste the printed table into PRD 012 under a "Phase 0 results" section, along with which
account had which setting. The results decide:

- whether the plan works at all (check 3: no other guest may be emailed);
- recurring events: option A (invite on the first instance only) or C (first 4) — check 6;
- how "Update My Calendar" re-invites existing guests — check 5.
