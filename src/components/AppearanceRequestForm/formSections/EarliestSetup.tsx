import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";

/** Earliest setup arrival and required leave time fields. Rendered inside the parent conditional grid. */
export default function EarliestSetup() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <FormLabel htmlFor="earliestSetupTime" required>
          {copy.earliestSetupTimeLabel}
        </FormLabel>
        <input
          id="earliestSetupTime"
          type="time"
          className={["arf__input", errors.earliestSetupTime ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.earliestSetupTime}
          onChange={(e) => update("earliestSetupTime", e.target.value)}
          aria-required="true"
          aria-describedby={errors.earliestSetupTime ? "earliestSetupTime-error" : undefined}
        />
        <FieldError id="earliestSetupTime-error" message={errors.earliestSetupTime} />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="requiredLeaveTime" required>
          {copy.requiredLeaveTimeLabel}
        </FormLabel>
        <input
          id="requiredLeaveTime"
          type="time"
          className={["arf__input", errors.requiredLeaveTime ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.requiredLeaveTime}
          onChange={(e) => update("requiredLeaveTime", e.target.value)}
          aria-required="true"
          aria-describedby={errors.requiredLeaveTime ? "requiredLeaveTime-error" : undefined}
        />
        <FieldError id="requiredLeaveTime-error" message={errors.requiredLeaveTime} />
      </div>
    </>
  );
}

