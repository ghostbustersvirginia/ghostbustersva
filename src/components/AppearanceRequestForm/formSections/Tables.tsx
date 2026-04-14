import { useAppearanceRequest } from "../AppearanceRequestContext";
import FieldError from "../FieldError";
import FormLabel from "../FormLabel";
import RadioGroup from "../RadioGroup";

export default function Tables() {
  const { formData, errors, update, copy } = useAppearanceRequest();

  const needsCount = formData.tablesProvided !== "" && formData.tablesProvided !== "n/a";
  const countLabel =
    formData.tablesProvided === "ghostbusters virginia provides tables"
      ? copy.numberOfTablesNeededLabel
      : copy.numberOfTablesLabel;

  return (
    <div>
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">{copy.tablesLegend}</legend>
          <div>
            <RadioGroup
              name="tablesProvided"
              options={[
                { value: "n/a", label: copy.tablesOptionNA },
                { value: "we provide tables", label: copy.tablesOptionWeBring },
                {
                  value: "ghostbusters virginia provides tables",
                  label: copy.tablesOptionGbvaBrings,
                },
              ]}
              value={formData.tablesProvided}
              onChange={(v) => update("tablesProvided", v)}
              errorId={errors.tablesProvided ? "tablesProvided-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="tablesProvided-error" message={errors.tablesProvided} />
      </div>

      {needsCount && (
        <div className="arf__conditional">
          <div className="arf__group">
            <FormLabel htmlFor="numberOfTables" required>
              {countLabel}
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
            />
            <FieldError id="numberOfTables-error" message={errors.numberOfTables} />
          </div>
        </div>
      )}
    </div>
  );
}
