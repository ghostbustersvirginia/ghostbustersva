# PRD 009: Calendar Images, Maps and Date Ranges

**Status:** draft
**Author:** Jonathan Cook
**Date:** 2026-11-23

## Goal

Make member calendar events easier to recognize and find:

- each event's image as a hero image,
- a map of each event's location,
- a map panel of every event in the visible period,
- a hover preview in month and week views,
- an optional home location so maps can be centered on each member, with distances,
- date range controls in the list view.

Builds on PRD 008 (member calendar).

## Scope

### Included

- A hero image from each event's first PNG/JPEG Google Calendar attachment. Events
  without one show no image.
- The hero image in the list view, the event details dialog and the month/week hover card.
- A hover card for events in month and week views.
- A Google Map in the event details dialog when the event has a real address, plus a
  "Get directions" button.
- A map panel that can be toggled on in month, week and list views, showing the visible
  period's events.
- Date range controls for the list view: presets, a custom range, and the range kept in
  the URL.
- An optional member home location (ZIP code or full address), shown on the map panel and
  used for distances and directions.

### Excluded

- Feeding event images into the public gallery (not now).
- Uploading or editing images from the site.
- Image formats other than PNG and JPEG.
- Fallback artwork for events without an image (skipped for now).

## Decisions

| Topic                     | Decision                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Image source              | Server proxy over the Drive API. Images come from a shared GBVA Drive folder, shared directly with the service account (no delegation) |
| No image                  | No image is shown; no fallback artwork for now                                                                                         |
| Image formats             | PNG and JPEG only. Other attachments are ignored                                                                                       |
| Image list performance    | Large image lists are acceptable. Images still lazy-load                                                                               |
| Hero image in the dialog  | Yes                                                                                                                                    |
| Maps                      | Google: Maps Embed API in the dialog; Maps JavaScript API + Geocoding API for the panel                                                |
| Non-addresses             | No map for "Online", "TBD", URLs, etc.                                                                                                 |
| Private addresses         | Fine to show to members                                                                                                                |
| Virtual events            | Never mapped                                                                                                                           |
| Hover on touch / keyboard | Hover card also opens on keyboard focus; on touch, tapping opens the dialog as today                                                   |
| Custom range vs History   | While a custom range is set, the Show History toggle is ignored                                                                        |
| Range cap                 | 18 months                                                                                                                              |
| Map panel layout          | Stacked below the calendar in every view and at every screen size                                                                      |
| Map panel state           | Remembered in localStorage                                                                                                             |
| Map script                | Loaded only when the panel is first turned on                                                                                          |
| Same-venue events         | Grouped into one marker                                                                                                                |
| Map markers               | Colored by chapter                                                                                                                     |
| Map filters               | The map follows the chapter filter, search, History and the range                                                                      |
| Home location             | Optional ZIP code or address, geocoded once, stored only in the browser, exact coordinates                                             |
| Distance filter           | \"Within 25 / 50 / 100 miles\" in every view, when a home location is set                                                              |

## Requirements

### R1. Hero images (server)

1. The events API reads each event's `attachments`. The hero is the **first attachment whose
   `mimeType` is `image/png` or `image/jpeg`**. The normalized event gains
   `image: { id: string; width?: number; height?: number } | null`. No Drive URL or file ID
   is sent to the browser.
2. `GET /api/calendar/image/:eventId?w=<width>` returns the image.
   - Members only: it uses the same session check as the other calendar routes and returns
     401 or 403 otherwise.
   - The server fetches the file from the Drive API, resizes it to the requested width
     (allowed: `320`, `640`, `1200`) and re-encodes it as JPEG or WebP.
   - Resized images are cached, keyed by `fileId + modifiedTime + width` (e.g. Vercel Blob,
     private). Responses use `Cache-Control: private, max-age=86400`.
   - Files over 15 MB, or that aren't PNG or JPEG, are rejected, and the event shows no
     image.
3. **Drive access** (see Setup):
   - Organizers attach images from a **shared GBVA Drive folder** that is shared directly
     with the service account (read-only).
   - The server reads files as the service account itself, with the `drive.readonly`
     scope and **no delegation**, the same way it checks group membership.
   - If the server can't read the file (403 or 404), the event shows no image. Log it once
     per file.
4. RSVPs keep patching only `attendees`, so attachments are untouched. One test against a
   real event with an attachment confirms this.

### R2. Hero images (UI)

1. **List view:** the image sits under the chapter and tag chips and above the title,
   full row width.
   - The box has a fixed aspect ratio (16:9, `object-fit: cover`), so rows don't jump as
     images load.
   - Images use `loading="lazy"` and `srcset` at 320 and 640 px.
2. **Details dialog:** the image at the top of the dialog, 1200 px, with a 16:9 box.
3. **Hover card** (R3): the image at 320 px.
4. Alt text is the event title. Events without an image show no image area.

### R3. Hover card (month and week views)

List view has no hover card, since its rows already show the image and details.

1. Hovering an event, or focusing it with the keyboard, opens a card after about 300 ms.
   It closes when the pointer or focus moves away (with about 150 ms of grace so the
   pointer can move onto the card).
2. **Content:** hero image, chapter and Interest chips, title, date and time, location,
   your RSVP status, and the yes/maybe/no counts.
3. The card never covers the event it belongs to. It's positioned next to the event and
   stays on screen.
4. Clicking the event still opens the details dialog. The card is a preview only, with no
   buttons.
5. On touch devices there's no card; tapping opens the dialog as it does now. Detect this
   with `(hover: hover)`.
6. The card uses `role="tooltip"` and is linked to the event with `aria-describedby`.

### R4. Location map in the details dialog

1. **Mappable location:** the `location` is not empty, and the event is not in the
   Virtual chapter. The location must not be any of these (case-insensitive):
   - a URL, such as `https://…` or `zoom.us`;
   - `online`, `virtual` or `tbd`;
   - text without a letter-and-number pattern that looks like an address or venue.

   Put this in a tested helper, `isMappableLocation`.

2. **Map:** a Google **Maps Embed API** iframe in "place" mode, using the event's
   location text.
   - Height is about 220 px, with `loading="lazy"` and a `title` of
     "Map of <location>".
   - It uses a browser key restricted to the site's addresses.
3. **"Get directions"** opens
   `https://www.google.com/maps/dir/?api=1&destination=<location>` in a new tab.
4. Locations that aren't mappable show the plain text, or the link if it's a URL.

### R5. Map panel

1. A **"Show map"** toggle in the toolbar works in month, week and list views.
   - The on/off state is saved in localStorage as `gbva.calendar.map.v1`.
   - The panel is stacked **below the calendar**, above the chapter legend, in every view
     and at every screen size.
2. **What it shows:** the visible events after the chapter filter, search, History or
   custom range, and the view's date range.
   - Virtual events and events without a mappable location are left out.
   - A count line says, for example, "12 events on the map · 3 without a mappable
     location".
3. **Geocoding:** `POST /api/calendar/geocode` (members only) takes the visible locations
   and returns coordinates.
   - The server calls the Google Geocoding API with a server key that's only allowed to
     use the Geocoding API.
   - Results are cached in Redis, keyed by normalized location text. The `place_id` is
     kept with no expiry. Coordinates expire after 30 days, per Google's terms.
   - At most 50 new geocodes per request, with the member rate limit applied.
   - Failed lookups are cached for 7 days, so bad addresses aren't retried constantly.
4. **Map:**
   - It uses the Maps JavaScript API, loaded only when the panel is first turned on, with
     a Map ID so it can use Advanced Markers.
   - Markers use the **chapter color**, and Virtual's dashed style doesn't apply since
     Virtual events aren't mapped.
   - The map zooms to fit all markers.
   - When nothing is mappable, it shows a message instead of an empty map.
5. **Same venue:** events with the same `place_id`, or the same coordinates, share one
   marker that shows a count. Clicking it lists those events; clicking one opens its
   details dialog.
6. **Linked highlighting:** hovering an event in the calendar highlights its marker, and
   clicking a single-event marker opens that event.
7. The map works with the keyboard: markers can be focused and have labels with the venue
   and event count.

### R6. List view date range

1. **Controls in list view:**
   - presets: **Next 30 days**, **Next 3 months**, **Next 6 months** (the default),
     **This year**, **Custom**;
   - **Custom** shows From and To date inputs.
2. **Range cap: 18 months.** Ranges must have To after From. Invalid ranges show an inline
   error and aren't applied.
3. While a **custom range** is set, the Show History toggle is **ignored**, so a past range
   shows its events. The toggle looks disabled and explains why.
4. **Shareable range:** the range is kept in the URL as `?from=YYYY-MM-DD&to=YYYY-MM-DD`,
   or `?range=30d|3m|6m|year`, so links reopen the same period. Changing views keeps the
   parameters only in list view.
5. **Loading:** events load with the existing chunked fetch (up to 90 days per request).
   Prev and next move by the length of the chosen range.
6. **Search** still covers its own wide range (PRD 008). The range controls only affect
   the list.

### R7. Member home location

1. **Asking:**
   - A **"My location"** control in the map panel lets a member enter a **ZIP code or a full
     address**. It's always optional, and nothing blocks the page.
   - The first time a member turns the map on, a one-line prompt offers it ("Add your ZIP
     code to see events near you"), and they can dismiss it.
   - An optional **"Use my current location"** button uses the browser's location, which
     asks the member's permission. It's never requested automatically.
2. **Geocoding:** the input is geocoded server-side with the Geocoding endpoint (R5.3).
   - Only US results are accepted; anything else gets an inline error.
   - The result is a **label** (Google's formatted address, or the ZIP code) plus **exact
     coordinates**.
   - **The server doesn't store anything about the member's location.** It geocodes the
     request and returns the result. The Redis geocoding cache (R5.3) is only for event
     venues, never member input.
3. **Storage:**
   - **Browser only:** localStorage `gbva.calendar.home.v1`, holding
     `{ label, lat, lng, savedAt }`. It doesn't follow the member to other devices.
   - **"Clear my location"** removes it.
   - Nothing about it is sent to the server again after geocoding. Distances and the
     "Within" filter are calculated in the browser, so other members and officers can
     never see it.
4. **Use:**
   - **Map panel:** a distinct "home" marker, not chapter-colored. The map fits home plus
     the visible events, or centers on home when there are no events.
   - **Distances:** the details dialog and hover card show the straight-line distance, e.g.
     "~23 mi away". It's calculated in the browser (no Distance Matrix API, so no cost).
   - **"Get directions":** adds the home location as the starting point
     (`&origin=<lat>,<lng>`) when one is set.
   - **"Within" filter:** a "Within 25 / 50 / 100 miles / Any" filter in the toolbar when a
     home location is set (default Any).
     - It applies in every view, alongside the chapter, search and History filters, and
       the map and search results follow it.
     - Events without a mappable location, including Virtual and Online events, are
       **kept** when the filter is on, because distance doesn't apply to them.
     - The choice is saved in localStorage with the home location.
5. **API:** `POST /api/member/geocode`, members only, accepts `{ query }` and returns
   `{ label, lat, lng }`.
   - It stores nothing and logs no query text.
   - The member rate limit and the Origin check apply.
   - "Use my current location" doesn't call the server at all. The browser's coordinates
     are used directly, with the label "Current location".

## Setup prerequisites (not code)

- [ ] **Shared Drive folder:** create a GBVA folder for event images, e.g. in a shared
      drive. Share it **directly with the service account**
      (`gbva-calendar-proxy@gbva-site.iam.gserviceaccount.com`) as **Viewer**.
  - The service account's address is outside the domain, so Drive's external sharing
    settings (Admin console → Apps → Google Workspace → Drive and Docs → Sharing settings)
    must allow sharing with it.
  - No domain-wide delegation change is needed.
- [ ] **Organizer convention:** attach event images from that folder, as PNG or JPEG.
- [ ] **Google Cloud:** enable the **Maps Embed API**, **Maps JavaScript API** and
      **Geocoding API**. Create a **Map ID** (vector) for Advanced Markers.
- [ ] **API keys:**
  - a browser key (Embed + Maps JavaScript) restricted to `ghostbustersva.com`, the
    staging domain and localhost;
  - a server key (Geocoding only).
  - Env vars: `PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, `PUBLIC_GOOGLE_MAPS_MAP_ID` and
    `GOOGLE_GEOCODING_KEY`.
- [ ] **Vercel Blob** store for resized images, private (Marketplace integration).
- [ ] **Privacy policy:** add that member calendar maps load content from Google Maps, and
      that event locations are sent to Google for geocoding.
      Also add the optional home location:
  - it's sent to Google once to geocode;
  - it's stored only in the member's own browser, never on GBVA's servers;
  - it can be cleared at any time.

## Phases

1. **Dialog map:** `isMappableLocation`, the Embed iframe and "Get directions" (R4).
2. **List date range:** presets, custom range, URL parameters, ignoring History, the cap
   (R6).
3. **Hero images:** Drive access, the image endpoint with resizing and caching, the list
   and the dialog (R1, R2).
4. **Hover card:** month and week views (R3).
5. **Map panel and home location:** the geocode endpoint and cache, markers, same-venue
   grouping, the home location with its marker, distances and "Within" filter, linked
   highlighting, filters, saved state (R5).

## Acceptance Criteria

- [ ] An event with a PNG or JPEG attachment from the shared folder shows it in the list,
      the dialog and the hover card. An event without one shows no image.
- [ ] Image URLs only work for members (401 without a session). Drive file IDs never reach
      the browser.
- [ ] A PDF attachment is ignored. When the server can't read an image, no image shows.
- [ ] An RSVP on an event with attachments leaves the attachments in place.
- [ ] Hovering or focusing an event in month or week view shows the card after a short
      delay, never covering the event. Touch devices open the dialog on tap.
- [ ] The dialog shows a map and "Get directions" for real addresses, and no map for
      Online, TBD, URLs or Virtual events.
- [ ] "Show map" works in month, week and list views, is remembered after a reload, and
      loads the Maps script only when first turned on.
- [ ] Map markers use chapter colors. Same-venue events share a marker with a count.
      Clicking a marker opens the event, and hovering an event highlights its marker.
- [ ] The map follows the chapter filter, search, History or custom range, and the view's
      range.
- [ ] Geocoding results are cached (a repeat view makes no Geocoding calls), with
      coordinates expiring after 30 days.
- [ ] List presets and the custom range work. Ranges over 18 months are rejected. A past
      custom range shows events with History off. The range survives a reload through the
      URL.
- [ ] Unit tests: attachment selection, `isMappableLocation`, location normalization and
      grouping, and range parsing and limits.
- [ ] Type check, lint and tests pass.

- [ ] Entering a ZIP code or address shows a home marker on the map, with exact
      coordinates. It's stored only in localStorage; Redis and server logs have no trace
      of it. "Clear my location" removes it.
- [ ] Distances appear in the dialog and hover card. "Get directions" starts from home.
- [ ] "Within 25/50/100 miles" limits every view, the map and search. Events with no
      mappable location stay visible.
