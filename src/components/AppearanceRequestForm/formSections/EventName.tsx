import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";

export default function EventName() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
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
  );
}

