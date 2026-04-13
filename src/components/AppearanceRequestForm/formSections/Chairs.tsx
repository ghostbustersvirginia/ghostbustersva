import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

export default function Chairs() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">{copy.chairsLegend}</legend>
          <div>
            <RadioGroup
              name="chairsProvided"
              options={[
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

      {formData.chairsProvided === "we provide chairs" && (
        <div className="arf__conditional">
          <div className="arf__group">
            <FormLabel htmlFor="numberOfChairs">
              {copy.numberOfChairsLabel}
            </FormLabel>
            <input
              id="numberOfChairs"
              type="number"
              min="1"
              className="arf__input"
              value={formData.numberOfChairs}
              onChange={(e) => update("numberOfChairs", e.target.value)}
              style={{ maxWidth: "8rem" }}
            />
            <FieldError id="numberOfChairs-error" message={errors.numberOfChairs} />
          </div>
        </div>
      )}
    </>
  );
}

