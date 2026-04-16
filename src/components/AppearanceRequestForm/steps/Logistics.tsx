import EctoDetails from "../formSections/EctoDetails";
import Tables from "../formSections/Tables";
import Chairs from "../formSections/Chairs";

export default function Logistics() {
  return (
    <>
      <EctoDetails />
      <div className="arf__grid-2">
        <Tables />
        <Chairs />
      </div>
    </>
  );
}
