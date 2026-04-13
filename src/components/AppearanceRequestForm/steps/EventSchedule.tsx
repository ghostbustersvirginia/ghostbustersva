import { useAppearanceRequest } from "../AppearanceRequestContext";
import IsScheduled from "../formSections/IsScheduled";
import EventDateTime from "../formSections/EventDateTime";
import EarliestSetup from "../formSections/EarliestSetup";

export default function EventSchedule() {
  const { formData, enabledSections } = useAppearanceRequest();
  const sections = enabledSections[1] ?? {};
  const showConditional =
    formData.isScheduled === "yes" &&
    (sections.eventDateTime !== false || sections.earliestSetup !== false);

  return (
    <>
      <IsScheduled />
      {showConditional && (
        <div className="arf__conditional">
          <div className="arf__grid-2">
            {sections.eventDateTime !== false && <EventDateTime />}
            {sections.earliestSetup !== false && <EarliestSetup />}
          </div>
        </div>
      )}
    </>
  );
}
