import { useAppearanceRequest } from "../AppearanceRequestContext";
import { STEP_DEFINITIONS } from "../constants";

/**
 * Renders on the Event Information step.
 * One row per step 1–7; each section is a chip.
 * Required sections are locked labels; optional sections are checkbox toggles.
 * Steps with a gateSection show sub-section chips only when the gate is enabled.
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
      <p className="arf__step-selector-heading">Choose the Relevant Information to Provide</p>
      <div className="arf__step-selector-rows">
        {STEP_DEFINITIONS.map((def) => {
          const stepTitle = stepTitleByIndex[def.originalIndex];

          // ── Gate-section step (e.g. EventSchedule) ──────────────────────
          if (def.gateSection) {
            const gateDef = def.sections.find((s) => s.id === def.gateSection)!;
            const subSections = def.sections.filter((s) => s.id !== def.gateSection);
            const gateEnabled =
              enabledSections[def.originalIndex]?.[def.gateSection] === true;

            return (
              <div key={def.originalIndex} className="arf__step-selector-row">
                <div className="arf__chip-group">
                  <label
                    className={`arf__chip ${gateEnabled ? "arf__chip--active" : "arf__chip--inactive"}`}
                  >
                    <input
                      type="checkbox"
                      checked={gateEnabled}
                      onChange={() => toggleSection(def.originalIndex, gateDef.id)}
                    />
                    {gateDef.label}
                  </label>

                  {/* Sub-sections visible only when gate is on */}
                  {gateEnabled &&
                    subSections.map((s) => {
                      const isEnabled =
                        s.required || enabledSections[def.originalIndex]?.[s.id] === true;
                      return s.required ? (
                        <span key={s.id} className="arf__chip arf__chip--locked">
                          {s.label}
                        </span>
                      ) : (
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
          }

          // ── Single-section step ──────────────────────────────────────────
          if (def.sections.length === 1) {
            const s = def.sections[0];
            const isEnabled =
              s.required || enabledSections[def.originalIndex]?.[s.id] === true;

            return (
              <div key={def.originalIndex} className="arf__step-selector-row">
                <div className="arf__chip-group">
                  {s.required ? (
                    <span className="arf__chip arf__chip--locked">{s.label}</span>
                  ) : (
                    <label
                      className={`arf__chip ${isEnabled ? "arf__chip--active" : "arf__chip--inactive"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleSection(def.originalIndex, s.id)}
                      />
                      {s.label}
                    </label>
                  )}
                </div>
              </div>
            );
          }

          // ── Multi-section step ───────────────────────────────────────────
          return (
            <div key={def.originalIndex} className="arf__step-selector-row">
              <span className="arf__step-selector-row-label">{stepTitle}</span>
              <div className="arf__chip-group">
                {def.sections.map((s) => {
                  const isEnabled =
                    s.required || enabledSections[def.originalIndex]?.[s.id] === true;
                  return s.required ? (
                    <span key={s.id} className="arf__chip arf__chip--locked">
                      {s.label}
                    </span>
                  ) : (
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
