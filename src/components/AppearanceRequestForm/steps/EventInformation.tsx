import EventName from "../formSections/EventName";
import EventType from "../formSections/EventType";
import CharitableDonations from "./CharitableDonations";

export default function EventInformation() {
  return (
    <>
      <EventName />
      <EventType />
      <CharitableDonations />
    </>
  );
}
