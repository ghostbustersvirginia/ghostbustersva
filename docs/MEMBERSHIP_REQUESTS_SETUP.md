# Membership Requests Setup (PRD 013, Phase 0)

Before the member calendar can add access requests to the membership spreadsheet, the
site needs access to the sheet, and the officers' group needs to accept the site's email.
This checklist sets that up and checks it with a script, first on a **copy** of the sheet.

Keep the spreadsheet's ID and link out of the repo, which is public. They go in
`.env.local` and Vercel only.

## 1. Make a test copy

- [x] Open the membership spreadsheet. **File → Make a copy**. Name it with **"test"** in
      the title, for example `Membership (test)`. The script refuses to write to a sheet
      without "test" in its title.
- [x] Keep the worksheet name, **Membership**, and the `ID`, `Name` and `Email` headers in
      row 1. The other columns can stay as they are.
- [ ] Optional: delete the copied people's rows from the copy, so test runs don't sit
      next to real members' details. Keep the header row.

The copy isn't connected to AppSheet, so nothing in it adds anyone to `all-members@`.

## 2. Give the site access

The site's Google access runs as `calendar-automation@ghostbustersva.com` when
`GOOGLE_ACCESS_MODE=delegated` (production), or as the service account itself otherwise.

- [ ] Share **both** the test copy and the real sheet with
      `calendar-automation@ghostbustersva.com` as an **Editor**. (In `direct` mode, share
      with the service account's email, `GCP_SERVICE_ACCOUNT_EMAIL`, instead.)
- [x] In the Google Admin console: **Security → Access and data control → API controls →
      Manage Domain Wide Delegation**. Edit the site's service account client and **add**
      this scope to its list:

      https://www.googleapis.com/auth/spreadsheets

      Keep the existing scopes. Saving replaces the whole list, so a missing scope turns
      that feature off.

## 3. Let the site email officers

Request emails go to `officers@ghostbustersva.com` (or `OFFICERS_EMAIL`), from the site's
`CONTACT_FROM_EMAIL` address.

- [ ] In Google Groups, check that `officers@` accepts email from that address: **Group
      settings → Who can post**. If only members can post, either allow anyone on the web
      or add the sender address as a member who can post.

## 4. Configure and check

- [x] Add to `.env.local`, pointing at the **test copy** first:

  ```bash
  MEMBERSHIP_SHEET_ID=<the test copy's spreadsheet ID>
  # MEMBERSHIP_WORKSHEET=Membership
  # OFFICERS_EMAIL=officers@ghostbustersva.com
  ```

  The ID is the long part of the sheet's link, between `/d/` and `/edit`.

- [x] If `.env.local` uses Vercel OIDC, refresh it first (`vercel env pull .env.local`),
      because the token expires after 12 hours. Then re-add `MEMBERSHIP_SHEET_ID` if it
      was overwritten.
- [x] Read-only check:

  ```bash
  npm run check:membership-sheet
  ```

  It prints the spreadsheet title, the columns it found for `ID`, `Name` and `Email`, the
  other columns it will leave alone, the next row it would write, and the IDs' lengths
  and format. It never prints names or emails.

- [x] Write check, on the test copy only:

  ```bash
  npm run check:membership-sheet -- --write-test
  ```

  It writes one row (ID, Name and Email only, with a name starting with `=` to show it's
  stored as text), reads it back, and clears those three cells.

- [ ] Point `MEMBERSHIP_SHEET_ID` at the **real** sheet and run the read-only check once
      more. Don't use `--write-test` there; it refuses anyway.

## 5. Vercel

- [ ] Set `MEMBERSHIP_SHEET_ID` in Vercel: the test copy for Preview (staging) while
      testing, and the real sheet for Production when PRD 013 ships.

## Results to note in PRD 013

- The column letters for `ID`, `Name` and `Email`, and the other columns' names.
- The ID lengths seen, to confirm the 8-character format (D3).
- Whether the write check passed.
- Whether a test email reached `officers@` (checked in phase 1).
