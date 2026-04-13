import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

export default function Tables() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  return (
    <>
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">{copy.tablesLegend}</legend>
          <div>
            <RadioGroup
              name="tablesProvided"
              options={[
                { value: "we provide tables", label: copy.tablesOptionWeBring },
                {
                  value: "ghostbusters virginia provides tables",
                  label: copy.tablesOptionGbvaBrings,
                }
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
            <FormLabel htmlFor="numberOfTables">
              {copy.numberOfTablesLabel}
            </FormLabel>
            <input
              id="numberOfTables"
              type="number"
              min="1"
              className="arf__input"
              value={formData.numberOfTables}
              onChange={(e) => update("numberOfTables", e.target.value)}
              style={{ maxWidth: "8rem" }}
            />
            <FieldError id="numberOfTables-error" message={errors.numberOfTables} />
          </div>
        </div>
      )}</>
  );
}

