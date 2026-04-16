# Resend Setup — Ghostbusters Virginia

This doc covers what you need to do manually to get Resend working after running the implementation PRD. The code changes are defined in `docs/prds/006-resend-implementation.md` — run that first, then come back here.

---

## What the PRD handles (no manual work needed)

- Installs `resend`, `@upstash/redis`, `@upstash/ratelimit`
- Creates `/api/contact` and `/api/appearance` endpoints
- Removes all Formspree dependencies from both forms
- Wires both forms to submit via AJAX to the new endpoints
- Adds honeypot, timing, origin, and rate-limit checks
- Creates `.env.example` with all required vars and dummy Turnstile keys
- Updates env var schema in `astro.config.mjs`
- Adds tests and verifies build

---

## Environment Variables

### Already done

- `RESEND_API_KEY` — connected in Vercel.

### Must add before production traffic works

Add these in Vercel → Project Settings → Environment Variables (Production + Preview):

| Variable             | What it is                                                                       |
| -------------------- | -------------------------------------------------------------------------------- |
| `CONTACT_FROM_EMAIL` | Sending address on your verified Resend domain (e.g. `hello@ghostbustersva.org`) |
| `CONTACT_TO_EMAIL`   | The inbox where form submissions land — can be personal                          |

Rules:

- `CONTACT_FROM_EMAIL` must be on a domain that is **Verified** in Resend under the same account as the API key. The mailbox does not need to physically exist for outbound sending.
- Do not use a personal Gmail or Outlook address as `CONTACT_FROM_EMAIL`.
- Redeploy after adding vars.

### Recommended — add after initial smoke test

| Variable                   | What it is                                       |
| -------------------------- | ------------------------------------------------ |
| `UPSTASH_REDIS_REST_URL`   | Upstash Redis REST URL for durable rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token                         |

Without these the rate limiter uses an in-memory fallback, which is not durable across serverless instances. Fine for development, not reliable in production under any real load.

### Optional — add when spam starts

| Variable                    | What it is                      | Notes                                                          |
| --------------------------- | ------------------------------- | -------------------------------------------------------------- |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key   | Baked into client bundle — requires full redeploy after adding |
| `TURNSTILE_SECRET_KEY`      | Cloudflare Turnstile secret key | Server-only                                                    |

Both keys must be set or Turnstile is skipped silently. See setup steps below.

---

## Manual Setup Steps

### 1. Resend domain verification (if not already done)

1. Log in to resend.com.
2. Go to Domains → Add Domain.
3. Copy the DNS records Resend provides (MX, TXT, CNAME).
4. Add them exactly in your domain DNS provider. Do not delete existing site records.
5. Wait for Resend to show the domain as **Verified** (can take a few minutes to a few hours depending on DNS TTL).
6. Note which Resend account/workspace owns this key and domain — keep that consistent.

### 2. Set Vercel env vars

1. Vercel → Project → Settings → Environment Variables.
2. Add `CONTACT_FROM_EMAIL` and `CONTACT_TO_EMAIL` for Production and Preview.
3. Confirm `RESEND_API_KEY` is already present and scoped correctly.
4. Redeploy.

### 3. Upstash Redis (recommended)

1. Go to upstash.com (or use the Vercel Storage integration: Vercel → Storage → Create Database → Upstash Redis).
2. Create a Redis database.
3. Copy the REST URL and REST token from the database dashboard.
4. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel env vars.
5. Redeploy.

### 4. Cloudflare Turnstile (optional — when spam starts)

1. Go to cloudflare.com → Turnstile → Add widget.
2. Name: "GBVA Contact Forms"
3. Allowed hostnames: your production domain, `gbva-site.vercel.app`, and `localhost` only if not using dummy keys locally.
4. Widget mode: Managed.
5. Copy Site Key → `PUBLIC_TURNSTILE_SITE_KEY`; copy Secret Key → `TURNSTILE_SECRET_KEY`.
6. Add both to Vercel env vars.
7. **Trigger a full redeploy** — `PUBLIC_TURNSTILE_SITE_KEY` is baked into the Astro client bundle at build time and will not activate without a rebuild.
8. For local dev, use the pre-filled dummy keys in `.env.example` (always pass, no Cloudflare account needed).

### 5. Alerting (optional)

Connect Vercel Log Drain to an observability tool (Better Stack, Axiom, Datadog, etc.) and create 3 alerts:

1. **Rate-limit spike** — log event contains `contact_rejected` AND reason contains `rate_limited` — threshold: > 20 in 5 minutes.
2. **Send failures** — log event contains `contact_send_failed` — threshold: > 3 in 10 minutes.
3. **Volume spike** — POST count on `/api/contact` or `/api/appearance` exceeds 3x normal baseline in 10 minutes.

---

## Verifying the PRD Was Completed Correctly

Run these checks locally before deploying:

```
npm run check   # typecheck + lint + format + tests — must pass
npm run build   # production build — must pass
```

Then confirm these things in the codebase:

- [ ] `src/pages/api/contact.ts` exists
- [ ] `src/pages/api/appearance.ts` exists
- [ ] `src/lib/email.ts` exists
- [ ] `src/lib/rate-limit.ts` exists
- [ ] `.env.example` exists and includes all six vars with dummy Turnstile keys pre-filled
- [ ] `FORMSPREE_URL` no longer appears anywhere in the codebase (`grep -r "formspree" src/`)
- [ ] `formspreeAction` prop no longer appears in `contact.astro` or `ContactBookingPanel.astro`
- [ ] `astro.config.mjs` has `output: "hybrid"` and the new env field entries
- [ ] `AppearanceRequestForm/constants.ts` exports `APPEARANCE_ENDPOINT` not `FORMSPREE_URL`

---

## Post-Deploy Smoke Test

Do this on the deployed URL after adding env vars and redeploying:

1. Submit the contact form with valid data → expect success UI, no page reload.
2. Check `CONTACT_TO_EMAIL` inbox — message should arrive, `Reply-To` should be the submitter's email.
3. Submit the appearance request form through all steps → expect success screen.
4. Check `CONTACT_TO_EMAIL` inbox — appearance request email should arrive with all fields.
5. Submit the contact form 5–6 times in rapid succession → expect a rate-limit error response eventually.
6. Check Vercel logs — confirm structured log events: `contact_sent`, `contact_rejected` for rate-limited requests.

---

## Failure Reference

| Symptom                                        | Likely cause                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `502` from `/api/contact` or `/api/appearance` | Resend send failed — check `CONTACT_FROM_EMAIL` is on a verified domain                                       |
| `429`                                          | Rate limiter triggered — check logs for `contact_rejected` + `reason: rate_limited`                           |
| Form submits but no email arrives              | `CONTACT_TO_EMAIL` not set, or `CONTACT_FROM_EMAIL` domain not verified                                       |
| Request rejected before send, no Resend error  | Validation, honeypot, timing, or origin check failed — check logs                                             |
| Turnstile not activating                       | One or both Turnstile env vars missing, or client bundle not rebuilt after adding `PUBLIC_TURNSTILE_SITE_KEY` |
