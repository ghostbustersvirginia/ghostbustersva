# PRD 001: Replace Formspree with Resend (Safe, Free-Tier Aware)

**Status:** draft
**Author:** Copilot (handoff prep)
**Date:** 2026-04-10

## Goal

Replace the current contact form delivery path (Formspree endpoint) with a server-side Resend integration that is secure by default, resilient to bot spam, and sustainable on free-tier limits.

## Scope

Included:

- Build a server-side submission path for contact form emails via Resend.
- Keep secrets out of client-side code.
- Add anti-abuse controls (challenge verification, honeypot, validation, rate limiting).
- Add operational docs and environment setup notes.
- Add tests for request validation and abuse controls.

Excluded:

- Removing historical Formspree data.
- Building an admin dashboard.
- Introducing a full backend database unless required for persistent rate limiting.

## Current State

- Contact form submits directly to a Formspree URL from static page markup.
- A honeypot field (`_gotcha`) already exists.
- Site is deployed on Vercel free tier and should avoid unnecessary server cost or complexity.

## Requirements

1. Submission architecture
   - Use a server-side endpoint (Vercel function or equivalent) to send email through Resend.
   - Frontend form should submit to internal endpoint (`/api/contact`) instead of direct third-party action URL.

2. Secret management
   - `RESEND_API_KEY` must be server-only.
   - No secret may be exposed through `PUBLIC_` variables or client bundles.

3. Input validation
   - Validate/sanitize all form fields server-side.
   - Enforce required fields and normalized formats for email/phone/date fields.
   - Reject oversized payloads and unexpected fields.

4. Anti-bot controls
   - Keep existing honeypot behavior.
   - Add bot challenge (Cloudflare Turnstile or equivalent) with server-side token verification.
   - Reject requests when challenge verification fails.

5. Rate limiting (free-tier protective)
   - Enforce per-IP limits in short windows (example target: <=5 per 10 minutes).
   - Enforce daily cap to avoid inbox/API abuse (example target: <=50/day).
   - Use a persistent store-backed limiter suitable for serverless (not in-memory only).

6. Delivery safety
   - Send to fixed allowlisted recipient(s), not arbitrary user-provided destinations.
   - Set controlled sender (`CONTACT_FROM_EMAIL`) and safe `reply-to`.
   - Block header injection and HTML/script payload abuse.

7. Abuse response UX
   - Return generic, non-sensitive error messages to the client.
   - Avoid exposing internal provider errors or stack traces.

8. Observability
   - Log submission attempts with minimal sensitive data.
   - Track accepted/rejected counts and rejection reasons category.

9. Backwards compatibility and rollout
   - Implement behind a controlled rollout path so cutover can be tested safely.
   - Keep a rollback path to Formspree until Resend path is verified.

10. Documentation

- Update `.env.example` with new variables (without real secrets).
- Update deployment runbook with Resend DNS/auth setup.

11. Testing

- Unit tests for validation and anti-abuse helpers.
- Integration tests for endpoint responses (success, validation fail, challenge fail, rate limit).
- Ensure no regression in contact page accessibility/behavior.

## Design Notes

- Keep static-site architecture for pages.
- Add one server-side contact endpoint for email dispatch.
- Preserve current form fields and event-specific conditional fields.
- Prefer plain-text email body first; optional HTML template can follow after stable delivery.

## Environment Variables (target)

- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`
- `CONTACT_REPLY_TO_EMAIL` (optional)
- `PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `SITE_URL` (already in use; continue)

## Acceptance Criteria

- [ ] Contact form no longer posts directly to Formspree.
- [ ] Resend API key is used only server-side.
- [ ] Bot challenge is required and verified server-side.
- [ ] Honeypot submissions are silently rejected.
- [ ] Rate limiting blocks abusive traffic and protects free-tier quotas.
- [ ] Valid submissions reach configured inbox with expected formatting.
- [ ] Error responses are user-friendly and non-sensitive.
- [ ] Tests cover validation, challenge failure, and rate-limit paths.
- [ ] Docs updated for Vercel env + Resend DNS/auth setup.

## Implementation Notes / Risks

- Free-tier quotas can change; confirm current Resend and Vercel limits during implementation.
- In-memory rate limiting is insufficient for serverless scale-out; choose persistent storage.
- Domain authentication for sender must be complete before production cutover.

## Rollout Plan

1. Implement endpoint + validation + challenge + limiter.
2. Deploy to preview with test keys and safe recipient.
3. Run abuse simulations (bot-like rapid posts, invalid tokens, oversized payloads).
4. Enable in production during low-traffic window.
5. Monitor logs and delivery for 48 hours.
6. Remove Formspree fallback only after stable operation.
