import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import DatePickerInput from "./DatePickerInput";

/** Returns true if the time string ("h:i K" format) is between 12 AM and 4:59 AM. */
function isLateNight(timeStr: string): boolean {
  if (!timeStr) return false;
  const match = timeStr.match(/^(\d+):\d+\s+AM$/i);
  if (!match) return false;
  const hour = parseInt(match[1], 10);
  return hour === 12 || (hour >= 1 && hour <= 4);
}

/** Event start/end date and time fields. Rendered inside the parent conditional grid. */
export default function EventDateTime() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  const isSameDay =
    !!formData.eventStartDate &&
    !!formData.eventEndDate &&
    formData.eventStartDate === formData.eventEndDate;

  const endTimeMinTime = isSameDay ? formData.eventStartTime || undefined : undefined;

  const calendarIcon = (
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

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
        <FormLabel htmlFor="eventStartDate" required>
          {copy.eventStartDateLabel}
        </FormLabel>
        <div className="arf__input-icon-wrap">
          {calendarIcon}
          <DatePickerInput
            id="eventStartDate"
            value={formData.eventStartDate}
            onChange={(v) => update("eventStartDate", v)}
            className={["arf__input", errors.eventStartDate ? "arf__input--error" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-required="true"
            aria-describedby={errors.eventStartDate ? "eventStartDate-error" : undefined}
          />
        </div>
        <FieldError id="eventStartDate-error" message={errors.eventStartDate} />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="eventEndDate" required>
          {copy.eventEndDateLabel}
        </FormLabel>
        <div className="arf__input-icon-wrap">
          {calendarIcon}
          <DatePickerInput
            id="eventEndDate"
            value={formData.eventEndDate}
            onChange={(v) => update("eventEndDate", v)}
            minDate={formData.eventStartDate || "today"}
            className={["arf__input", errors.eventEndDate ? "arf__input--error" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-required="true"
            aria-describedby={errors.eventEndDate ? "eventEndDate-error" : undefined}
          />
        </div>
        <FieldError id="eventEndDate-error" message={errors.eventEndDate} />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="eventStartTime" required>
          {copy.eventStartTimeLabel}
        </FormLabel>
        <div className="arf__input-icon-wrap">
          {clockIcon}
          <DatePickerInput
            id="eventStartTime"
            mode="time"
            value={formData.eventStartTime}
            onChange={(v) => update("eventStartTime", v)}
            className={["arf__input", errors.eventStartTime ? "arf__input--error" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-required="true"
            aria-describedby={errors.eventStartTime ? "eventStartTime-error" : undefined}
          />
        </div>
        <FieldError id="eventStartTime-error" message={errors.eventStartTime} />
        {isLateNight(formData.eventStartTime) && (
          <p className="arf__hint">
            Just double-checking — this is before 5 AM. We&rsquo;re happy to do late-night events,
            just make sure you meant AM and not PM!
          </p>
        )}
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="eventEndTime" required>
          {copy.eventEndTimeLabel}
        </FormLabel>
        <div className="arf__input-icon-wrap">
          {clockIcon}
          <DatePickerInput
            id="eventEndTime"
            mode="time"
            value={formData.eventEndTime}
            onChange={(v) => update("eventEndTime", v)}
            minTime={endTimeMinTime}
            className={["arf__input", errors.eventEndTime ? "arf__input--error" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-required="true"
            aria-describedby={errors.eventEndTime ? "eventEndTime-error" : undefined}
          />
        </div>
        <FieldError id="eventEndTime-error" message={errors.eventEndTime} />
        {isLateNight(formData.eventEndTime) && (
          <p className="arf__hint">
            Just double-checking — this is before 5 AM. We&rsquo;re happy to do late-night events,
            just make sure you meant AM and not PM!
          </p>
        )}
      </div>
    </>
  );
}
