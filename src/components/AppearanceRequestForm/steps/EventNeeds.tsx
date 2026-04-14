import CharitableDonations from "./CharitableDonations";
import NeedsLogistics from "./NeedsLogistics";

export default function EventNeeds() {
  return (
    <>
      <CharitableDonations />
      <hr className="arf__section-divider" />
      <NeedsLogistics />
    </>
  );
}
