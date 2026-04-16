# PRD 004: Stepper Flow Redesign

**Status:** complete
**Author:** afton
**Date:** 2026-04-13

## Goal

Collapse the 8-step appearance request form into a cleaner 5-step flow, remove the confusing
StepSelector chip panel, move all step gating logic inline within steps, and replace native date
inputs with the themed flatpickr calendar already used on the contact page.

## Problem Statement

The current stepper has three compounding UX failures:

1. **The StepSelector chip panel is hidden below the Next button.** Most users never see it,
   so they advance through the form with steps silently missing or incorrectly scoped.
2. **Chips are the wrong pattern for step gating.** Chips communicate filtering/tagging — not
   "does this future wizard step exist." The genre mismatch makes the intent opaque.
3. **Too many steps for the data collected.** 7 visible steps (after chips are factored in)
   causes form fatigue. Modern best practice targets 4–5 steps for this payload size.
4. **Native `<input type="date">` and `<input type="time">`** render inconsistently across
   browsers and look nothing like the rest of the form.

## Scope

- Collapse the 8-step STEP_COMPONENTS array into 5 logical steps.
- Remove the StepSelector chip panel from the rendered form entirely.
- Remove the `enabledSections` / `toggleSection` chip-gating system from context and constants.
- Replace date/time native inputs with a flatpickr-based `DatePickerInput` component.
- Keep gating inline (e.g. scheduled-event questions and logistics requirements) instead of global chip toggles.
- Preserve Formspree compatibility while allowing payload/schema evolution needed by the new flow.
- Reuse existing form sections where practical and add new focused sections where needed.

## New 5-Step Structure

| #   | Title           | Content                                                                                                                                                  |
| --- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Event Details   | Event name + type, optional "Other" type text, and scheduled-event gating. If scheduled: date/time + optional setup timing. If unscheduled: timing note. |
| 1   | Location        | Venue search (Google Places) and required address fields (street, city, state) plus optional details.                                                    |
| 2   | Event Needs     | Charitable donation preferences and required "needs logistics" gate question.                                                                            |
| 3   | Logistics       | Ecto, tables, and chairs details. This step is skipped when `needsLogistics === "no"`.                                                                   |
| 4   | Contact & Notes | Contact name/email required; phone/company/website and additional notes optional.                                                                        |

## Architecture Changes

### Removed

- `formSections/StepSelector.tsx` — removed from render path and deleted.
- `enabledSections` state + `toggleSection` from `AppearanceRequestContext`
- `STEP_DEFINITIONS`, `SectionDef`, `StepDef`, `buildDefaultEnabledSections` from `constants.ts`
- `enabledSections` parameter from `helpers.ts → validateStep`
- `step5Title` through `step7Title` from `FormCopy` in `types.ts`
- Legacy step files: `steps/EventSchedule.tsx`, `steps/VehiclesAndParking.tsx`, `steps/TablesAndChairs.tsx`, `steps/ContactInformation.tsx`

### Added

- `formSections/DatePickerInput.tsx` — uncontrolled React input that lazy-loads flatpickr from
  CDN on mount (same `loadFlatpickr` pattern as `contact-form-client.js`). Uses `useRef` for
  the flatpickr instance; syncs external value updates via `useEffect`.
- `FormSelect.tsx` — accessible custom select used for event type selection.
- `steps/EventNeeds.tsx` and `steps/NeedsLogistics.tsx` — introduces explicit logistics gating.
- `steps/Logistics.tsx` — renders `EctoVehicles`, `Tables`, and `Chairs` in sequence.
- `steps/ContactAndNotes.tsx` — consolidated contact fields + additional information in one step.

### Modified

- `constants.ts` and `types.ts` — 5-step titles, new copy keys, and updated default form data.
- `helpers.ts` — step-based validation and completion logic updated for new step order and conditional requirements.
- `AppearanceRequestContext.tsx` — simplified state model; added `skipLogistics`, effective step counting, step-node back navigation, and reset support.
- `AppearanceRequestForm.tsx` — 5-step component array, dynamic titles when logistics is skipped, and clickable completed step nodes.
- `steps/EventInformation.tsx` + `formSections/IsScheduled.tsx` — schedule logic moved inline into Step 0.
- `formSections/EventDateTime.tsx` and `formSections/EarliestSetup.tsx` — date/time inputs migrated to `DatePickerInput`.
- `steps/Location.tsx` — required address fields and improved field grouping.
- `steps/CharitableDonations.tsx` — clarified donation destination options and conditional charity details.
- `src/pages/appearance.astro` — flatpickr CDN CSS `<link>` added.
- `AppearanceRequestForm.css` — themed `.flatpickr-*` overrides added (matches contact page).

## Acceptance Criteria

- [x] StepSelector chip panel no longer renders anywhere in the form.
- [x] Progress track correctly represents flow and dynamically shows 4 or 5 effective steps based on logistics gating.
- [x] Event Details step includes inline schedule gating and conditional schedule fields.
- [x] Date/time interactions are provided through flatpickr-based inputs.
- [x] Flatpickr calendar styling matches the contact page theme tokens.
- [x] Event Needs step captures donation and logistics gating before logistics details.
- [x] Logistics step renders Ecto vehicles, tables, and chairs inline, and is skipped when not needed.
- [x] Contact & Notes step renders contact fields and additional notes on the same step.
- [x] Existing required-field validation passes for the new step order.
- [x] Form submission payload remains compatible with FormSpree delivery.
- [x] Session persistence (sessionStorage) works across page reloads.
- [x] `enabledSections`, `toggleSection`, and `STEP_DEFINITIONS` are removed from active code.

## Notes

- Time fields also use `DatePickerInput` in flatpickr time mode.
- `StepSelector.tsx` was removed as dead code once the redesign shipped.
- Completed on 2026-04-14.
