import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

export default function Step4TablesAndChairs() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            {copy.tablesLegend}
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="tablesProvided"
              options={[
                { value: "we provide tables", label: copy.tablesOptionWeBring },
                { value: "ghostbusters virginia provides tables", label: copy.tablesOptionGbvaBrings },
                { value: "n/a", label: copy.optionNA },
              ]}
              value={formData.tablesProvided}
              onChange={(v) => update("tablesProvided", v)}
              errorId={errors.tablesProvided ? "tablesProvided-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="tablesProvided-error" message={errors.tablesProvided} />
      </div>

      {formData.tablesProvided === "we provide tables" && (
        <div className="arf__conditional">
          <div className="arf__group">
            <FormLabel htmlFor="numberOfTables" required>
              {copy.numberOfTablesLabel}
            </FormLabel>
            <input
              id="numberOfTables"
              type="number"
              min="1"
              className={["arf__input", errors.numberOfTables ? "arf__input--error" : ""]
                .filter(Boolean)
                .join(" ")}
              value={formData.numberOfTables}
              onChange={(e) => update("numberOfTables", e.target.value)}
              aria-required="true"
              aria-describedby={errors.numberOfTables ? "numberOfTables-error" : undefined}
              style={{ maxWidth: "8rem" }}
            />
            <FieldError id="numberOfTables-error" message={errors.numberOfTables} />
          </div>
        </div>
      )}

      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            {copy.chairsLegend}
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="chairsProvided"
              options={[
                { value: "we provide chairs", label: copy.chairsOptionWeBring },
                { value: "ghostbusters virginia provides chairs", label: copy.chairsOptionGbvaBrings },
                { value: "n/a", label: copy.optionNA },
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
            <FormLabel htmlFor="numberOfChairs" required>
              {copy.numberOfChairsLabel}
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
              style={{ maxWidth: "8rem" }}
            />
            <FieldError id="numberOfChairs-error" message={errors.numberOfChairs} />
          </div>
        </div>
      )}
    </>
  );
}
