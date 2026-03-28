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
import { TOTAL_STEPS, DEFAULT_COPY } from "./constants";
import Step0EventInformation from "./steps/Step0EventInformation";
import Step1EventSchedule from "./steps/Step1EventSchedule";
import Step2Location from "./steps/Step2Location";
import Step3VehiclesAndParking from "./steps/Step3VehiclesAndParking";
import Step4TablesAndChairs from "./steps/Step4TablesAndChairs";
import Step5CharitableDonations from "./steps/Step5CharitableDonations";
import Step6ContactInformation from "./steps/Step6ContactInformation";
import Step7AdditionalInformation from "./steps/Step7AdditionalInformation";

const STEP_COMPONENTS: ComponentType[] = [
  Step0EventInformation,
  Step1EventSchedule,
  Step2Location,
  Step3VehiclesAndParking,
  Step4TablesAndChairs,
  Step5CharitableDonations,
  Step6ContactInformation,
  Step7AdditionalInformation,
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
  const { step, submitted, submitError, copy } = useAppearanceRequest();

  const stepTitles: string[] = [
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

  const StepComponent = STEP_COMPONENTS[step];

  return (
    <div className="arf">
      <StepProgress step={step} totalSteps={TOTAL_STEPS} stepTitles={stepTitles} />
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <StepComponent />
        {submitError && (
          <div className="arf__submit-error" role="alert">
            {submitError}
          </div>
        )}
        <NavButtons />
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

