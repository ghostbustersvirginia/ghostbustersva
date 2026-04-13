import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import RadioGroup from "../RadioGroup";

export default function IsScheduled() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
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
  );
}

