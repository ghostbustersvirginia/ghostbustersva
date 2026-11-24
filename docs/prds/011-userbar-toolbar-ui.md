# PRD 011: Userbar and Toolbar UI

**Status:** draft
**Author:** Jonathan Cook
**Date:** 2026-11-24

## Goal

Make the member calendar's controls fit in one compact toolbar. The signed-in bar above the
calendar goes away: its items move into a user menu opened from an icon at the right end of
the toolbar. Search, distance, chapters, and the list view's time period become icons with
small dropdowns or panels, so the toolbar is much shorter on phones and somewhat shorter on
wider screens.

## Scope

### Included

- A user menu that replaces the signed-in bar (`.mc-userbar`).
- Search as an icon that opens the search results box, with the search field inside it.
- The "Within" distance control as an icon with a short distance label, plus a 10-mile
  option.
- The chapter filter as an icon with the number of chapters shown.
- The list view's "Show" range control as a calendar icon with a dropdown, moved into the
  toolbar.
- Icon-only toolbar buttons on phone widths.

### Excluded

- The FullCalendar header (prev/next, Today, the title, and the Month/Week/List buttons).
  Only the app's own toolbar is in scope.
- Changes to how search, filters, RSVPs, or the list range behave, other than what's listed
  here.
- A shared menu component. Each dropdown is built on its own (D6).

## Current state

- `MemberCalendarApp.tsx` renders `.mc-userbar` above the calendar: the member's name, an
  envelope icon whose tooltip is the email, then `DiscordLinkControl`, "Export Late
  Changes" (officers only), and "Sign out".
- `CalendarView.tsx` renders `.mc-toolbar`: a full-width search input, the History and Map
  toggles, `RsvpFilterMenu`, the "Within" select (only when a home location is set), and
  `ChapterFilter`.
- In list view, `ListRangeControls` renders a separate row under the toolbar: a "Show"
  select (Next 30 days, Next 3 months, Next 6 months, This year, Custom) and, for Custom,
  From and To dates with an Apply button.
- `RsvpFilterMenu` is a `<details>` dropdown that closes on an outside click or Esc.

## Requirements

### R1. User menu

1. A user icon button sits at the right end of the page header's title row, next to "Member
   Calendar". It opens the user menu. The header stays server-rendered Astro: `PageHeader`
   has an optional `actions` slot, and the calendar island renders the menu into it with a
   React portal (D11).
2. The menu lists, in order:
   - the member's name (no email);
   - the Discord line, only when the Discord integration is on: "Link Discord" when not
     linked, or the Discord username when linked;
   - a separator;
   - actions: "Unlink Discord" (when linked), "Export Late Changes" (officers only), and
     "Sign out".
3. "Link Discord" and "Unlink Discord" do what `DiscordLinkControl` does today. "Sign out"
   ends the site session, as the current button does. It doesn't sign the member out of
   Google.
4. `.mc-userbar` is removed. The Discord link and unlink notices stay where they are, as
   alerts above the calendar.
5. The menu closes on an outside click, on Esc (returning focus to the icon), and after an
   action is chosen.

### R2. Search

1. Search starts as an icon button in the toolbar instead of a wide input.
2. Clicking the icon opens the search results box. The search field is inside the box, at
   the top, and is focused automatically.
3. Before anything is typed, the box shows a short hint: "Type to search event titles and
   descriptions."
4. Results keep updating as the member types, as they do now (deferred input, one load of
   the wide search range per "History" setting).
5. Esc, or the box's close button, clears the search and closes the box, returning focus to
   the icon (D3).
6. While a search is active, the icon shows it is active, as other active filters do.

### R3. Distance ("Within")

1. The control still appears only when a home location is set. It doesn't depend on the map
   being on.
2. The "Within" text and select are replaced with a distance icon plus a short label of the
   chosen distance, such as "25 mi". With "Any distance" chosen, only the icon shows.
3. Clicking it opens a small dropdown with: Any distance, 10, 25, 50, and 100 miles.
4. `WITHIN_OPTIONS` gains 10. A saved home location with `within: 10` is read back
   correctly, and older saved values keep working.

### R4. Chapters

1. The chapter filter becomes a chapter icon with a small number: how many chapters are
   shown. The number shows all the time, including when every chapter is shown.
2. Clicking it opens the existing chapter choices in a dropdown. The chapter filter's
   behavior doesn't change.

### R5. Time period (list view)

1. The list view's "Show" control moves into the toolbar as a calendar icon with a dropdown.
   It shows only in list view, as the "Show" row does now.
2. The dropdown holds the whole current control: the presets, and for Custom, the From and
   To dates, the Apply button, the hint, and errors.
3. The separate `.mc-range` row under the toolbar is removed.
4. Choosing a preset applies it and closes the dropdown. Custom keeps the dropdown open until
   Apply succeeds.

### R6. Layout

1. **Phones (under about 600px):** every toolbar control shows its icon only. Text labels
   are hidden visually but stay available to screen readers (`sr-only`), and each button
   keeps a `title`. The toolbar fits on one row where possible.
2. **Wider screens:** the toolbar is shorter than today. Short labels may show where they
   fit, such as the RSVP filter's label and the distance and chapter counts.
3. Order, left to right: search, History, Map, RSVP filter, distance, chapters, then time period
   (list view). The user icon is in the page header (R1.1).
4. Every dropdown and panel stays on screen at 320px wide and doesn't cause horizontal
   page scroll.
5. Icon buttons are at least 40×40px to tap, and inputs keep the existing anti-zoom font
   size on iOS.

### R7. Accessibility

1. Each icon button has an accessible name ("Search events", "Chapters, 5 shown",
   "Within 25 miles", "List period: Next 30 days", "Account menu").
2. Dropdown triggers expose their open state (`aria-expanded`, or the `<details>` open
   state).
3. Keyboard: Tab reaches every control. Enter or Space opens a dropdown. Esc closes it and
   returns focus to its trigger.

## Phases

1. **User menu:** R1, and removing `.mc-userbar`.
2. **Search:** R2.
3. **Distance and chapters:** R3 and R4, including the 10-mile option.
4. **Time period:** R5.
5. **Layout pass:** R6 and R7 across the toolbar, checked at 320px, 600px, and desktop
   widths.

## Acceptance Criteria

- [ ] The signed-in bar is gone. The user icon at the right of the page title opens a menu
      with the member's name, the Discord line (when Discord is on), a separator, and the
      actions.
- [ ] "Export Late Changes" shows only for officers.
- [ ] Link, unlink, and sign-out work from the menu as they did from the bar.
- [ ] Clicking the search icon opens the results box with the field focused. Results update
      as you type. Esc clears and closes it.
- [ ] The distance control shows with a home location set, map on or off, as an icon with a
      short label. 10 miles is an option and is remembered.
- [ ] The chapter icon shows the number of chapters shown, including when all are shown.
- [ ] In list view, the calendar icon opens the full "Show" control, including custom dates.
      The separate range row is gone.
- [ ] At 320px the toolbar shows icons only, nothing overflows, and every dropdown fits on
      screen.
- [ ] Every control can be reached and used with the keyboard, and has an accessible name.
- [ ] `npm run check` passes for the changed files.

## Decisions

| #   | Topic            | Decision                                                                    |
| --- | ---------------- | --------------------------------------------------------------------------- |
| D1  | Name in menu     | Member name only, no email                                                  |
| D2  | Sign-out label   | "Sign out": it ends the site session, not the Google session                |
| D3  | Closing search   | Esc or the close button clears the search and closes the box                |
| D4  | Distance shows   | Whenever a home location is set, as today. Not tied to the map              |
| D5  | Chapter count    | Number of chapters shown, always visible. No "x of y" fraction              |
| D6  | Menus            | Each dropdown is its own component. No shared menu component                |
| D7  | Time period      | The whole list-view "Show" control, presets and custom dates, in a dropdown |
| D8  | Scope            | The app toolbar only. The FullCalendar header is unchanged                  |
| D9  | Phone breakpoint | Icons only under about 600px                                                |
| D10 | Discord in menu  | "Link Discord" when not linked; username and "Unlink Discord" when linked   |
