/**
 * AppearanceRequestForm — 5-step appearance request form.
 *
 * State is managed via AppearanceRequestContext (AppearanceRequestContext.tsx).
 * Each step is its own component under ./steps/.
 * Helper/utility functions live in helpers.ts.
 * Static labels/copy live in constants.ts. Types live in types.ts.
 */
import type { ComponentType } from "react";
import { useEffect } from "react";
import "./AppearanceRequestForm.css";
import { AppearanceRequestProvider, useAppearanceRequest } from "./AppearanceRequestContext";
import StepProgress from "./StepProgress";
import NavButtons from "./NavButtons";
import EventInformation from "./steps/EventInformation";
import EventNeeds from "./steps/EventNeeds";
import Location from "./steps/Location";
import Logistics from "./steps/Logistics";
import ContactAndNotes from "./steps/ContactAndNotes";

const STEP_COMPONENTS: ComponentType[] = [
  EventInformation,
  Location,
  EventNeeds,
  Logistics,
  ContactAndNotes,
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
  const {
    step,
    submitted,
    submitError,
    copy,
    isLast,
    goNext,
    goToStep,
    handleSubmit,
    skipLogistics,
    effectiveStep,
    effectiveTotalSteps,
  } = useAppearanceRequest();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  const allStepTitles: string[] = [
    copy.step0Title,
    copy.step1Title,
    copy.step2Title,
    copy.step3Title,
    copy.step4Title,
  ];
  const stepTitles = allStepTitles.filter((_, i) => {
    if (i === 3 && skipLogistics) return false;
    return true;
  });

  if (submitted) return <SuccessMessage />;

  const StepComponent = STEP_COMPONENTS[step];

  // Map effective stepper index back to real step index (accounts for skipped steps)
  const handleNodeClick = (effectiveIndex: number) => {
    const activeSteps = Array.from({ length: STEP_COMPONENTS.length }, (_, i) => i).filter(
      (i) => !(i === 3 && skipLogistics),
    );
    const realStep = activeSteps[effectiveIndex] ?? effectiveIndex;
    goToStep(realStep);
  };

  const onSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (isLast) {
      void handleSubmit();
      return;
    }
    goNext();
  };

  return (
    <div className="arf">
      <StepProgress
        step={effectiveStep}
        totalSteps={effectiveTotalSteps}
        stepTitles={stepTitles}
        onNodeClick={handleNodeClick}
      />
      <form noValidate onSubmit={onSubmit}>
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

export default function AppearanceRequestForm() {
  return (
    <AppearanceRequestProvider>
      <FormContent />
    </AppearanceRequestProvider>
  );
}
