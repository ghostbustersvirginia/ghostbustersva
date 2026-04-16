# PRD 006: Resend Implementation — Contact & Appearance Forms

**Status:** ready-for-implementation
**Author:** afton
**Date:** 2026-04-16
**Supersedes:** PRD 005 (planning only)

---

## Goal

Wire both the contact form and the appearance request form to Resend for email delivery. Remove all Formspree dependencies. Follow `docs/RESEND_SETUP.md` as the implementation source of truth.

---

## Current State Inventory

### Contact form (`ContactBookingPanel.astro` / `contact.astro`)

- Plain HTML `<form>` that POSTs directly to `https://formspree.io/f/xpqybzjj`
- `formspreeAction` prop threaded from `contact.astro` → `ContactBookingPanel.astro`
- Falls back to Formspree URL if `settings.contactFormActionUrl` is not set
- Honeypot field (`_gotcha`) already present
- No AJAX submission — full page POST to Formspree
- `public/contact-form-client.js` handles datepicker/field visibility only, no submit override

### Appearance request form (`AppearanceRequestContext.tsx`)

- `FORMSPREE_URL = "https://formspree.io/f/xpqybzjj"` in `constants.ts`
- `handleSubmit` in context POSTs JSON to `FORMSPREE_URL`
- `buildPayload()` in `helpers.ts` includes Formspree-specific keys (`_subject`, `email` as reply-to signal)
- No honeypot or timing check on this form currently

### Infrastructure

- `astro.config.mjs` uses `output: "static"` — must change to `"hybrid"` to support API routes
- No `src/pages/api/` directory exists
- No `resend`, `@upstash/redis`, or `@upstash/ratelimit` packages installed
- No `.env.example` file exists

---

## Environment Variables

### Already connected in Vercel (user confirmed)

- `RESEND_API_KEY`

### Must be added to Vercel + local `.env`

| Variable                    | Purpose                                                           | Required                             |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| `CONTACT_FROM_EMAIL`        | Verified sending domain address (e.g. `hello@ghostbustersva.org`) | Yes                                  |
| `CONTACT_TO_EMAIL`          | Inbox to receive form submissions                                 | Yes                                  |
| `UPSTASH_REDIS_REST_URL`    | Redis URL for durable rate limiting                               | Recommended                          |
| `UPSTASH_REDIS_REST_TOKEN`  | Redis token for durable rate limiting                             | Recommended                          |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (baked into client bundle)          | Optional — add when spam starts      |
| `TURNSTILE_SECRET_KEY`      | Cloudflare Turnstile secret key (server-only)                     | Optional — both must be set together |

### Manual setup required before adding these vars

See **Section: Manual Dashboard Work** at the bottom of this document.

---

## Architecture

### Two API endpoints, shared utilities

Create `src/pages/api/contact.ts` and `src/pages/api/appearance.ts`. Both endpoints:

- Export `export const prerender = false`
- Accept `POST` with JSON body
- Share a utility for Resend sending (`src/lib/email.ts`)
- Share a rate-limiter (`src/lib/rate-limit.ts`)
- Return `{ ok: boolean, error?: string }` JSON

### File structure to create

```
src/
  pages/
    api/
      contact.ts          ← new
      appearance.ts       ← new
  lib/
    email.ts              ← new (shared Resend send utility)
    rate-limit.ts         ← new (Upstash + memory fallback)
.env.example              ← new
```

---

## Implementation Steps

### Step 1 — Install packages

```
npm install resend @upstash/redis @upstash/ratelimit
```

### Step 2 — Update `astro.config.mjs`

Change `output: "static"` to `output: "hybrid"`.

Add env field schema entries:

```ts
RESEND_API_KEY: envField.string({ context: "server", access: "secret" }),
CONTACT_FROM_EMAIL: envField.string({ context: "server", access: "secret" }),
CONTACT_TO_EMAIL: envField.string({ context: "server", access: "secret" }),
UPSTASH_REDIS_REST_URL: envField.string({ context: "server", access: "secret", optional: true }),
UPSTASH_REDIS_REST_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: "client", access: "public", optional: true }),
TURNSTILE_SECRET_KEY: envField.string({ context: "server", access: "secret", optional: true }),
```

### Step 3 — Create `src/lib/rate-limit.ts`

- Export `async function checkRateLimit(key: string): Promise<{ limited: boolean }>`
- In production (when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present): use `@upstash/ratelimit` with a sliding window of 5 requests per 10 minutes per key
- In development / missing env vars: use an in-memory `Map<string, number[]>` fallback with the same window (not durable, acceptable for local dev)
- Rate-limit key: combine IP + email or IP alone for the contact form; IP + contactEmail for the appearance form
- IP extraction: read from `request.headers.get("x-forwarded-for")` (first value) or `"unknown"` as fallback

### Step 4 — Create `src/lib/email.ts`

Export:

```ts
interface SendEmailOptions {
  replyTo: string;
  subject: string;
  html: string;
}

async function sendEmail(options: SendEmailOptions): Promise<{ ok: boolean; error?: string }>;
```

Implementation notes:

- Import `Resend` from `"resend"`
- Read `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` from `import.meta.env`
- Set `from: CONTACT_FROM_EMAIL`, `to: [CONTACT_TO_EMAIL]`, `reply_to: options.replyTo`
- Escape all user-supplied content using a simple HTML entity escape helper before interpolating into the email template
- On Resend API error, log structured error and return `{ ok: false, error: "send_failed" }`
- HTML escape function: replace `&`, `<`, `>`, `"`, `'` with entities

### Step 5 — Create `src/pages/api/contact.ts`

Handles the contact form submission.

**Expected JSON request body fields:**

- `name` (required)
- `telephone` (required)
- `email` (required, valid email format)
- `inquiryType` (required, must be one of the values from `src/lib/contact-form.ts` `inquiryTypeOptions`)
- `briefDescription` (required)
- `location` (optional)
- `eventDate` (optional)
- `eventEndDate` (optional)
- `_hp` (honeypot, must be empty)
- `_t` (timing, Unix ms timestamp, must be ≥ 3000 ms ago)

**Validation and anti-abuse checks (in order, log and reject early):**

1. Method must be `POST`, origin must match `Astro.request.headers.get("origin")` against the site URL
2. Parse JSON body; on parse error return `400 { ok: false, error: "invalid_request" }`
3. Honeypot (`_hp`) must be empty string or absent; if filled return `200 { ok: true }` (silent reject)
4. Timing check: `Date.now() - _t` must be ≥ 3000ms; if too fast return `200 { ok: true }` (silent reject)
5. Validate required fields; return `400 { ok: false, error: "validation_failed", fields: [...] }` listing which fields failed
6. Validate `inquiryType` is in the allowlist
7. Rate limit by IP: if limited, log `{ event: "contact_rejected", reason: "rate_limited" }` and return `429 { ok: false, error: "rate_limited" }`
8. If `PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are both set: verify `cf-turnstile-response` token from body; on fail return `400 { ok: false, error: "turnstile_failed" }`
9. Call `sendEmail()` with escaped HTML body; on failure log `{ event: "contact_send_failed" }` and return `502 { ok: false, error: "send_failed" }`
10. Log `{ event: "contact_sent" }` and return `200 { ok: true }`

**Email HTML format:**

```
<h2>Contact Form Submission</h2>
<p><strong>Name:</strong> {name}</p>
<p><strong>Email:</strong> {email}</p>
<p><strong>Telephone:</strong> {telephone}</p>
<p><strong>Inquiry Type:</strong> {inquiryType}</p>
[if location] <p><strong>Location:</strong> {location}</p>
[if eventDate] <p><strong>Event Date:</strong> {eventDate}</p>
[if eventEndDate] <p><strong>Event End Date:</strong> {eventEndDate}</p>
<p><strong>Message:</strong></p>
<p>{briefDescription}</p>
```

**Subject:** `Contact Form: {inquiryType} from {name}`

### Step 6 — Create `src/pages/api/appearance.ts`

Handles the appearance request form submission.

**Expected JSON request body:** all fields from `FormData` type in `src/components/AppearanceRequestForm/types.ts`, plus:

- `_hp` (honeypot)
- `_t` (timing)

**Validation and anti-abuse checks (same order as contact):**

1. Origin check
2. JSON parse
3. Honeypot silent pass
4. Timing silent pass
5. Required fields: `contactName`, `contactEmail` (valid format), `eventName`, `eventType`, `isScheduled`, `addressLine1`, `city`, `state`, `charitableDonationsAllowed`, `needsLogistics`
6. Rate limit by IP + contactEmail
7. Optional Turnstile check (same logic)
8. Call `sendEmail()` with appearance email body
9. Log and return

**Email HTML format:** Render a structured summary of all non-empty fields, grouped into sections matching the form steps:

- **Event Details:** Event Name, Event Type, Is Scheduled, dates/times if scheduled
- **Location:** Address fields
- **Event Needs:** Charitable donations, logistics flag
- **Logistics:** Ecto vehicle info, parking, tables, chairs (only render if provided)
- **Contact:** Contact Name, Email, Phone, Company, Website
- **Additional Notes:** additionalInfo (if provided)

**Subject:** `Appearance Request: {eventName} — {contactName}`

### Step 7 — Update `public/contact-form-client.js`

Add AJAX form submission handling. At the bottom of `initContactForm()`, after all existing init code, add:

- Find the `.contact-form` element
- Record `Date.now()` as `_loadTime` immediately on page load (before form init)
- On `submit` event: `event.preventDefault()`
- Collect all named form fields into a plain object
- Add `_hp: ""` from honeypot field value (already in DOM as `name="_gotcha"` — rename to `_hp` in the HTML, see Step 8)
- Add `_t: _loadTime` (page load timestamp, not submit timestamp, to measure time-on-page)
- Add `cf-turnstile-response` if the token element is present (`#cf-turnstile-response`)
- POST JSON to `/api/contact`
- On success (`ok: true`): replace form HTML with a success message ("Thanks! We'll be in touch.")
- On failure: show error message below the submit button in a `role="alert"` element; re-enable the submit button
- Disable submit button during request; restore on failure

### Step 8 — Update `ContactBookingPanel.astro`

- Remove `formspreeAction` prop everywhere (interface, destructure, form `action` attribute)
- Change `<form action={formspreeAction} method="POST" ...>` to `<form method="POST" ...>` (JS will override submit)
- Rename the honeypot input `name` from `_gotcha` to `_hp` to match the endpoint expectation
- Add a hidden timing field: `<input type="hidden" name="_t" value="" data-timing-field />` — JS will populate this on submit
- Keep all existing fields and their `name` attributes exactly as-is; the AJAX handler in `contact-form-client.js` reads them by name
- Remove references to Formspree in comments

### Step 9 — Update `contact.astro`

- Remove `defaultFormAction`, `formspreeAction` constants and their Formspree fallback logic
- Remove `formspreeAction` prop from `<ContactBookingPanel>` invocation
- Update `ContactBookingPanel` interface no longer requires `formspreeAction`

### Step 10 — Update appearance form constants and helpers

In `src/components/AppearanceRequestForm/constants.ts`:

- Replace `FORMSPREE_URL` with `APPEARANCE_ENDPOINT = "/api/appearance"`
- Export it

In `src/components/AppearanceRequestForm/helpers.ts`:

- In `buildPayload()`: remove Formspree-specific keys `_subject` and `email` (those were Formspree conventions; the endpoint handles subject and reply-to natively)
- Add `_hp: ""` and `_t: String(Date.now())` to the returned payload in `buildPayload()` — timing is captured at payload-build time which happens on submit, providing enough real-user time
- Rename comment from "FormSpree payload builder" to "Appearance request payload builder"

In `src/components/AppearanceRequestForm/AppearanceRequestContext.tsx`:

- Replace `import { SESSION_KEY, FORMSPREE_URL, ... }` with `import { SESSION_KEY, APPEARANCE_ENDPOINT, ... }`
- Change `fetch(FORMSPREE_URL, ...)` to `fetch(APPEARANCE_ENDPOINT, ...)`
- The response shape `{ ok: boolean, error?: string }` already matches what the endpoint returns — no other changes needed

### Step 11 — Create `.env.example`

```
# Resend email delivery (required)
RESEND_API_KEY=re_your_key_here
CONTACT_FROM_EMAIL=hello@yourdomain.com
CONTACT_TO_EMAIL=your-inbox@example.com

# Upstash Redis rate limiting (recommended — memory fallback used if absent)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cloudflare Turnstile (optional — activate when spam starts)
# Use dummy test keys below for local dev (always pass):
PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
# Replace with real keys from cloudflare.com/turnstile for production

# Google Maps (existing)
# GOOGLE_MAPS_API_KEY=
```

### Step 12 — Add/update tests

In `tests/contact-form.test.ts` or a new `tests/api-endpoints.test.ts`:

- Happy path: valid contact form payload → `200 { ok: true }` (mock Resend send to return success)
- Honeypot filled → `200 { ok: true }` (silent pass, no email sent)
- Timing too fast (`_t` = `Date.now()`) → `200 { ok: true }` (silent pass)
- Missing required field → `400 { ok: false, error: "validation_failed" }`
- Invalid email format → `400`
- Rate limited → `429`
- Resend failure → `502`
- Same happy/reject paths for appearance endpoint

### Step 13 — Verify build and tests

Run `npm run check` (typecheck + lint + format + tests) and `npm run build`. Both must pass before done.

---

## What to Preserve / Not Change

- All form field names in `ContactBookingPanel.astro` — unchanged (except honeypot rename `_gotcha` → `_hp`)
- All appearance form field names and step structure — unchanged
- All existing form UX, success/error display patterns — unchanged (contact form adds AJAX; appearance form already uses AJAX)
- The `settings.contactFormActionUrl` CMS field — remove it from the contact page logic; it was only used to override the Formspree URL and is no longer needed
- `contact-form-client.js` datepicker and field visibility logic — untouched

---

## Manual Dashboard Work (Do Before or Right After Deploy)

### Already done

- `RESEND_API_KEY` is connected in Vercel.

### Must do before enabling production traffic

**Resend dashboard:**

1. Confirm a sending domain is verified (DNS records added and Resend shows "Verified").
2. `CONTACT_FROM_EMAIL` must be an address on that verified domain (e.g. `hello@ghostbustersva.org`).
3. Add `CONTACT_FROM_EMAIL` and `CONTACT_TO_EMAIL` to Vercel env vars (Production + Preview).

**Vercel:**

1. Add `CONTACT_FROM_EMAIL` and `CONTACT_TO_EMAIL` under Project Settings → Environment Variables.
2. Redeploy after adding vars.
3. Smoke test: submit the contact form on the deployed URL, confirm message arrives at `CONTACT_TO_EMAIL` with the submitter as `Reply-To`.

### Recommended (do after initial validation)

**Upstash Redis:**

1. Create a Redis database at upstash.com (or via Vercel Storage integration).
2. Copy the REST URL and REST token.
3. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel env vars.
4. Redeploy.

### Optional (add when spam starts)

**Cloudflare Turnstile:**

1. Go to cloudflare.com → Turnstile → Add widget.
2. Name: "GBVA Contact"
3. Allowed hostnames: production domain, `gbva-site.vercel.app`, `localhost` (if not using dummy keys locally)
4. Mode: Managed (recommended)
5. Copy Site Key → `PUBLIC_TURNSTILE_SITE_KEY`; copy Secret Key → `TURNSTILE_SECRET_KEY`
6. Add both to Vercel env vars.
7. **Important:** `PUBLIC_TURNSTILE_SITE_KEY` is baked into the client bundle at Astro build time — a full redeploy is required after adding it.
8. Add the Turnstile widget script and a container `<div class="cf-turnstile" data-sitekey="...">` to both forms in the HTML.
9. The API endpoints will activate Turnstile verification automatically when both keys are present.
10. For local dev, use Cloudflare's dummy test keys (pre-filled in `.env.example`).

**Alerting:**

1. Connect Vercel Log Drain to an observability tool (Better Stack, Axiom, Datadog, etc.).
2. Create 3 alerts as described in `docs/RESEND_SETUP.md` Section 8:
   - Rate-limit spikes on `contact_rejected` + `reason: rate_limited`
   - Send failures on `contact_send_failed`
   - POST volume spike on `/api/contact` or `/api/appearance`

---

## Acceptance Criteria

- [ ] `npm run check` passes (typecheck, lint, format, tests)
- [ ] `npm run build` passes
- [ ] Appearance requests POSTed to `/api/appearance`, no Formspree dependency
- [ ] Contact form POSTed to `/api/contact` via AJAX, no Formspree dependency
- [ ] `FORMSPREE_URL` constant removed from codebase
- [ ] `formspreeAction` prop chain removed from `contact.astro` and `ContactBookingPanel.astro`
- [ ] Honeypot, timing, origin, and rate-limit checks active on both endpoints
- [ ] Structured logs present for success, reject, and send-failure events
- [ ] `.env.example` created with all canonical vars and dummy Turnstile keys
- [ ] Env var schema in `astro.config.mjs` updated
- [ ] Tests cover happy path + key failure paths for both endpoints
- [ ] Post-deploy smoke test: submission arrives at `CONTACT_TO_EMAIL` with correct `Reply-To`
