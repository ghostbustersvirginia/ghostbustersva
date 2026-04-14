import EctoVehicles from "../formSections/EctoVehicles";
import Tables from "../formSections/Tables";
import Chairs from "../formSections/Chairs";

export default function Logistics() {
  return (
    <>
      <EctoVehicles />
      <div className="arf__grid-2">
        <Tables />
        <Chairs />
      </div>
    </>
  );
}
