import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";

/** Ecto parking info and vehicle count — shown on the Logistics step when ecto was requested. */
export default function EctoDetails() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  if (formData.requestEctoVehicle !== "yes") return null;

  return (
    <div className="arf__grid-ecto">
      <div className="arf__group">
        <FormLabel htmlFor="ectoVehicleParkingInfo" required>
          {copy.ectoVehicleParkingInfoLabel}
        </FormLabel>
        <textarea
          id="ectoVehicleParkingInfo"
          className={["arf__textarea", errors.ectoVehicleParkingInfo ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.ectoVehicleParkingInfo}
          onChange={(e) => update("ectoVehicleParkingInfo", e.target.value)}
          placeholder={copy.ectoVehicleParkingInfoPlaceholder}
          aria-required="true"
          aria-describedby={
            errors.ectoVehicleParkingInfo ? "ectoVehicleParkingInfo-error" : undefined
          }
        />
        <FieldError id="ectoVehicleParkingInfo-error" message={errors.ectoVehicleParkingInfo} />
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
        />
        <FieldError id="maxEctoVehicles-error" message={errors.maxEctoVehicles} />
      </div>
    </div>
  );
}
