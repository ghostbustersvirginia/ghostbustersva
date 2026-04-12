import { useAppearanceRequest } from "../AppearanceRequestContext";
import { STEP_DEFINITIONS } from "../constants";

/**
 * Renders on the Event Information step.
 * One row per step 1–7; each section is a chip.
 * Required sections are locked labels; optional sections are checkbox toggles.
 * Disabling all optional sections of a step removes that step from the form.
 */
export default function StepSelector() {
  const { copy, enabledSections, toggleSection } = useAppearanceRequest();

  const stepTitleByIndex: Record<number, string> = {
    1: copy.step1Title,
    2: copy.step2Title,
    3: copy.step3Title,
    4: copy.step4Title,
    5: copy.step5Title,
    6: copy.step6Title,
    7: copy.step7Title,
  };

  return (
    <div className="arf__step-selector">
      <p className="arf__step-selector-heading">Customize your request</p>
      <div className="arf__step-selector-rows">
        {STEP_DEFINITIONS.map((def) => {
          const isSingleSection = def.sections.length === 1;
          const stepTitle = stepTitleByIndex[def.originalIndex];

          return (
            <div key={def.originalIndex} className="arf__step-selector-row">
              {/* Multi-section steps show a row label above the chips */}
              {!isSingleSection && (
                <span className="arf__step-selector-row-label">{stepTitle}</span>
              )}

              <div className="arf__chip-group">
                {def.sections.map((s) => {
                  const isEnabled =
                    s.required || enabledSections[def.originalIndex]?.[s.id] === true;

                  if (s.required) {
                    return (
                      <span key={s.id} className="arf__chip arf__chip--locked">
                        {s.label}
                      </span>
                    );
                  }

                  return (
                    <label
                      key={s.id}
                      className={`arf__chip ${isEnabled ? "arf__chip--active" : "arf__chip--inactive"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleSection(def.originalIndex, s.id)}
                      />
                      {s.label}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

