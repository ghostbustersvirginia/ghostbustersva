import { useAppearanceRequest } from "../AppearanceRequestContext";
import RadioGroup from "../RadioGroup";

/** Ecto vehicle request toggle. Detail fields (parking, count) appear on the Logistics step. */
export default function EctoVehicles() {
  const { formData, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">{copy.requestEctoVehicleLegend}</legend>
          <div>
            <RadioGroup
              name="requestEctoVehicle"
              options={[
                { value: "yes", label: copy.optionYes },
                { value: "no", label: copy.optionNo },
              ]}
              value={formData.requestEctoVehicle}
              onChange={(v) => update("requestEctoVehicle", v)}
            />
          </div>
        </fieldset>
      </div>

      {formData.requestEctoVehicle === "yes" && (
        <p className="arf__hint" style={{ textAlign: "right" }}>
          {copy.requestEctoVehicleHint}
        </p>
      )}
    </>
  );
}
