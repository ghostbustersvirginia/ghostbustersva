import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

export default function Step0EventInformation() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <FormLabel htmlFor="eventName" required>
          {copy.eventNameLabel}
        </FormLabel>
        <input
          id="eventName"
          type="text"
          className={["arf__input", errors.eventName ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.eventName}
          onChange={(e) => update("eventName", e.target.value)}
          aria-required="true"
          aria-describedby={errors.eventName ? "eventName-error" : undefined}
          autoComplete="off"
        />
        <FieldError id="eventName-error" message={errors.eventName} />
      </div>

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
            />
          </div>
        </fieldset>
        <FieldError id="eventType-error" message={errors.eventType} />
      </div>
    </>
  );
}



