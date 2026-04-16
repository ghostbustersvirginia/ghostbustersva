import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";
import EventDateTime from "./EventDateTime";
import EarliestSetup from "./EarliestSetup";

export default function IsScheduled() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            {copy.isScheduledLegend}
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="isScheduled"
              options={[
                { value: "yes", label: copy.optionYes },
                { value: "no", label: copy.optionNo },
              ]}
              value={formData.isScheduled}
              onChange={(v) => update("isScheduled", v)}
              errorId={errors.isScheduled ? "isScheduled-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="isScheduled-error" message={errors.isScheduled} />
      </div>

      {formData.isScheduled === "yes" && (
        <div className="arf__conditional">
          <div className="arf__grid-2">
            <EventDateTime />
          </div>
          <hr className="arf__section-divider" />
          <p className="arf__section-label">Optional (but helpful) timing details</p>
          <div className="arf__grid-2">
            <EarliestSetup />
          </div>
        </div>
      )}

      {formData.isScheduled === "no" && (
        <div className="arf__conditional">
          <div className="arf__group">
            <FormLabel htmlFor="unscheduledNote">{copy.unscheduledNoteLabel}</FormLabel>
            <textarea
              id="unscheduledNote"
              className="arf__textarea"
              value={formData.unscheduledNote}
              onChange={(e) => update("unscheduledNote", e.target.value)}
              placeholder={copy.unscheduledNotePlaceholder}
            />
          </div>
        </div>
      )}
    </>
  );
}
