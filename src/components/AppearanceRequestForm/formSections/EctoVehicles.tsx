import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

/** Ecto vehicle request toggle and conditional parking/count fields. */
export default function EctoVehicles() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            {copy.requestEctoVehicleLegend}
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="requestEctoVehicle"
              options={[
                { value: "yes", label: copy.optionYes },
                { value: "no", label: copy.optionNo },
              ]}
              value={formData.requestEctoVehicle}
              onChange={(v) => update("requestEctoVehicle", v)}
              errorId={errors.requestEctoVehicle ? "requestEctoVehicle-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="requestEctoVehicle-error" message={errors.requestEctoVehicle} />
      </div>

      {formData.requestEctoVehicle === "yes" && (
        <div className="arf__conditional">
          <div className="arf__group">
            <FormLabel htmlFor="ectoVehicleParkingInfo" required>
              {copy.ectoVehicleParkingInfoLabel}
            </FormLabel>
            <textarea
              id="ectoVehicleParkingInfo"
              className={[
                "arf__textarea",
                errors.ectoVehicleParkingInfo ? "arf__textarea--error" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              value={formData.ectoVehicleParkingInfo}
              onChange={(e) => update("ectoVehicleParkingInfo", e.target.value)}
              aria-required="true"
              aria-describedby={
                errors.ectoVehicleParkingInfo ? "ectoVehicleParkingInfo-error" : undefined
              }
              placeholder={copy.ectoVehicleParkingInfoPlaceholder}
            />
            <FieldError
              id="ectoVehicleParkingInfo-error"
              message={errors.ectoVehicleParkingInfo}
            />
          </div>

          <div className="arf__group">
            <FormLabel htmlFor="maxEctoVehicles" required>
              {copy.maxEctoVehiclesLabel}
            </FormLabel>
            <input
              id="maxEctoVehicles"
              type="number"
              min="1"
              className={["arf__input", errors.maxEctoVehicles ? "arf__input--error" : ""]
                .filter(Boolean)
                .join(" ")}
              value={formData.maxEctoVehicles}
              onChange={(e) => update("maxEctoVehicles", e.target.value)}
              aria-required="true"
              aria-describedby={errors.maxEctoVehicles ? "maxEctoVehicles-error" : undefined}
              style={{ maxWidth: "8rem" }}
            />
            <FieldError id="maxEctoVehicles-error" message={errors.maxEctoVehicles} />
          </div>
        </div>
      )}
    </>
  );
}

