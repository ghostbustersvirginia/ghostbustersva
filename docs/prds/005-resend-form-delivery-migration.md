# PRD 005: Resend Form Delivery Migration

**Status:** draft
**Author:** afton
**Date:** 2026-04-14

## Goal

Define a safe migration plan to move form email delivery from Formspree to Resend for both:

- appearance request form
- contact form

This PRD is planning-only. No implementation is included in this document.

## Context

Current state:

- Appearance request flow submits directly to Formspree.
- Contact form uses the existing site endpoint/client flow and is not yet standardized on Resend.

Target state:

- A single canonical server endpoint handles outbound email delivery via Resend.
- Both forms share the same operational standards for validation, anti-abuse controls, observability, and failure handling.

Reference implementation guidance:

- docs/RESEND_SETUP.md

## Scope

In scope:

- Replace Formspree delivery for appearance requests with server-side Resend delivery.
- Update contact form delivery to use the same Resend-backed server path.
- Establish canonical environment variables and deployment checklist aligned with docs/RESEND_SETUP.md.
- Preserve existing user-facing form UX and success/error behavior where practical.
- Add required tests for happy path, validation reject paths, and provider failure handling.

Out of scope:

- Full redesign of either form UX.
- New CRM/inbox tooling beyond email delivery.
- Spam tooling beyond the baseline in docs/RESEND_SETUP.md.

## Requirements

1. Use one canonical API endpoint for form intake and delivery behavior.
2. Validate all required fields server-side before provider calls.
3. Use Resend as the only outbound email provider for these forms.
4. Set Reply-To to the submitter email when present/valid.
5. Keep sender identity on a verified domain mailbox-style address.
6. Keep destination routing configurable via environment variables.
7. Return consistent JSON success/failure shape for client handling.
8. Log structured rejection and provider-failure reasons for observability.
9. Keep anti-abuse protections enabled: honeypot, timing check, origin check, and rate limiting.
10. Keep optional Turnstile activation behavior as documented (both keys set or no-op).
11. Update environment typings and deployment docs with required variables.
12. Keep tests and production build green.

## Design Notes

- Follow docs/RESEND_SETUP.md as the implementation source of truth.
- Prefer a shared server utility for payload normalization and email rendering rather than per-form duplication.
- Preserve each form's subject/body conventions unless explicitly changed in copy review.
- Maintain accessibility and focus behavior in client-side error/success states.

## Risks and Mitigations

- Risk: sender domain not verified in Resend causes delivery failure.
- Mitigation: pre-flight checklist gate in deploy runbook before enabling production traffic.

- Risk: endpoint abuse after unifying form intake.
- Mitigation: enforce per-IP and per-email rate limits with Redis-backed limiter in production.

- Risk: regressions from changing submission transport.
- Mitigation: add integration tests around endpoint response semantics and field validation.

## Acceptance Criteria

- [ ] Appearance requests are delivered through Resend via server endpoint (no Formspree dependency).
- [ ] Contact form submissions are delivered through the same Resend-backed server path.
- [ ] Required env vars are documented, typed, and configured across environments.
- [ ] Structured logs exist for success, reject reasons, and send failures.
- [ ] Anti-abuse controls are active and verified.
- [ ] Automated tests cover happy path and key failure paths.
- [ ] Build and tests pass in CI and local verification.

## Rollout Plan

1. Implement endpoint and shared email utilities behind feature-flag-safe defaults.
2. Migrate appearance form first and verify delivery + logs.
3. Migrate contact form to same endpoint contract.
4. Remove legacy Formspree dependencies once both forms are validated.
5. Run post-deploy smoke tests from docs/RESEND_SETUP.md.

## Notes

- This PRD intentionally does not execute implementation.
- If docs/RESEND_SETUP.md and implementation details diverge, update docs first, then code.
