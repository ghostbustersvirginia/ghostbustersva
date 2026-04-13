/**
 * AppearanceRequestForm — 8-step appearance request form.
 *
 * State is managed via AppearanceRequestContext (AppearanceRequestContext.tsx).
 * Each step is its own component under ./steps/.
 * Helper/utility functions live in helpers.ts.
 * Constants and DEFAULT_COPY live in constants.ts. Types live in types.ts.
 *
 * Pass `copy` from getPageCopy("appearance-request-form") to override any text via Keystatic.
 * Omitting `copy` falls back to DEFAULT_COPY so the form works standalone.
 */
import type { ComponentType } from "react";
import "./AppearanceRequestForm.css";
import type { FormCopy } from "./types";
import { AppearanceRequestProvider, useAppearanceRequest } from "./AppearanceRequestContext";
import StepProgress from "./StepProgress";
import NavButtons from "./NavButtons";
import { DEFAULT_COPY } from "./constants";
import StepSelector from "./formSections/StepSelector";
import EventInformation from "./steps/EventInformation";
import EventSchedule from "./steps/EventSchedule";
import Location from "./steps/Location";
import VehiclesAndParking from "./steps/VehiclesAndParking";
import TablesAndChairs from "./steps/TablesAndChairs";
import CharitableDonations from "./steps/CharitableDonations";
import ContactInformation from "./steps/ContactInformation";
import AdditionalInformation from "./steps/AdditionalInformation";

const STEP_COMPONENTS: ComponentType[] = [
  EventInformation,
  EventSchedule,
  Location,
  VehiclesAndParking,
  TablesAndChairs,
  CharitableDonations, // index 5 — embedded in step 0; kept here for array alignment
  ContactInformation,
  AdditionalInformation,
];

// ------------------------------------------------------------------ //
// Success state                                                        //
// ------------------------------------------------------------------ //

function SuccessMessage() {
  const { copy } = useAppearanceRequest();
  return (
    <div className="arf__success">
      <div className="arf__success-icon" aria-hidden="true">
        {copy.successIcon}
      </div>
      <h2 className="arf__success-heading">{copy.successHeading}</h2>
      <p className="arf__success-body">{copy.successBody}</p>
    </div>
  );
}

// ------------------------------------------------------------------ //
// Inner form — reads from context                                      //
// ------------------------------------------------------------------ //

function FormContent() {
  const { step, submitted, submitError, copy, activeStepOriginalIndices } =
    useAppearanceRequest();

  const allStepTitles: string[] = [
    copy.step0Title,
    copy.step1Title,
    copy.step2Title,
    copy.step3Title,
    copy.step4Title,
    copy.step5Title,
    copy.step6Title,
    copy.step7Title,
  ];

  if (submitted) return <SuccessMessage />;

  const originalIndex = activeStepOriginalIndices[step];
  const StepComponent = STEP_COMPONENTS[originalIndex];
  const activeStepTitles = activeStepOriginalIndices.map((i) => allStepTitles[i]);

  return (
    <div className="arf">
      <StepProgress
        step={step}
        totalSteps={activeStepOriginalIndices.length}
        stepTitles={activeStepTitles}
      />
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <StepComponent />
        {submitError && (
          <div className="arf__submit-error" role="alert">
            {submitError}
          </div>
        )}
        <NavButtons />
        {step === 0 && <StepSelector />}
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ //
// Public export — wraps in provider                                    //
// ------------------------------------------------------------------ //

interface AppearanceRequestFormProps {
  /** CMS copy from getPageCopy("appearance-request-form"). Merged over DEFAULT_COPY. */
  copy?: Partial<FormCopy>;
}

export default function AppearanceRequestForm({ copy = {} }: AppearanceRequestFormProps) {
  const resolvedCopy: FormCopy = { ...DEFAULT_COPY, ...copy };
  return (
    <AppearanceRequestProvider copy={resolvedCopy}>
      <FormContent />
    </AppearanceRequestProvider>
  );
}
