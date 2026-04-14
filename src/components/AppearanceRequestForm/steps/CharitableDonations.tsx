import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

export default function CharitableDonations() {
  const { formData, errors, update, copy } = useAppearanceRequest();
  const showForWhom = formData.charitableDonationsAllowed === "yes";

  return (
    <div className="arf__donations-split">
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            {copy.charitableDonationsLegend}
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="charitableDonationsAllowed"
              options={[
                { value: "yes", label: copy.optionYes },
                { value: "no", label: copy.optionNo },
                { value: "unsure", label: copy.optionUnsure },
              ]}
              value={formData.charitableDonationsAllowed}
              onChange={(v) => {
                update("charitableDonationsAllowed", v);
                if (v === "yes" && !formData.collectDonationsForHost) {
                  update("collectDonationsForHost", "GBVA choice");
                }
              }}
              errorId={
                errors.charitableDonationsAllowed ? "charitableDonationsAllowed-error" : undefined
              }
            />
          </div>
        </fieldset>
        <FieldError
          id="charitableDonationsAllowed-error"
          message={errors.charitableDonationsAllowed}
        />
      </div>

      {showForWhom && (
        <div className="arf__group">
          <fieldset>
            <legend className="arf__label">{copy.collectDonationsForHostLegend}</legend>
            <div>
              <RadioGroup
                name="collectDonationsForHost"
                options={[
                  { value: "GBVA choice", label: copy.optionYourChoice },
                  { value: "host choice", label: copy.optionOurChoice },
                ]}
                value={formData.collectDonationsForHost}
                onChange={(v) => update("collectDonationsForHost", v)}
              />
            </div>
          </fieldset>

          {formData.collectDonationsForHost === "host choice" && (
            <div className="arf__group" style={{ marginBlockStart: "var(--space-md)" }}>
              <FormLabel htmlFor="charityInfo">{copy.charityInfoLabel}</FormLabel>
              <input
                id="charityInfo"
                type="text"
                className="arf__input"
                value={formData.charityInfo}
                onChange={(e) => update("charityInfo", e.target.value)}
                placeholder={copy.charityInfoPlaceholder}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
