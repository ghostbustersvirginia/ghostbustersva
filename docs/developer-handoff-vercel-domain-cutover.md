# Developer Handoff: Vercel Env, DNS, Domain Cutover, and Resend Prep

**Last updated:** 2026-04-10
**Audience:** developer handoff / deployment owner

## Purpose

This runbook covers:

1. What environment variables to set in Vercel.
2. How to connect the custom domain to Vercel via DNS.
3. What code/content settings to verify when moving from the Vercel preview domain to the live Ghostbusters Virginia domain.
4. What to prepare for the upcoming Formspree -> Resend migration (without implementing it yet).

## 1) Vercel Environment Variables

### Required now

- `SITE_URL`
  - Example: `https://ghostbustersva.org`
  - Used by canonical tags and sitemap generation.
  - Set this in Vercel for at least `Production` and `Preview`.
  - Keep protocol included (`https://`) and no trailing slash preferred.

### Not needed yet (for current branch)

- No Resend variables are used in current code.
- Keep Formspree in place for now (this branch is documentation-only).

### Prepare these for the upcoming Resend branch

- `RESEND_API_KEY`
  - Server-only secret.
  - Do not expose to client code.
- `CONTACT_TO_EMAIL`
  - Inbox destination for form submissions.
- `CONTACT_FROM_EMAIL`
  - Verified sender address (for example, `noreply@ghostbustersva.org`).
- `CONTACT_REPLY_TO_EMAIL` (optional)
  - Reply-to mailbox if different from sender.
- `PUBLIC_TURNSTILE_SITE_KEY`
  - Public key for bot challenge widget.
- `TURNSTILE_SECRET_KEY`
  - Server-side secret for challenge verification.

## 2) Domain + DNS Setup (Registrar -> Vercel)

## Step A: Configure domains in Vercel

1. Open Vercel project settings -> Domains.
2. Add both domains:
   - Apex/root: `ghostbustersva.org`
   - `www`: `www.ghostbustersva.org`
3. Set the preferred primary domain (usually apex).
4. Set redirect behavior so the secondary host redirects to the primary host.

## Step B: Configure DNS records at domain registrar

Use Vercel-provided record values shown in the Domains screen. Typical setup:

1. Apex/root (`@`) -> `A` record to Vercel's assigned IP.
2. `www` -> `CNAME` to Vercel's assigned CNAME target.
3. Remove conflicting old records for the same hostnames.
4. Use low TTL during cutover (for example 300s) if registrar allows.

Note: Some setups use Vercel nameservers instead of manual records. If the team already uses a DNS provider for email/services, manual records are usually simpler and safer.

## Step C: Validate cutover

1. Wait for DNS propagation.
2. Confirm Vercel marks domain as valid and certificate as issued.
3. Verify both hosts redirect correctly to the selected primary host.
4. Test homepage, internal routes, and assets over HTTPS.

## 3) Code and Content Updates When Moving to Live Domain

## Required update

1. Vercel env var: `SITE_URL` -> set to the final primary domain.

## Recommended code/content checks

1. `astro.config.mjs`
   - `productionSiteUrl` reads `process.env.SITE_URL`.
   - Fallback currently points to the Vercel app URL; this is fine as fallback, but can be updated to the live domain to reduce surprises in misconfigured environments.
2. `src/layouts/BaseLayout.astro`
   - `canonicalOrigin` also uses `SITE_URL`, then `Astro.site`, then hardcoded fallback.
   - Confirm fallback reflects the intended long-term domain.
3. `public/robots.txt`
   - Update hardcoded sitemap URL if domain differs from current value.
4. `.env.example`
   - Keep sample `SITE_URL` aligned with current production domain.
5. `README.md`
   - Keep canonical-domain examples aligned with real domain.
6. `src/content/settings/site.json`
   - Confirm `contactEmail` domain is still correct after domain/email cutover.

## 4) Post-Cutover Verification Checklist

- [ ] `SITE_URL` in Vercel is correct for Production.
- [ ] Canonical URLs render the primary custom domain (not `vercel.app`).
- [ ] `/sitemap-index.xml` uses primary custom domain.
- [ ] `robots.txt` sitemap URL is correct.
- [ ] Preview deployments remain `noindex,nofollow`.
- [ ] Contact page still submits successfully (current Formspree branch).
- [ ] SSL/TLS certificate valid for apex + www.

## 5) Resend Setup Notes (Preparation Only)

Do not implement in this branch. Use the PRD in `docs/prds/001-formspree-to-resend-contact-form.md`.

High-level prerequisites:

1. Create Resend account and verify sending domain.
2. Add DNS records Resend requires for domain authentication (SPF/DKIM and any other required records shown in Resend dashboard).
3. Keep API key only in Vercel environment variables (never client-side).
4. Use anti-abuse controls before launch:
   - Bot challenge verification
   - Honeypot field
   - Persistent server-side rate limiting
   - Strict request validation and fixed recipient routing
