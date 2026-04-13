import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

export default function EventType() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            {copy.eventTypeLegend}
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="eventType"
              options={copy.eventTypeOptions.map((label) => ({ value: label, label }))}
              value={formData.eventType}
              onChange={(v) => update("eventType", v)}
              errorId={errors.eventType ? "eventType-error" : undefined}
              className="arf__radio-group--cols-2"
            />
          </div>
        </fieldset>
        <FieldError id="eventType-error" message={errors.eventType} />
      </div>

      {formData.eventType === "Other" && (
        <div className="arf__group">
          <FormLabel htmlFor="eventTypeOther" required>
            {copy.eventTypeOtherLabel}
          </FormLabel>
          <input
            id="eventTypeOther"
            type="text"
            className={["arf__input", errors.eventTypeOther ? "arf__input--error" : ""]
              .filter(Boolean)
              .join(" ")}
            value={formData.eventTypeOther}
            onChange={(e) => update("eventTypeOther", e.target.value)}
            aria-required="true"
            aria-describedby={errors.eventTypeOther ? "eventTypeOther-error" : undefined}
            autoComplete="off"
          />
          <FieldError id="eventTypeOther-error" message={errors.eventTypeOther} />
        </div>
      )}
    </>
  );
}

