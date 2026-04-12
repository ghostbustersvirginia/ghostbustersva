import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

/** Member parking location and paid-parking coverage fields. */
export default function ParkingInfo() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <FormLabel htmlFor="memberParkingInfo" required>
          {copy.memberParkingInfoLabel}
        </FormLabel>
        <textarea
          id="memberParkingInfo"
          className={["arf__textarea", errors.memberParkingInfo ? "arf__textarea--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.memberParkingInfo}
          onChange={(e) => update("memberParkingInfo", e.target.value)}
          aria-required="true"
          aria-describedby={errors.memberParkingInfo ? "memberParkingInfo-error" : undefined}
          placeholder={copy.memberParkingInfoPlaceholder}
        />
        <FieldError id="memberParkingInfo-error" message={errors.memberParkingInfo} />
      </div>

      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            {copy.paidParkingCoveredLegend}
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="paidParkingCovered"
              options={[
                { value: "yes", label: copy.optionYes },
                { value: "no", label: copy.optionNo },
                { value: "n/a", label: copy.optionNA },
              ]}
              value={formData.paidParkingCovered}
              onChange={(v) => update("paidParkingCovered", v)}
              errorId={errors.paidParkingCovered ? "paidParkingCovered-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="paidParkingCovered-error" message={errors.paidParkingCovered} />
      </div>
    </>
  );
}

