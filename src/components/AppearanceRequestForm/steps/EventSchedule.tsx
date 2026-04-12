import { useAppearanceRequest } from "../AppearanceRequestContext";
import IsScheduled from "../formSections/IsScheduled";
import EventDateTime from "../formSections/EventDateTime";
import EarliestSetup from "../formSections/EarliestSetup";

export default function EventSchedule() {
  const { formData } = useAppearanceRequest();

  return (
    <>
      <IsScheduled />
      {formData.isScheduled === "yes" && (
        <div className="arf__conditional">
          <div className="arf__grid-2">
            <EventDateTime />
            <EarliestSetup />
          </div>
        </div>
      )}
    </>
  );
}

