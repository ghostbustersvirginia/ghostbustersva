import { useAppearanceRequest } from "../AppearanceRequestContext";
import FormLabel from "../FormLabel";

/** Earliest setup arrival and required leave time fields. Rendered inside the parent conditional grid. */
export default function EarliestSetup() {
  const { formData, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <FormLabel htmlFor="earliestSetupTime">
          {copy.earliestSetupTimeLabel}
        </FormLabel>
        <input
          id="earliestSetupTime"
          type="time"
          className="arf__input"
          value={formData.earliestSetupTime}
          onChange={(e) => update("earliestSetupTime", e.target.value)}
        />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="requiredLeaveTime">
          {copy.requiredLeaveTimeLabel}
        </FormLabel>
        <input
          id="requiredLeaveTime"
          type="time"
          className="arf__input"
          value={formData.requiredLeaveTime}
          onChange={(e) => update("requiredLeaveTime", e.target.value)}
        />
      </div>
    </>
  );
}
