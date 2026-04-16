import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import RadioGroup from "../RadioGroup";

export default function NeedsLogistics() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <div className="arf__group">
      <fieldset>
        <legend className="arf__label">
          {copy.needsLogisticsLegend}
          <span className="arf__required" aria-label="required">
            {" "}
            *
          </span>
        </legend>
        <RadioGroup
          name="needsLogistics"
          options={[
            { value: "yes", label: copy.optionYes },
            { value: "no", label: copy.optionNo },
          ]}
          value={formData.needsLogistics}
          onChange={(v) => update("needsLogistics", v)}
          errorId={errors.needsLogistics ? "needsLogistics-error" : undefined}
        />
      </fieldset>
      <FieldError id="needsLogistics-error" message={errors.needsLogistics} />
      {formData.needsLogistics === "yes" && (
        <p className="arf__hint" style={{ textAlign: "right" }}>
          {copy.needsLogisticsHint}
        </p>
      )}
    </div>
  );
}
