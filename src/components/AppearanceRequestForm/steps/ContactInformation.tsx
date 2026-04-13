import { useAppearanceRequest } from "../AppearanceRequestContext";
import PersonContact from "../formSections/PersonContact";
import CompanyContact from "../formSections/CompanyContact";

export default function ContactInformation() {
  const { enabledSections } = useAppearanceRequest();
  const sections = enabledSections[6] ?? {};

  return (
    <>
      <PersonContact />
      {sections.companyContact !== false && <CompanyContact />}
    </>
  );
}

