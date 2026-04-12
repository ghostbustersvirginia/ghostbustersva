import EventName from "../formSections/EventName";
import EventType from "../formSections/EventType";
import StepSelector from "../formSections/StepSelector";

export default function EventInformation() {
  return (
    <>
      <EventName />
      <EventType />
      <StepSelector />
    </>
  );
}

