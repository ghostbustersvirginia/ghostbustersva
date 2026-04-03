import type { FormCopy, FormData } from "./types";

export const SESSION_KEY = "gbva-appearance-request";
export const FORMSPREE_URL = "https://formspree.io/f/xpqybzjj";
export const TOTAL_STEPS = 8;

/**
 * Hard-coded radio VALUES used in conditional logic and buildPayload.
 * These must never change — only the display labels (in DEFAULT_COPY) can be edited.
 */
export const RADIO_VALUES = {
  yes: "yes",
  no: "no",
  na: "n/a",
  unsure: "unsure",
  tablesWeBring: "we provide tables",
  tablesGbvaBrings: "ghostbusters virginia provides tables",
  chairsWeBring: "we provide chairs",
  chairsGbvaBrings: "ghostbusters virginia provides chairs",
} as const;

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
    "Touch a Truck",
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
  paidParkingCoveredLegend: "Is paid parking covered for members?",
  optionNA: "N/A",

  tablesLegend: "Tables",
  tablesOptionWeBring: "We provide tables",
  tablesOptionGbvaBrings: "Ghostbusters Virginia provides tables",
  numberOfTablesLabel: "How many tables will be provided?",
  chairsLegend: "Chairs",
  chairsOptionWeBring: "We provide chairs",
  chairsOptionGbvaBrings: "Ghostbusters Virginia provides chairs",
  numberOfChairsLabel: "How many chairs will be provided?",

  charitableDonationsLegend: "Are charitable donations allowed at this event?",
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
  errorPaidParkingCoveredRequired: "Please indicate whether paid parking is covered.",
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
  requestEctoVehicle: "",
  ectoVehicleParkingInfo: "",
  maxEctoVehicles: "",
  memberParkingInfo: "",
  paidParkingCovered: "",
  tablesProvided: "",
  chairsProvided: "",
  numberOfTables: "",
  numberOfChairs: "",
  charitableDonationsAllowed: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  companyName: "",
  companyWebsite: "",
  additionalInfo: "",
};

