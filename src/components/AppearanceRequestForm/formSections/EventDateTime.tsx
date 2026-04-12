import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";

/** Event start/end date and time fields. Rendered inside the parent conditional grid. */
export default function EventDateTime() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <FormLabel htmlFor="eventStartDate" required>
          {copy.eventStartDateLabel}
        </FormLabel>
        <input
          id="eventStartDate"
          type="date"
          className={["arf__input", errors.eventStartDate ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.eventStartDate}
          onChange={(e) => update("eventStartDate", e.target.value)}
          aria-required="true"
          aria-describedby={errors.eventStartDate ? "eventStartDate-error" : undefined}
        />
        <FieldError id="eventStartDate-error" message={errors.eventStartDate} />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="eventEndDate" required>
          {copy.eventEndDateLabel}
        </FormLabel>
        <input
          id="eventEndDate"
          type="date"
          className={["arf__input", errors.eventEndDate ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.eventEndDate}
          onChange={(e) => update("eventEndDate", e.target.value)}
          aria-required="true"
          aria-describedby={errors.eventEndDate ? "eventEndDate-error" : undefined}
        />
        <FieldError id="eventEndDate-error" message={errors.eventEndDate} />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="eventStartTime" required>
          {copy.eventStartTimeLabel}
        </FormLabel>
        <input
          id="eventStartTime"
          type="time"
          className={["arf__input", errors.eventStartTime ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.eventStartTime}
          onChange={(e) => update("eventStartTime", e.target.value)}
          aria-required="true"
          aria-describedby={errors.eventStartTime ? "eventStartTime-error" : undefined}
        />
        <FieldError id="eventStartTime-error" message={errors.eventStartTime} />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="eventEndTime" required>
          {copy.eventEndTimeLabel}
        </FormLabel>
        <input
          id="eventEndTime"
          type="time"
          className={["arf__input", errors.eventEndTime ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.eventEndTime}
          onChange={(e) => update("eventEndTime", e.target.value)}
          aria-required="true"
          aria-describedby={errors.eventEndTime ? "eventEndTime-error" : undefined}
        />
        <FieldError id="eventEndTime-error" message={errors.eventEndTime} />
      </div>
    </>
  );
}

