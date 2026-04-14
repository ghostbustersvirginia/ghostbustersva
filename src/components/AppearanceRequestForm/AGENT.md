# AppearanceRequestForm - Agent Guide

A 5-step React form that collects appearance requests and submits to FormSpree.
All form state is centralized in `AppearanceRequestContext.tsx`.

## File map

```
AppearanceRequestForm/
|- AppearanceRequestForm.tsx
|- AppearanceRequestContext.tsx
|- constants.ts
|- types.ts
|- helpers.ts
|- AppearanceRequestForm.css
|- StepProgress.tsx
|- NavButtons.tsx
|- FormSelect.tsx
|- steps/
|  |- EventInformation.tsx
|  |- Location.tsx
|  |- EventNeeds.tsx
|  |- Logistics.tsx
|  |- ContactAndNotes.tsx
|  |- NeedsLogistics.tsx
|  |- CharitableDonations.tsx
|- formSections/
|  |- DatePickerInput.tsx
|  |- EventDateTime.tsx
|  |- IsScheduled.tsx
|  |- EctoVehicles.tsx
|  |- Tables.tsx
|  |- Chairs.tsx
|  |- PlaceSearch.tsx
|  |- EventName.tsx
|  |- EventType.tsx
|  |- EarliestSetup.tsx
```

## Current flow

1. Event Details
2. Location
3. Event Needs
4. Logistics (conditionally skipped when `needsLogistics === "no"`)
5. Contact and Notes

`TOTAL_STEPS` in `constants.ts` matches the physical step component count.
The visible stepper count may be lower when the logistics step is skipped.

## Data flow

`AppearanceRequestProvider` owns:

- `formData`
- `errors`
- `step`
- submission state

Step components and form sections read/write through `useAppearanceRequest()`.

## Validation and submission

- Step validation is in `helpers.ts` (`validateStep` and `isStepComplete`).
- Payload mapping is in `helpers.ts` (`buildPayload`).
- Submission is a POST to `FORMSPREE_URL`.

## Session persistence

- `loadFromSession` restores partial progress on mount.
- `saveToSession` persists on `formData` changes.
- `resetForm` clears session data and returns to step 0.

## Google Maps Places

`PlaceSearch.tsx` lazily loads Maps Places only if `GOOGLE_MAPS_API_KEY` is present.
If key is absent, manual address entry remains fully supported.

## Safe extension checklist

1. Add fields in `types.ts` and `DEFAULT_FORM_DATA`.
2. Add UI in the relevant step/form section.
3. Add validation in `helpers.ts`.
4. Add payload mapping in `helpers.ts`.
5. If adding/removing a real step component, update `STEP_COMPONENTS`, `TOTAL_STEPS`, and copy titles.
