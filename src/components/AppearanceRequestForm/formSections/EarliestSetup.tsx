import { useAppearanceRequest } from "../AppearanceRequestContext";
import FormLabel from "../FormLabel";
import DatePickerInput from "./DatePickerInput";

/** Earliest setup arrival and required leave time fields. Rendered inside the parent conditional grid. */
export default function EarliestSetup() {
  const { formData, update, copy } = useAppearanceRequest();

  const clockIcon = (
    <svg
      className="arf__input-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );

  return (
    <>
      <div className="arf__group">
        <FormLabel htmlFor="earliestSetupTime">{copy.earliestSetupTimeLabel}</FormLabel>
        <div className="arf__input-icon-wrap">
          {clockIcon}
          <DatePickerInput
            id="earliestSetupTime"
            mode="time"
            value={formData.earliestSetupTime}
            onChange={(v) => update("earliestSetupTime", v)}
            className="arf__input"
          />
        </div>
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="requiredLeaveTime">{copy.requiredLeaveTimeLabel}</FormLabel>
        <div className="arf__input-icon-wrap">
          {clockIcon}
          <DatePickerInput
            id="requiredLeaveTime"
            mode="time"
            value={formData.requiredLeaveTime}
            onChange={(v) => update("requiredLeaveTime", v)}
            className="arf__input"
          />
        </div>
      </div>
    </>
  );
}
