export interface FormData {
  // Step 0
  eventName: string;
  eventType: string;
  eventTypeOther: string;
  // Step 1
  isScheduled: string;
  unscheduledNote: string;
  eventStartDate: string;
  eventEndDate: string;
  eventStartTime: string;
  eventEndTime: string;
  earliestSetupTime: string;
  requiredLeaveTime: string;
  // Step 2
  placeId: string;
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
  // Step 4
  tablesProvided: string;
  chairsProvided: string;
  numberOfTables: string;
  numberOfChairs: string;
  // Step 5 (gating question lives in Step 0)
  needsLogistics: string;
  charitableDonationsAllowed: string;
  collectDonationsForHost: string;
  charityInfo: string;
  // Step 6
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  companyWebsite: string;
  // Step 7
  additionalInfo: string;
}

/** All user-visible text in the form. */
export interface FormCopy {
  // Step progress titles (5 steps)
  step0Title: string;
  step1Title: string;
  step2Title: string;
  step3Title: string;
  step4Title: string;

  // Navigation buttons
  navBack: string;
  navNext: string;
  navSubmit: string;
  navSubmitting: string;
  navReset: string;
  navResetModalHeading: string;
  navResetModalBody: string;
  navResetModalConfirm: string;
  navResetModalCancel: string;

  // Success state
  successIcon: string;
  successHeading: string;
  successBody: string;

  // Step 0 — Event Information
  eventNameLabel: string;
  eventTypeLegend: string;
  /** Display labels for the event type radio options (value = label). */
  eventTypeOptions: string[];
  eventTypeOtherLabel: string;

  // Step 1 — Event Schedule
  isScheduledLegend: string;
  unscheduledNoteLabel: string;
  unscheduledNotePlaceholder: string;
  optionYes: string;
  optionNo: string;
  eventStartDateLabel: string;
  eventEndDateLabel: string;
  eventStartTimeLabel: string;
  eventEndTimeLabel: string;
  earliestSetupTimeLabel: string;
  requiredLeaveTimeLabel: string;

  // Step 2 — Location
  locationSearchLabel: string;
  locationSearchPlaceholder: string;
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
  maxEctoVehiclesShortLabel: string;
  memberParkingInfoLabel: string;
  memberParkingInfoPlaceholder: string;

  // Step 4 — Tables & Chairs
  // NOTE: radio VALUES ("we provide tables" / "ghostbusters virginia provides tables" / "n/a")
  // are fixed constants used in conditionals; only the display labels below are editable.
  tablesLegend: string;
  tablesOptionWeBring: string;
  tablesOptionGbvaBrings: string;
  tablesOptionNA: string;
  numberOfTablesLabel: string;
  numberOfTablesNeededLabel: string;
  chairsLegend: string;
  chairsOptionWeBring: string;
  chairsOptionGbvaBrings: string;
  chairsOptionNA: string;
  numberOfChairsLabel: string;
  numberOfChairsNeededLabel: string;

  // Step 0 — Logistics gating
  requestEctoVehicleHint: string;
  needsLogisticsLegend: string;
  needsLogisticsHint: string;
  errorNeedsLogisticsRequired: string;

  // Step 5 — Charitable Donations
  charitableDonationsLegend: string;
  collectDonationsForHostLegend: string;
  charityInfoLabel: string;
  charityInfoPlaceholder: string;
  charityInfoHint: string;
  optionOurChoice: string;
  optionYourChoice: string;
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
  errorEventTypeOtherRequired: string;
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
  errorTablesRequired: string;
  errorChairsRequired: string;
  errorNumberOfTablesRequired: string;
  errorNumberOfChairsRequired: string;
  errorCharitableDonationsRequired: string;
  errorAddressLine1Required: string;
  errorCityRequired: string;
  errorStateRequired: string;
  errorContactNameRequired: string;
  errorContactEmailRequired: string;
  errorContactEmailInvalid: string;
  errorSubmitFailed: string;
  errorNetworkError: string;
}
