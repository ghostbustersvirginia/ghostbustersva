import { useAppearanceRequest } from "../AppearanceRequestContext";
import EctoVehicles from "../formSections/EctoVehicles";
import ParkingInfo from "../formSections/ParkingInfo";

export default function VehiclesAndParking() {
  const { enabledSections } = useAppearanceRequest();
  const sections = enabledSections[3] ?? {};

  return (
    <>
      {sections.ectoVehicles !== false && <EctoVehicles />}
      {sections.parkingInfo !== false && <ParkingInfo />}
    </>
  );
}

