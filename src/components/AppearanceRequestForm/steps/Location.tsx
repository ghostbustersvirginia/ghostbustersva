import { useAppearanceRequest } from "../AppearanceRequestContext";
import FormLabel from "../FormLabel";
import PlaceSearch from "../formSections/PlaceSearch";

export default function Location() {
  const { formData, update, copy } = useAppearanceRequest();

  return (
    <>
      <PlaceSearch />

      <div className="arf__group">
        <FormLabel htmlFor="locationDescription">{copy.locationDescriptionLabel}</FormLabel>
        <textarea
          id="locationDescription"
          className="arf__textarea"
          value={formData.locationDescription}
          onChange={(e) => update("locationDescription", e.target.value)}
          placeholder={copy.locationDescriptionPlaceholder}
        />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="addressLine1">{copy.addressLine1Label}</FormLabel>
        <input
          id="addressLine1"
          type="text"
          className="arf__input"
          value={formData.addressLine1}
          onChange={(e) => update("addressLine1", e.target.value)}
          autoComplete="street-address"
        />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="addressLine2">{copy.addressLine2Label}</FormLabel>
        <input
          id="addressLine2"
          type="text"
          className="arf__input"
          value={formData.addressLine2}
          onChange={(e) => update("addressLine2", e.target.value)}
          autoComplete="address-line2"
        />
      </div>

      <div className="arf__grid-2">
        <div className="arf__group">
          <FormLabel htmlFor="city">{copy.cityLabel}</FormLabel>
          <input
            id="city"
            type="text"
            className="arf__input"
            value={formData.city}
            onChange={(e) => update("city", e.target.value)}
            autoComplete="address-level2"
          />
        </div>

        <div className="arf__group">
          <FormLabel htmlFor="state">{copy.stateLabel}</FormLabel>
          <input
            id="state"
            type="text"
            className="arf__input"
            value={formData.state}
            onChange={(e) => update("state", e.target.value)}
            autoComplete="address-level1"
          />
        </div>
      </div>

      <div className="arf__group" style={{ maxWidth: "12rem" }}>
        <FormLabel htmlFor="zipCode">{copy.zipCodeLabel}</FormLabel>
        <input
          id="zipCode"
          type="text"
          className="arf__input"
          value={formData.zipCode}
          onChange={(e) => update("zipCode", e.target.value)}
          autoComplete="postal-code"
        />
      </div>
    </>
  );
}

