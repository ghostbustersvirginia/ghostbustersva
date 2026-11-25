# PRD 013: Request Member Calendar Access

**Status:** draft
**Author:** Jonathan Cook
**Date:** 2026-11-25

## Goal

Someone who signs in to the member calendar with a Google account that isn't in
`all-members@ghostbustersva.com` can ask for access with one button. The site adds them to
the GBVA membership spreadsheet, where officers approve new members, and emails the
officers.

## Background

When a signed-in account isn't a member, the calendar shows "We couldn't find you on the
member list" with two links: "Use a different Google account" and "Contact us" (PRD 008,
R1.4). Officers already approve new members from a Google Sheet. They tick a checkbox
on the sheet, or use an AppSheet app, which adds the person to `all-members@`.

The sheet's **Membership** worksheet has `ID`, `Name` and `Email` columns, plus other
columns officers and AppSheet use. `ID` is a random alphanumeric unique ID.

Non-members get no session cookie today. The site knows who they are only during the
sign-in request itself.

## Scope

### Included

- A "Request access" button on the not-a-member panel.
- A short-lived signed cookie that proves which Google account is asking.
- Adding a row to the Membership worksheet, writing only `ID`, `Name` and `Email`.
- Not adding duplicates, and showing applicants that their request is pending.
- An email to `officers@ghostbustersva.com` for each new request.
- Privacy policy copy.

### Excluded

- Approving people, or adding them to `all-members@`. Officers do that from the sheet or
  AppSheet, as today.
- Telling applicants when they're approved. They sign in again once they are.
- Any other spreadsheet column, including approval checkboxes and AppSheet's columns.
- Extra form fields (chapter, a note). The request is the Google name and email only.

## Requirements

### R1. Setup

Steps and the check script (`npm run check:membership-sheet`) are in
[`docs/MEMBERSHIP_REQUESTS_SETUP.md`](../MEMBERSHIP_REQUESTS_SETUP.md).

1. **Sheet ID:** `MEMBERSHIP_SHEET_ID` (server-only) holds the spreadsheet's ID. The ID and
   link never appear in the repo, which is public, because the sheet holds members'
   names and emails.
2. **Access:** the sheet is shared with `calendar-automation@ghostbustersva.com` as an
   editor. The Sheets scope (`https://www.googleapis.com/auth/spreadsheets`) is added to
   the domain-wide delegation client in the Google Admin console, next to the existing
   calendar and groups scopes, and to `SCOPES` in `google-auth.ts`.
3. **Officer email:** `OFFICERS_EMAIL` (default `officers@ghostbustersva.com`).
   `sendEmail` in `src/lib/email.ts` gets an optional `to`, because today it always sends
   to `CONTACT_TO_EMAIL`. `officers@` must accept email from the site's sender address.
4. **Test sheet:** before pointing at the real sheet, test against a copy with the same
   columns and worksheet name, set in `.env.local` through the same env var.

### R2. Applicant cookie

1. When sign-in verifies a Google account that isn't a member, the response sets a
   signed **applicant cookie** holding the verified email, name, and an expiry 30 minutes
   out.
2. It's signed with the session secret, `HttpOnly`, `Secure`, `SameSite=Lax`, and
   separate from the member session cookie. It grants no calendar access.
3. The request endpoint (R3) accepts only the applicant cookie, never an email or name
   from the request body.
4. Signing out, "Use a different Google account", and becoming a member clear it.

### R3. Request endpoint

`POST /api/auth/request-access`, with an `Origin` check like the other endpoints.

1. Reads and verifies the applicant cookie. Missing or expired gets "Your sign-in expired.
   Sign in again to request access."
2. Re-checks membership. If they're now a member, it returns that, and the calendar
   reloads into the member view.
3. Under a lock, reads the Membership worksheet:
   - finds the `ID`, `Name` and `Email` columns by their header names in row 1, so the
     columns can move without breaking the site. If any is missing, the request fails
     and is logged;
   - if `Email` already has the address (ignoring case and spaces), returns **pending**
     and changes nothing;
   - otherwise writes `ID`, `Name` and `Email` into the first row after the last one with
     any of those three filled. It writes those three cells only, and never uses
     "append", which could shift or fill other columns.
4. Values are written with `valueInputOption=RAW`, so a name starting with `=` is stored
   as text, never run as a formula.
5. `ID` is a random alphanumeric ID of 8 characters, like AppSheet's `UNIQUEID()`, and
   checked against existing IDs.
6. After a new row is written, it emails the officers (R5). A failed email doesn't fail
   the request; it's logged.
7. **Abuse limits:** a few requests per IP per hour, and one new row per email, ever
   (dedupe). Only Google-verified accounts can ask at all.

### R4. Not-a-member panel

1. The panel keeps its text and gets two choices:
   - **Use a different Google account** (primary, first), since many people simply
     signed in with the wrong account;
   - **Request access** (second), with a line such as "New to GBVA? Ask the officers to
     add you."
     "Contact us" is removed; these two are the only choices.
2. While sending, the button shows "Requesting…".
3. Afterward the panel shows "Request sent. An officer will add you to the member list,
   then you can sign in again." The button is gone.
4. If the email is already on the sheet, sign-in returns that, and the panel shows
   "Your request is waiting for approval" instead of the button. Sign-in checks the
   sheet when it finds a non-member, so returning applicants see their status.
5. If the sheet can't be read, the button still shows; R3 reports any problem.

### R5. Officer email

1. Sent to `OFFICERS_EMAIL` for each new row only, never for a duplicate.
2. Subject: "Member calendar access request: {name}".
3. Body: the name, email and ID, and a link to the spreadsheet, built from
   `MEMBERSHIP_SHEET_ID` at send time.
4. Reply-To is the applicant's email, so officers can reply to them directly.
5. Names and emails are HTML-escaped.

### R6. Privacy and logging

1. The privacy policy says that requesting access stores your Google name and email in a
   GBVA membership spreadsheet that officers use to approve members, and emails them to
   the officers.
2. Logs record the outcome (added, pending, failed) and the row ID, never the email or
   name.

## Phase 0 results

Run on 2026-11-25 against a test copy, "GBVA Group Membership (test)", in delegated mode.

| Check              | Result                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Access             | Works as `calendar-automation@`, with the Sheets scope allowed in delegation             |
| Worksheet          | "Membership" found                                                                       |
| Columns            | `ID` = A, `Name` = B, `Email` = C                                                        |
| Other columns      | Approver, Approval, Status, Updated. Never touched                                       |
| Existing IDs       | Letters and digits only, no duplicates. Lengths 8, and one of 1 (likely entered by hand) |
| Duplicate emails   | None                                                                                     |
| Write              | Wrote one row's three cells, read them back, and cleared them                            |
| Formula protection | A name starting with `=` was stored as text                                              |

Notes:

1. The site's Google access only acted as `calendar-automation@` for Calendar calls, so
   the first run was refused. Sheets calls are now delegated too (D2), in
   `google-auth.ts`.
2. 8-character IDs match the existing ones (D3). New IDs are checked against all
   existing IDs, including the 1-character one.
3. Still to check in phase 1: the real sheet with the read-only check, and that a
   request email reaches `officers@`.

## Phases

0. **Setup:** R1. Share the sheet, add the Sheets scope, set the env vars, and make the
   test sheet.
1. **Server:** R2, R3 and R5, with unit tests: column lookup, duplicate detection,
   first-empty-row, ID format, and cookie checks.
2. **UI:** R4.
3. **Copy:** R6.

## Acceptance Criteria

- [x] A non-member signs in and sees "Use a different Google account" and "Request
      access", and nothing else.
- [x] "Request access" adds one row with ID, Name and Email, and leaves every other
      column and row untouched.
- [x] `officers@` gets one email per new request, with Reply-To set to the applicant.
- [x] Asking again, or signing in again later, shows "waiting for approval", adds no row
      and sends no email.
- [x] The endpoint ignores any email or name sent in the request body.
- [x] A name starting with `=` is stored as text.
- [ ] After an officer approves and AppSheet adds them, the applicant signs in and gets
      the calendar.
- [x] The spreadsheet ID and link aren't in the repo.
- [x] The privacy policy describes the request.

## Decisions

| #   | Topic            | Decision                                                                    |
| --- | ---------------- | --------------------------------------------------------------------------- |
| D1  | Proving identity | Signed applicant cookie set at sign-in, 30 minutes                          |
| D2  | Sheet access     | Shared with `calendar-automation@`; Sheets scope added to delegation        |
| D3  | ID               | 8-character random alphanumeric, like AppSheet's `UNIQUEID()`               |
| D4  | Duplicates       | Matched by email; shown as "waiting for approval"; no new row or email      |
| D5  | Columns          | Only `ID`, `Name`, `Email`, found by header; no `append`, `RAW` values      |
| D6  | Choices          | "Use a different Google account" first, "Request access" second, no others  |
| D7  | Notification     | Email to `officers@ghostbustersva.com`                                      |
| D8  | Approval         | Officers tick the sheet's checkbox or use AppSheet, as today                |
| D9  | Abuse            | Per-IP rate limit and one row per email (not answered; recommended default) |
| D10 | Privacy          | Policy updated (not answered; recommended default)                          |
| D11 | Testing          | A copy of the sheet first (not answered; recommended default)               |
