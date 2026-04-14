import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";

export default function ContactAndNotes() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      {/* Row 1: Name | Company Name */}
      <div className="arf__grid-2">
        <div className="arf__group">
          <FormLabel htmlFor="contactName" required>
            {copy.contactNameLabel}
          </FormLabel>
          <input
            id="contactName"
            type="text"
            className={["arf__input", errors.contactName ? "arf__input--error" : ""]
              .filter(Boolean)
              .join(" ")}
            value={formData.contactName}
            onChange={(e) => update("contactName", e.target.value)}
            aria-required="true"
            aria-describedby={errors.contactName ? "contactName-error" : undefined}
            autoComplete="name"
          />
          <FieldError id="contactName-error" message={errors.contactName} />
        </div>

        <div className="arf__group">
          <FormLabel htmlFor="companyName">{copy.companyNameLabel}</FormLabel>
          <input
            id="companyName"
            type="text"
            className="arf__input"
            value={formData.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            autoComplete="organization"
          />
        </div>
      </div>

      {/* Row 2: Email | Phone */}
      <div className="arf__grid-2">
        <div className="arf__group">
          <FormLabel htmlFor="contactEmail" required>
            {copy.contactEmailLabel}
          </FormLabel>
          <input
            id="contactEmail"
            type="email"
            className={["arf__input", errors.contactEmail ? "arf__input--error" : ""]
              .filter(Boolean)
              .join(" ")}
            value={formData.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            aria-required="true"
            aria-describedby={errors.contactEmail ? "contactEmail-error" : undefined}
            autoComplete="email"
          />
          <FieldError id="contactEmail-error" message={errors.contactEmail} />
        </div>

        <div className="arf__group">
          <FormLabel htmlFor="contactPhone">{copy.contactPhoneLabel}</FormLabel>
          <input
            id="contactPhone"
            type="tel"
            className="arf__input"
            value={formData.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="companyWebsite">{copy.companyWebsiteLabel}</FormLabel>
        <input
          id="companyWebsite"
          type="url"
          className="arf__input"
          value={formData.companyWebsite}
          onChange={(e) => update("companyWebsite", e.target.value)}
          placeholder={copy.companyWebsitePlaceholder}
          autoComplete="url"
        />
      </div>

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
    </>
  );
}
