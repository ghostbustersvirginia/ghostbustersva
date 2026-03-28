import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import RadioGroup from "../RadioGroup";

export default function Step5CharitableDonations() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <div className="arf__group">
      <fieldset>
        <legend className="arf__label">
          {copy.charitableDonationsLegend}
          <span className="arf__required" aria-label="required">
            {" "}
            *
          </span>
        </legend>
        <div>
          <RadioGroup
            name="charitableDonationsAllowed"
            options={[
              { value: "yes", label: copy.optionYes },
              { value: "no", label: copy.optionNo },
              { value: "unsure", label: copy.optionUnsure },
            ]}
            value={formData.charitableDonationsAllowed}
            onChange={(v) => update("charitableDonationsAllowed", v)}
            errorId={
              errors.charitableDonationsAllowed
                ? "charitableDonationsAllowed-error"
                : undefined
            }
          />
        </div>
      </fieldset>
      <FieldError
        id="charitableDonationsAllowed-error"
        message={errors.charitableDonationsAllowed}
      />
    </div>
  );
}
