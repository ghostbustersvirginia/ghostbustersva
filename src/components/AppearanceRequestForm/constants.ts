import type { FormCopy, FormData } from "./types";

export const SESSION_KEY = "gbva-appearance-request";
export const FORMSPREE_URL = "https://formspree.io/f/xpqybzjj";

// ------------------------------------------------------------------ //
// Step & section definitions — drive StepSelector and validation      //
// ------------------------------------------------------------------ //

export interface SectionDef {
  /** Stable ID — key in enabledSections map. */
  id: string;
  /** Display label shown in StepSelector chip. */
  label: string;
  /** Required sections cannot be toggled off. */
  required: boolean;
}

export interface StepDef {
  /** 0-based index matching the STEP_COMPONENTS array in AppearanceRequestForm.tsx. */
  originalIndex: number;
  /**
   * When set, only THIS sectionId being enabled makes the step active.
   * Subsections (other sections in the array) are shown in StepSelector
   * only while the gate section is enabled.
   */
  gateSection?: string;
  sections: SectionDef[];
}

/**
 * Configuration for steps 1–7 (step 0 / Event Information is always present).
 * A step is active when it has at least one required section OR any optional
 * section is currently enabled.
 */
export const STEP_DEFINITIONS: StepDef[] = [
  {
    // EventSchedule: gate section controls whether the step is active.
    // Subsections appear in StepSelector only while the gate is enabled.
    originalIndex: 1,
    gateSection: "eventSchedule",
    sections: [
      { id: "eventSchedule", label: "Event Schedule", required: false },
      { id: "eventDateTime", label: "Dates & Times", required: false },
      { id: "earliestSetup", label: "Setup Times", required: false },
    ],
  },
  {
    originalIndex: 2,
    sections: [
      { id: "venueSearch", label: "Venue Search", required: true },
      { id: "address", label: "Address", required: true },
    ],
  },
  {
    originalIndex: 3,
    sections: [
      { id: "ectoVehicles", label: "Ecto Vehicles", required: false },
      { id: "parkingInfo", label: "Parking Info", required: false },
    ],
  },
  {
    originalIndex: 4,
    sections: [
      { id: "tables", label: "Tables", required: false },
      { id: "chairs", label: "Chairs", required: false },
    ],
  },
  // Step 5 (Charitable Donations) is embedded directly in EventInformation — not a standalone step.
  {
    originalIndex: 6,
    sections: [
      { id: "personContact", label: "Personal Contact", required: true },
      { id: "companyContact", label: "Company Info", required: false },
    ],
  },
  {
    originalIndex: 7,
    sections: [{ id: "additionalInfo", label: "Additional Information", required: false }],
  },
];

/** Build the default section-enabled map — opt-in sections start disabled. */
export function buildDefaultEnabledSections(): Record<number, Record<string, boolean>> {
  const result: Record<number, Record<string, boolean>> = {};
  for (const def of STEP_DEFINITIONS) {
    result[def.originalIndex] = {};
    for (const s of def.sections) {
      if (!s.required) result[def.originalIndex][s.id] = true;
    }
  }
  // These sections are opt-in — disabled by default.
  result[3].ectoVehicles = false;
  result[3].parkingInfo = false;
  result[4].tables = false;
  result[4].chairs = false;
  result[6].companyContact = false;
  return result;
}

/**
 * Default copy used when no CMS entry is available.
 * Mirrors src/content/page-copy/appearance-request-form.json exactly.
 */
export const DEFAULT_COPY: FormCopy = {
  step0Title: "Event Information",
  step1Title: "Event Schedule",
  step2Title: "Location",
  step3Title: "Vehicles & Parking",
  step4Title: "Tables & Chairs",
  step5Title: "Charitable Donations",
  step6Title: "Contact Information",
  step7Title: "Additional Information",

  navBack: "← Back",
  navNext: "Next →",
  navSubmit: "Submit Request",
  navSubmitting: "Submitting…",

  successIcon: "👻",
  successHeading: "Request Received!",
  successBody:
    "Thank you for reaching out to Ghostbusters Virginia. We\u2019ve received your appearance request and will be in touch soon. Who ya gonna call?",

  eventNameLabel: "Event Name",
  eventTypeLegend: "Event Type",
  eventTypeOptions: [
    "Birthday",
    "Car Show",
    "Charity Fundraiser",
    "Convention / Trade Show",
    "Festival",
    "Hospital / Home Visit",
    "Parade",
    "TV / Radio / Podcast",
    "Trunk or Treat",
    "Other",
  ],
  eventTypeOtherLabel: "Please describe the event type",

  isScheduledLegend: "Is the event already scheduled?",
  optionYes: "Yes",
  optionNo: "No",
  eventStartDateLabel: "Event Start Date",
  eventEndDateLabel: "Event End Date",
  eventStartTimeLabel: "Event Start Time",
  eventEndTimeLabel: "Event End Time",
  earliestSetupTimeLabel: "Earliest Setup / Arrival Time",
  requiredLeaveTimeLabel: "Required Leave Time",

  locationSearchLabel: "Search for a Venue or Address",
  locationSearchPlaceholder: "Start typing a place name or address\u2026",
  locationDescriptionLabel: "Location Description",
  locationDescriptionPlaceholder: "Describe the venue or provide any helpful location context\u2026",
  addressLine1Label: "Street Address",
  addressLine2Label: "Address Line 2",
  cityLabel: "City",
  stateLabel: "State",
  zipCodeLabel: "ZIP Code",

  requestEctoVehicleLegend: "Are you requesting an ecto vehicle?",
  ectoVehicleParkingInfoLabel: "Where should ecto vehicles park?",
  ectoVehicleParkingInfoPlaceholder: "Parking area, access instructions, etc.",
  maxEctoVehiclesLabel: "Maximum number of ecto vehicles that can be accommodated",
  memberParkingInfoLabel: "Where should members park on the day of the event?",
  memberParkingInfoPlaceholder: "Describe member parking location and instructions\u2026",

  tablesLegend: "Tables",
  tablesOptionWeBring: "We provide tables",
  tablesOptionGbvaBrings: "Ghostbusters Virginia provides tables",
  numberOfTablesLabel: "How many tables will be provided?",
  chairsLegend: "Chairs",
  chairsOptionWeBring: "We provide chairs",
  chairsOptionGbvaBrings: "Ghostbusters Virginia provides chairs",
  numberOfChairsLabel: "How many chairs will be provided?",

  charitableDonationsLegend: "Are charitable donations allowed at this event?",
  collectDonationsForHostLegend:
    "For whom can we collect donations?",
  optionOurChoice: "My choice of approved charity",
  optionYourChoice: "Ghostbusters, Virginia's choice of charity",
  optionUnsure: "Unsure",

  contactNameLabel: "Name",
  contactEmailLabel: "Email Address",
  contactPhoneLabel: "Phone Number",
  companyNameLabel: "Company Name",
  companyWebsiteLabel: "Company / Event Website",
  companyWebsitePlaceholder: "https://",

  additionalInfoLabel: "Is there anything else you\u2019d like us to know?",
  additionalInfoPlaceholder: "Any additional context, special requirements, or questions\u2026",

  errorEventNameRequired: "Event name is required.",
  errorEventTypeRequired: "Please select an event type.",
  errorEventTypeOtherRequired: "Please describe the event type.",
  errorIsScheduledRequired: "Please indicate whether the event is already scheduled.",
  errorEventStartDateRequired: "Event start date is required.",
  errorEventEndDateRequired: "Event end date is required.",
  errorEventStartTimeRequired: "Event start time is required.",
  errorEventEndTimeRequired: "Event end time is required.",
  errorEarliestSetupTimeRequired: "Earliest setup / arrival time is required.",
  errorRequiredLeaveTimeRequired: "Required leave time is required.",
  errorRequestEctoVehicleRequired:
    "Please indicate whether you are requesting an ecto vehicle.",
  errorEctoVehicleParkingInfoRequired: "Ecto vehicle parking information is required.",
  errorMaxEctoVehiclesRequired: "Maximum number of ecto vehicles is required.",
  errorMemberParkingInfoRequired: "Member parking information is required.",
  errorTablesRequired: "Please indicate table availability.",
  errorChairsRequired: "Please indicate chair availability.",
  errorNumberOfTablesRequired: "Please specify the number of tables.",
  errorNumberOfChairsRequired: "Please specify the number of chairs.",
  errorCharitableDonationsRequired: "Please indicate whether charitable donations are allowed.",
  errorContactNameRequired: "Name is required.",
  errorContactEmailRequired: "Email address is required.",
  errorContactEmailInvalid: "Please enter a valid email address.",
  errorSubmitFailed: "Submission failed. Please try again.",
  errorNetworkError: "A network error occurred. Please check your connection and try again.",
};

export const DEFAULT_FORM_DATA: FormData = {
  eventName: "",
  eventType: "",
  eventTypeOther: "",
  isScheduled: "",
  eventStartDate: "",
  eventEndDate: "",
  eventStartTime: "",
  eventEndTime: "",
  earliestSetupTime: "",
  requiredLeaveTime: "",
  locationDescription: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zipCode: "",
  placeId: "",
  requestEctoVehicle: "",
  ectoVehicleParkingInfo: "",
  maxEctoVehicles: "",
  memberParkingInfo: "",
  tablesProvided: "",
  chairsProvided: "",
  numberOfTables: "",
  numberOfChairs: "",
  charitableDonationsAllowed: "",
  collectDonationsForHost: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  companyName: "",
  companyWebsite: "",
  additionalInfo: "",
};

