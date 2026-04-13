import { useAppearanceRequest } from "../AppearanceRequestContext";
import FormLabel from "../FormLabel";

/** Member parking location field. */
export default function ParkingInfo() {
  const { formData, update, copy } = useAppearanceRequest();

  return (
    <div className="arf__group">
      <FormLabel htmlFor="memberParkingInfo">
        {copy.memberParkingInfoLabel}
      </FormLabel>
      <textarea
        id="memberParkingInfo"
        className="arf__textarea"
        value={formData.memberParkingInfo}
        onChange={(e) => update("memberParkingInfo", e.target.value)}
        placeholder={copy.memberParkingInfoPlaceholder}
      />
    </div>
  );
}
