# PRD 014: CMS Handoff Simplification and Documentation Reduction

**Status:** in-progress
**Author:** GitHub Copilot
**Date:** 2026-03-04

## Goal

Reduce operational complexity so Ghostbusters team members can confidently manage routine content (text, URLs, images, new entries) without touching code, while developers retain ownership of layout/design/engineering.

## Scope

### Included

- Define strict boundary of CMS-editable content vs code-owned concerns.
- Expand CMS schemas only where needed for common day-to-day edits.
- Standardize content entry patterns for events, media, and site-wide text/links.
- Replace multiple overlapping editing docs with one short editor guide + one technical runbook.
- Remove or rewrite docs that imply local dev is required for editors.

### Excluded

- Visual redesign or layout/component refactors.
- New pages/features not already present in site map.
- Advanced editorial workflow tooling (approval queues, granular custom roles).

## Requirements

1. Define and document “CMS editable” fields for each major area:
   - Events
   - Gallery
   - Global settings
   - Static page copy where frequent updates are expected
2. Define and document “developer-only” areas:
   - Layout and component structure
   - Styling/theme tokens
   - Motion/interactive behavior
   - Build/deploy configuration
3. Ensure common WordPress-like content tasks are supported in CMS forms:
   - Edit text
   - Edit links/URLs
   - Upload and swap images
   - Add and remove entries
4. Consolidate editor instructions into one concise document (target: one page).
5. Keep technical operational docs concise and owner-focused, avoiding duplicate instructions.

## Design Notes

- Simplicity comes from opinionated guardrails, not unlimited flexibility.
- The CMS should expose only high-confidence fields that non-technical editors routinely change.
- Avoid schema overgrowth; if a field is changed rarely and can break design consistency, keep it developer-only.

## Acceptance Criteria

- [ ] A single editor-facing guide exists and is sufficient for routine updates.
- [ ] Existing docs are trimmed to remove duplicated CMS instructions.
- [ ] Team can complete these tasks without code edits: add event, edit event text/link/image, add gallery image, update global links.
- [ ] Boundaries are explicit: editors know what they can change; developers know what remains code-owned.
- [ ] Project lead confirms handoff is understandable for non-technical admins.

## Documentation Deliverables

- One editor quickstart doc (non-technical, minimal steps).
- One technical runbook section for maintainers (auth setup, deploy behavior, troubleshooting).
- README updated to point to the two canonical docs only.

## Risks and Mitigations

- Risk: Overexposing fields leads to inconsistent site presentation.
  - Mitigation: Keep schema minimal and purpose-driven.
- Risk: Editors still perceive process as “developer-only.”
  - Mitigation: `/admin` login flow + short task-based guide.
- Risk: Duplicate docs drift over time.
  - Mitigation: Declare canonical docs and archive redundant guidance.

## Implementation Notes

- Completed: editor quickstart reduced to one guide and maintainer auth setup moved to a dedicated technical runbook.
- Completed: README now points to the canonical CMS docs and `/admin` flow.
- Remaining: finalize any additional CMS schema expansion for static page copy if needed.
