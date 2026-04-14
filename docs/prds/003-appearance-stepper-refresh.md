# PRD 003: Appearance Stepper Refresh

**Status:** complete
**Author:** afton
**Date:** 2026-04-13

## Goal

Modernize the appearance request stepper so it matches the site design language, improves accessibility and keyboard usability, and integrates cleanly from the contact page.

## Scope

- Update contact inquiry options to remove generic event scheduling from the contact dropdown.
- Add a contact-page callout that routes users to the dedicated appearance stepper.
- Standardize the appearance route page structure with the same layout/header treatment as other pages.
- Improve stepper keyboard/focus accessibility across all interactive controls.
- Refresh stepper control styling (buttons, radios, stepper UI) to align with current theme tokens.
- Remove form-specific CMS/Keystatic copy dependencies for the appearance stepper.

## Requirements

1. The contact inquiry dropdown must no longer include "Schedule Event".
2. Contact page must include a "Request an Appearance" section below the contact form with descriptive copy and a button to the appearance page.
3. Appearance page must use standard page layout/header patterns and correct landmark labeling.
4. Appearance page canonical URL must match the actual route.
5. Stepper flow must avoid hidden-active-step mismatches and keep progress indicators in sync.
6. Stepper controls must show clear keyboard-visible focus indicators.
7. Stepper controls must use modern themed styling and maintain WCAG-compatible focus and contrast behavior.
8. Appearance stepper must no longer depend on page-copy CMS fields/files.

## Design Notes

- Reuse existing theme tokens from src/styles/theme.css.
- Preserve current multi-step structure and FormSpree submission behavior.
- Keep interaction changes minimal-risk: no schema-level payload changes.

## Acceptance Criteria

- [x] Contact dropdown option list excludes "Schedule Event".
- [x] Contact page includes a new "Request an Appearance" CTA section with a route button.
- [x] Appearance page uses standard header layout and fixed aria-labelledby linkage.
- [x] Appearance page canonical is set to /appearance.
- [x] Stepper flow remains synchronized with visible/active steps and avoids hidden-step mismatches.
- [x] Keyboard-visible focus styles are present for stepper controls.
- [x] Stepper button/radio/stepper styling aligns with theme tokens and improves usability.
- [x] Appearance-specific page-copy schema/file references are removed.

## Notes

- Follow-up design iteration can add richer component-level visual polish and optional custom date picker behavior for appearance step date fields if needed.
- Completed as part of the stepper refresh and redesign workstream finalized on 2026-04-14.
- Final flow details are defined in [docs/prds/004-stepper-flow-redesign.md](docs/prds/004-stepper-flow-redesign.md), which supersedes early gate/chip concepts.
