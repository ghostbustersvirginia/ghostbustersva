import { useAppearanceRequest } from "../AppearanceRequestContext";
import FormSelect from "../FormSelect";

export default function EventType() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <FormSelect
      id="eventType"
      label={copy.eventTypeLegend}
      options={copy.eventTypeOptions.map((label) => ({ value: label, label }))}
      value={formData.eventType}
      onChange={(v) => update("eventType", v)}
      required
      errorId="eventType-error"
      errorMessage={errors.eventType}
    />
  );
}
