export interface FormData {
  // Step 0
  eventName: string;
  eventType: string;
  // Step 1
  isScheduled: string;
  eventStartDate: string;
  eventEndDate: string;
  eventStartTime: string;
  eventEndTime: string;
  earliestSetupTime: string;
  requiredLeaveTime: string;
  // Step 2
  locationDescription: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  // Step 3
  requestEctoVehicle: string;
  ectoVehicleParkingInfo: string;
  maxEctoVehicles: string;
  memberParkingInfo: string;
  paidParkingCovered: string;
  // Step 4
  tablesProvided: string;
  chairsProvided: string;
  numberOfTables: string;
  numberOfChairs: string;
  // Step 5
  charitableDonationsAllowed: string;
  // Step 6
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  companyWebsite: string;
  // Step 7
  additionalInfo: string;
}

/** All user-visible text in the form — loaded from the pageCopy CMS collection. */
export interface FormCopy {
  // Step progress titles
  step0Title: string;
  step1Title: string;
  step2Title: string;
  step3Title: string;
  step4Title: string;
  step5Title: string;
  step6Title: string;
  step7Title: string;

  // Navigation buttons
  navBack: string;
  navNext: string;
  navSubmit: string;
  navSubmitting: string;

  // Success state
  successIcon: string;
  successHeading: string;
  successBody: string;

  // Step 0 — Event Information
  eventNameLabel: string;
  eventTypeLegend: string;
  /** Display labels for the event type radio options (value = label). */
  eventTypeOptions: string[];

  // Step 1 — Event Schedule
  isScheduledLegend: string;
  optionYes: string;
  optionNo: string;
  eventStartDateLabel: string;
  eventEndDateLabel: string;
  eventStartTimeLabel: string;
  eventEndTimeLabel: string;
  earliestSetupTimeLabel: string;
  requiredLeaveTimeLabel: string;

  // Step 2 — Location
  locationDescriptionLabel: string;
  locationDescriptionPlaceholder: string;
  addressLine1Label: string;
  addressLine2Label: string;
  cityLabel: string;
  stateLabel: string;
  zipCodeLabel: string;

  // Step 3 — Vehicles & Parking
  requestEctoVehicleLegend: string;
  ectoVehicleParkingInfoLabel: string;
  ectoVehicleParkingInfoPlaceholder: string;
  maxEctoVehiclesLabel: string;
  memberParkingInfoLabel: string;
  memberParkingInfoPlaceholder: string;
  paidParkingCoveredLegend: string;
  optionNA: string;

  // Step 4 — Tables & Chairs
  // NOTE: radio VALUES ("we provide tables" / "ghostbusters virginia provides tables" / "n/a")
  // are fixed constants used in conditionals; only the display labels below are editable.
  tablesLegend: string;
  tablesOptionWeBring: string;
  tablesOptionGbvaBrings: string;
  numberOfTablesLabel: string;
  chairsLegend: string;
  chairsOptionWeBring: string;
  chairsOptionGbvaBrings: string;
  numberOfChairsLabel: string;

  // Step 5 — Charitable Donations
  charitableDonationsLegend: string;
  optionUnsure: string;

  // Step 6 — Contact Information
  contactNameLabel: string;
  contactEmailLabel: string;
  contactPhoneLabel: string;
  companyNameLabel: string;
  companyWebsiteLabel: string;
  companyWebsitePlaceholder: string;

  // Step 7 — Additional Information
  additionalInfoLabel: string;
  additionalInfoPlaceholder: string;

  // Validation error messages
  errorEventNameRequired: string;
  errorEventTypeRequired: string;
  errorIsScheduledRequired: string;
  errorEventStartDateRequired: string;
  errorEventEndDateRequired: string;
  errorEventStartTimeRequired: string;
  errorEventEndTimeRequired: string;
  errorEarliestSetupTimeRequired: string;
  errorRequiredLeaveTimeRequired: string;
  errorRequestEctoVehicleRequired: string;
  errorEctoVehicleParkingInfoRequired: string;
  errorMaxEctoVehiclesRequired: string;
  errorMemberParkingInfoRequired: string;
  errorPaidParkingCoveredRequired: string;
  errorTablesRequired: string;
  errorChairsRequired: string;
  errorNumberOfTablesRequired: string;
  errorNumberOfChairsRequired: string;
  errorCharitableDonationsRequired: string;
  errorContactNameRequired: string;
  errorContactEmailRequired: string;
  errorContactEmailInvalid: string;
  errorSubmitFailed: string;
  errorNetworkError: string;
}
