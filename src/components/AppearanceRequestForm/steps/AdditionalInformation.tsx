import { useAppearanceRequest } from "../AppearanceRequestContext";
import FormLabel from "../FormLabel";

export default function AdditionalInformation() {
  const { formData, update, copy } = useAppearanceRequest();

  return (
    <div className="arf__group">
      <FormLabel htmlFor="additionalInfo">{copy.additionalInfoLabel}</FormLabel>
      <textarea
        id="additionalInfo"
        className="arf__textarea"
        value={formData.additionalInfo}
        onChange={(e) => update("additionalInfo", e.target.value)}
        placeholder={copy.additionalInfoPlaceholder}
        style={{ minHeight: "10rem" }}
      />
    </div>
  );
}

