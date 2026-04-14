import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

export default function Chairs() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  const needsCount = formData.chairsProvided !== "" && formData.chairsProvided !== "n/a";
  const countLabel =
    formData.chairsProvided === "ghostbusters virginia provides chairs"
      ? copy.numberOfChairsNeededLabel
      : copy.numberOfChairsLabel;

  return (
    <div>
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">{copy.chairsLegend}</legend>
          <div>
            <RadioGroup
              name="chairsProvided"
              options={[
                { value: "n/a", label: copy.chairsOptionNA },
                { value: "we provide chairs", label: copy.chairsOptionWeBring },
                {
                  value: "ghostbusters virginia provides chairs",
                  label: copy.chairsOptionGbvaBrings,
                },
              ]}
              value={formData.chairsProvided}
              onChange={(v) => update("chairsProvided", v)}
              errorId={errors.chairsProvided ? "chairsProvided-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="chairsProvided-error" message={errors.chairsProvided} />
      </div>

      {needsCount && (
        <div className="arf__conditional">
          <div className="arf__group">
            <FormLabel htmlFor="numberOfChairs" required>
              {countLabel}
            </FormLabel>
            <input
              id="numberOfChairs"
              type="number"
              min="1"
              className={["arf__input", errors.numberOfChairs ? "arf__input--error" : ""]
                .filter(Boolean)
                .join(" ")}
              value={formData.numberOfChairs}
              onChange={(e) => update("numberOfChairs", e.target.value)}
              aria-required="true"
              aria-describedby={errors.numberOfChairs ? "numberOfChairs-error" : undefined}
            />
            <FieldError id="numberOfChairs-error" message={errors.numberOfChairs} />
          </div>
        </div>
      )}
    </div>
  );
}
