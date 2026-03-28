import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

export default function Step1EventSchedule() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
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

      {formData.isScheduled === "yes" && (
        <div className="arf__conditional">
          <div className="arf__grid-2">
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
                aria-describedby={
                  errors.earliestSetupTime ? "earliestSetupTime-error" : undefined
                }
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
          </div>
        </div>
      )}
    </>
  );
}
