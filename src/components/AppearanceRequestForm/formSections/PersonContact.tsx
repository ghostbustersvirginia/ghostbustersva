import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";

/** Contact person fields: name, email, phone. */
export default function PersonContact() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
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
    </>
  );
}

