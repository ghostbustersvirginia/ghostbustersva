import { useAppearanceRequest } from "../AppearanceRequestContext";
import Tables from "../formSections/Tables";
import Chairs from "../formSections/Chairs";

export default function TablesAndChairs() {
  const { enabledSections } = useAppearanceRequest();
  const sections = enabledSections[4] ?? {};

  return (
    <>
      {sections.tables !== false && <Tables />}
      {sections.chairs !== false && <Chairs />}
    </>
  );
}

