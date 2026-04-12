# AppearanceRequestForm — Agent Guide

An 8-step multi-step React form that collects event appearance requests and submits them to FormSpree. All form state is managed through a single React context; each step is an isolated functional component.

## File map

```
AppearanceRequestForm/
├── AppearanceRequestForm.tsx      Entry point. Mounts provider, renders FormContent shell.
├── AppearanceRequestContext.tsx   All useState/useEffect. Exports provider + useAppearanceRequest hook.
├── types.ts                       FormData interface — single source of truth for every field name.
├── constants.ts                   SESSION_KEY, FORMSPREE_URL, TOTAL_STEPS, EVENT_TYPES, STEP_TITLES, DEFAULT_FORM_DATA.
├── helpers.ts                     Pure functions: validateStep, buildPayload, loadFromSession, saveToSession, clearSession.
├── AppearanceRequestForm.css      All styles under the .arf__ BEM namespace.
├── FieldError.tsx                 Inline error span (role="alert").
├── FormLabel.tsx                  <label> with optional required asterisk.
├── RadioGroup.tsx                 Renders a group of radio buttons from an options array.
├── StepProgress.tsx               Step track + title header (receives step/totalSteps/stepTitles as props).
├── NavButtons.tsx                 Back / Next / Submit buttons — prop-free, reads from context.
├── steps/                         One file per wizard step — composed from formSections/.
│   ├── EventInformation.tsx
│   ├── EventSchedule.tsx
│   ├── Location.tsx
│   ├── VehiclesAndParking.tsx
│   ├── TablesAndChairs.tsx
│   ├── CharitableDonations.tsx
│   ├── ContactInformation.tsx
│   └── AdditionalInformation.tsx
└── formSections/                  Focused sub-components imported by steps/.
    ├── EventName.tsx              eventName text input
    ├── EventType.tsx              eventType radio; conditional eventTypeOther input
    ├── IsScheduled.tsx            isScheduled yes/no radio
    ├── EventDateTime.tsx          eventStartDate, eventEndDate, eventStartTime, eventEndTime
    ├── EarliestSetup.tsx          earliestSetupTime, requiredLeaveTime
    ├── PlaceSearch.tsx            Google Maps Places Autocomplete — populates address fields + placeId
    ├── EctoVehicles.tsx           requestEctoVehicle; conditional ectoVehicleParkingInfo + maxEctoVehicles
    ├── ParkingInfo.tsx            memberParkingInfo, paidParkingCovered
    ├── Tables.tsx                 tablesProvided; conditional numberOfTables
    ├── Chairs.tsx                 chairsProvided; conditional numberOfChairs
    ├── PersonContact.tsx          contactName (required), contactEmail (required + regex), contactPhone
    └── CompanyContact.tsx         companyName, companyWebsite
```


## Google Maps Places integration

`PlaceSearch.tsx` lazy-loads the Maps JS API (key: `AIzaSyDS-qaf3fImTnQBzJoIv--cgGVNB59qb3s`) once
per page and attaches a `google.maps.places.Autocomplete` widget to its search input. On place
selection it:
1. Stores the Google Place ID in `formData.placeId`.
2. Populates `addressLine1`, `city`, `state`, `zipCode` from `address_components`.
3. Pre-fills `locationDescription` with the venue name.

The address fields remain manually editable after autocomplete.

## Data flow

```
AppearanceRequestProvider (AppearanceRequestContext.tsx)
  └── FormContent (AppearanceRequestForm.tsx)
        ├── StepProgress           reads: step (via prop)
        ├── STEP_COMPONENTS[step]  reads: formData, errors, update  (via useAppearanceRequest)
        └── NavButtons             reads: isFirst, isLast, submitting, goBack, goNext (via useAppearanceRequest)
```

Step components **never receive props** — they all call `useAppearanceRequest()` directly.
Sub-components (e.g. `EventName`, `Tables`) follow the same rule.

## Key patterns

### All FormData fields are `string`
Radio values, numbers, and dates are all stored as strings. Empty string `""` means unanswered. Radio options like `"yes"/"no"` are compared as strings throughout.

### Conditional fields
Steps show extra fields based on earlier answers. The pattern used everywhere:
```tsx
{formData.requestEctoVehicle === "yes" && (
  <div className="arf__conditional">…</div>
)}
```

### Validation lives only in `helpers.ts → validateStep(step, formData)`
Step 2 (Location) has **no required fields**. Steps 0, 1, 3, 4, 5, 6 are validated. Step 7 has no validation.
`update(field, value)` in the context automatically clears the error for that field on change.

### Adding a new step
1. Add the new fields to `FormData` in `types.ts` and `DEFAULT_FORM_DATA` in `constants.ts`.
2. Create `steps/MyStep.tsx` following the existing pattern (+ sub-components as needed).
3. Add validation logic to `validateStep` in `helpers.ts` (new `if (step === N)` block).
4. Add payload mapping to `buildPayload` in `helpers.ts`.
5. Append the component to `STEP_COMPONENTS` in `AppearanceRequestForm.tsx`.
6. Increment `TOTAL_STEPS` in `constants.ts` and add the title to `STEP_TITLES`.

### Adding a field to an existing step
1. Add the field to `FormData` in `types.ts` and give it `""` in `DEFAULT_FORM_DATA`.
2. Add the JSX to the relevant step or sub-component.
3. Add validation in `helpers.ts → validateStep` if the field is required.
4. Add a payload entry in `helpers.ts → buildPayload`.

## Submission

`handleSubmit` in the context POSTs `buildPayload(formData)` as JSON to FormSpree (`FORMSPREE_URL`). FormSpree reads the `email` key as the reply-to address — this is mapped from `formData.contactEmail`. The `_subject` key sets the email subject line.

On success: `submitted = true` and sessionStorage is cleared. The form renders `<SuccessMessage />`.

## Session persistence

`loadFromSession` runs once on mount (restores a partially completed form after page refresh). `saveToSession` runs on every `formData` change. Both use `SESSION_KEY = "gbva-appearance-request"`.

## CSS

All classes use the `arf__` BEM block prefix defined in `AppearanceRequestForm.css`. Key modifier classes: `arf__input--error`, `arf__textarea--error`, `arf__step-node--active`, `arf__step-node--done`, `arf__nav--end` (right-aligns when on step 0).

## What NOT to change

- **Do not pass props to step or sub-components** — they all read from context.
- **Do not add state to step/sub-component files** — all state lives in `AppearanceRequestContext.tsx`.
- **Do not add validation inside step components** — validation belongs in `helpers.ts → validateStep`.
- **`NavButtons` is prop-free by design** — it reads from context so it never needs to be updated when steps change.
