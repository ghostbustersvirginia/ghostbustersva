import CharitableDonations from "./CharitableDonations";
import NeedsLogistics from "./NeedsLogistics";
import EctoVehicles from "../formSections/EctoVehicles";

export default function EventNeeds() {
  return (
    <>
      <CharitableDonations />
      <hr className="arf__section-divider" />
      <EctoVehicles />
      <hr className="arf__section-divider" />
      <NeedsLogistics />
    </>
  );
}
