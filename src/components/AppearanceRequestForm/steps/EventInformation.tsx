import { useAppearanceRequest } from "../AppearanceRequestContext";
import EventName from "../formSections/EventName";
import EventType from "../formSections/EventType";
import IsScheduled from "../formSections/IsScheduled";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";

export default function EventInformation() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__grid-2 arf__grid-2--align-start">
        <EventName />
        <EventType />
      </div>
      {formData.eventType === "Other" && (
        <div className="arf__group" style={{ marginBlockStart: "var(--space-xl)" }}>
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
      <hr className="arf__section-divider" />
      <IsScheduled />
    </>
  );
}
