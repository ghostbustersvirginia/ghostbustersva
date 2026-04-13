import { useAppearanceRequest } from "../AppearanceRequestContext";
import FormLabel from "../FormLabel";

/** Company / organization name and website fields. */
export default function CompanyContact() {
  const { formData, update, copy } = useAppearanceRequest();

  return (
    <>
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
    </>
  );
}

