**# Resend + Vercel Contact Form Playbook**

Purpose: reusable setup standard for small sites using a contact form with Resend email delivery, Vercel hosting, optional Upstash rate limiting, and basic alerting.

Use this as both:

- a manual checklist for dashboard work
- an instruction file for coding agents

**## 1. Default Architecture**

- Host: Vercel
- App endpoint: one canonical route only (no duplicate legacy endpoints)
- Email provider: Resend
- Sender identity: verified domain mailbox-style address (for example, `hello@yourdomain.com`)
- Destination inbox: personal inbox is acceptable (`CONTACT_TO_EMAIL`)
- Reply behavior: set `Reply-To` to the form submitter email
- Anti-abuse baseline:

- server-side validation

- honeypot field

- timing check

- same-origin check

- rate limiting (Upstash in production, memory fallback in local)

**## 2. Canonical Environment Variables**

Required:

- `RESEND_API_KEY`
- `CONTACT_FROM_EMAIL`
- `CONTACT_TO_EMAIL`

Optional but recommended:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional: Cloudflare Turnstile (add when spam starts):

- `PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- Both must be set together or neither will activate.

Rules:

- `CONTACT_FROM_EMAIL` must be on a domain verified in Resend for the same account/workspace as the API key.
- Do not use personal Gmail/Outlook as `CONTACT_FROM_EMAIL` for production sending.
- `CONTACT_TO_EMAIL` can be personal.
- Keep `.env` out of git.

**## 3. Dashboard Steps: Resend**

1. Add or confirm a sending domain in Resend.

2. Copy required DNS records from Resend.

3. In domain DNS provider, add records exactly as provided.

4. Wait for Resend domain status to become Verified.

5. Create API key with Sending access.

6. Confirm key scope/domain access is correct.

7. Decide sender identity:

- set `CONTACT_FROM_EMAIL` to a verified-domain address (mailbox does not have to exist for outbound)

8. In project docs, record which Resend account/workspace owns this key/domain.

**## 4. Dashboard Steps: Domain Provider (DNS)**

1. Add Resend DNS records exactly (MX/TXT/CNAME as provided).

2. Keep host/name values exact (for example, `send`, `resend._domainkey`, etc., per Resend UI).

3. Use sensible TTL (default is fine).

4. Do not delete existing site records unless required.

5. Re-check in Resend until domain is Verified.

**## 5. Dashboard Steps: Vercel**

1. Add env vars in Vercel project settings:

- Production

- Preview

- Development (if needed)

2. Minimum set:

- `RESEND_API_KEY`

- `CONTACT_FROM_EMAIL`

- `CONTACT_TO_EMAIL`

3. If using Upstash:

- `UPSTASH_REDIS_REST_URL`

- `UPSTASH_REDIS_REST_TOKEN`

4. If using Cloudflare Turnstile:

- Production: `PUBLIC_TURNSTILE_SITE_KEY` (real key), `TURNSTILE_SECRET_KEY` (real key)

- Preview: dummy keys are acceptable (`PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`, `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`)

- Redeploy required after adding `PUBLIC_TURNSTILE_SITE_KEY` (baked into client bundle at build time).

5. Redeploy after env changes.

6. Smoke test one form submit on deployed URL.

**## 6. Dashboard Steps: Upstash Redis (Rate Limiting)**

1. Create Redis database (via Vercel Storage integration or Upstash directly).

2. Add REST URL and REST token to Vercel env vars.

3. Confirm app uses Redis for limiter keys in production.

4. Keep memory fallback for local development only.

Notes:

- Free tiers are usually available, but verify current plan limits before launch.
- Without Redis, serverless memory-based limits are not durable across instances.

**## 7. Dashboard Steps: Cloudflare Turnstile**

1. Create a Cloudflare account at cloudflare.com if one does not exist.

2. Navigate to the Turnstile section in the left sidebar.

3. Click "Add widget" and configure:

- Widget name

- Allowed hostnames: production domain, Vercel preview domain (for example, `yourproject.vercel.app`), and `localhost` only if NOT using dummy keys locally

4. Select widget mode: Managed (recommended default).

5. Copy keys:

- Site Key → `PUBLIC_TURNSTILE_SITE_KEY`

- Secret Key → `TURNSTILE_SECRET_KEY`

Notes:

- `PUBLIC_TURNSTILE_SITE_KEY` is baked into the client bundle at build time in Astro — a redeploy is required after adding it to Vercel.

- Cloudflare provides dummy test keys for local dev that always pass: Site key `1x00000000000000000000AA`, Secret key `1x0000000000000000000000000000000AA`.

- Turnstile activates conditionally when both env vars are present — if either is missing, verification is skipped silently.

**## 8. Dashboard Steps: Alerting**

Recommended: connect Vercel Log Drain to Better Stack, Datadog, Axiom, or similar.

Create 3 alerts:

1. Rate-limit spike:

- event contains `contact_rejected`

- reason contains `rate_limited`

- threshold example: > 20 in 5 minutes

2. Send failures:

- event contains `contact_send_failed`

- threshold example: > 3 in 10 minutes

3. Request-volume spike:

- count of POST `/api/contact`

- threshold: > 3x normal baseline for 10 minutes

Send alerts to email or Slack.

**## 9. Agent Implementation Standard**

When asking an agent to implement contact email stack, require:

1. Use one canonical endpoint only.

2. Use exact env var names from this playbook.

3. Validate all fields server-side.

4. Escape email HTML content.

5. Set `Reply-To` to submitter email.

6. Return JSON `{ ok: boolean }` for AJAX mode.

7. Log structured reject/send-failure reasons.

8. Add or update `.env.example` — must include `PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` with dummy key values pre-filled as defaults and a comment indicating they should be replaced with real Cloudflare keys for production.

9. Add or update env typings.

10. Add/adjust tests.

11. Run tests and production build before done.

**## 10. Smoke Test Checklist (Post-Deploy)**

1. Submit valid form:

- Expect 200 and success UI.

2. Confirm message arrives at `CONTACT_TO_EMAIL`.

3. Confirm `Reply-To` is the submitter email.

4. Submit 2 to 3 rapid requests:

- Expect rate limiting to eventually trigger.

5. Confirm logs show:

- success

- reject reasons

- send failures (if simulated)

6. Turnstile check: submit the form in production and confirm the network request payload includes a `cf-turnstile-response` token. If the token is missing, both env vars are likely not set or the client widget is not rendering.

**## 11. Common Failure Map**

- 429 from `/api/contact`:

- limiter triggered before provider send

- check rate-limit reason in logs

- 502 from `/api/contact`:

- provider send failed

- check provider error and sender domain verification

- no Resend failure event but request failed:

- likely rejected before send (validation/rate-limit/origin)

- sender rejected:

- `CONTACT_FROM_EMAIL` not on verified sending domain

**## 12. Security Baseline (Small Sites)**

Minimum acceptable:

- validation + honeypot + timing + origin + rate limit

Add when spam starts:

- Cloudflare Turnstile — see Section 7 for setup. Uses dummy keys locally, real keys in production. Silent fallthrough if env vars are absent.
- stronger per-IP and per-email limits
- geo/ASN blocking (if needed)

**## 13. Copy/Paste Prompt for Future Projects**

Use this prompt with your coding agent:

"Implement a production-ready contact form email flow on Vercel using Resend, following RESEND_SETUP.md exactly. Use one canonical API endpoint, canonical env vars, server-side validation, anti-spam checks, structured logging, optional Upstash Redis limiter with fallback, and update .env.example + env typings + tests. Then run tests and build. Also provide a dashboard checklist for Resend, DNS, Vercel, Upstash, and alerting."
