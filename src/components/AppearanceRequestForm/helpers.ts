import type { FormCopy, FormData } from "./types";

type FormErrors = Partial<Record<keyof FormData, string>>;
type StepCompletionCheck = (formData: FormData) => boolean;
type StepValidator = (formData: FormData, copy: FormCopy) => FormErrors;

const hasText = (value: string): boolean => value.trim().length > 0;
const needsCount = (value: string): boolean => value !== "" && value !== "n/a";

const STEP_COMPLETION_CHECKS: Partial<Record<number, StepCompletionCheck>> = {
  0: (formData) => {
    if (!hasText(formData.eventName)) return false;
    if (!formData.eventType) return false;
    if (formData.eventType === "Other" && !hasText(formData.eventTypeOther)) return false;
    if (!formData.isScheduled) return false;
    if (formData.isScheduled === "yes") {
      if (!formData.eventStartDate) return false;
      if (!formData.eventEndDate) return false;
      if (!formData.eventStartTime) return false;
      if (!formData.eventEndTime) return false;
    }
    return true;
  },
  1: (formData) => {
    if (!hasText(formData.addressLine1)) return false;
    if (!hasText(formData.city)) return false;
    if (!hasText(formData.state)) return false;
    return true;
  },
  2: (formData) => {
    if (!formData.charitableDonationsAllowed) return false;
    if (!formData.needsLogistics) return false;
    return true;
  },
  // Step 3 (Logistics) is conditionally validated on Next; no pre-emptive disable needed.
  4: (formData) => {
    if (!hasText(formData.contactName)) return false;
    if (!hasText(formData.contactEmail)) return false;
    return true;
  },
};

const STEP_VALIDATORS: Record<number, StepValidator> = {
  0: (formData, copy) => {
    const errs: FormErrors = {};
    if (!hasText(formData.eventName)) errs.eventName = copy.errorEventNameRequired;
    if (!formData.eventType) errs.eventType = copy.errorEventTypeRequired;
    if (formData.eventType === "Other" && !hasText(formData.eventTypeOther)) {
      errs.eventTypeOther = copy.errorEventTypeOtherRequired;
    }
    if (!formData.isScheduled) errs.isScheduled = copy.errorIsScheduledRequired;
    if (formData.isScheduled === "yes") {
      if (!formData.eventStartDate) errs.eventStartDate = copy.errorEventStartDateRequired;
      if (!formData.eventEndDate) errs.eventEndDate = copy.errorEventEndDateRequired;
      if (!formData.eventStartTime) errs.eventStartTime = copy.errorEventStartTimeRequired;
      if (!formData.eventEndTime) errs.eventEndTime = copy.errorEventEndTimeRequired;
    }
    return errs;
  },
  1: (formData, copy) => {
    const errs: FormErrors = {};
    if (!hasText(formData.addressLine1)) errs.addressLine1 = copy.errorAddressLine1Required;
    if (!hasText(formData.city)) errs.city = copy.errorCityRequired;
    if (!hasText(formData.state)) errs.state = copy.errorStateRequired;
    return errs;
  },
  2: (formData, copy) => {
    const errs: FormErrors = {};
    if (!formData.charitableDonationsAllowed) {
      errs.charitableDonationsAllowed = copy.errorCharitableDonationsRequired;
    }
    if (!formData.needsLogistics) errs.needsLogistics = copy.errorNeedsLogisticsRequired;
    return errs;
  },
  3: (formData, copy) => {
    const errs: FormErrors = {};
    if (formData.requestEctoVehicle === "yes") {
      if (!hasText(formData.ectoVehicleParkingInfo)) {
        errs.ectoVehicleParkingInfo = copy.errorEctoVehicleParkingInfoRequired;
      }
      if (!hasText(formData.maxEctoVehicles)) {
        errs.maxEctoVehicles = copy.errorMaxEctoVehiclesRequired;
      }
    }
    if (needsCount(formData.tablesProvided) && !hasText(formData.numberOfTables)) {
      errs.numberOfTables = copy.errorNumberOfTablesRequired;
    }
    if (needsCount(formData.chairsProvided) && !hasText(formData.numberOfChairs)) {
      errs.numberOfChairs = copy.errorNumberOfChairsRequired;
    }
    return errs;
  },
  4: (formData, copy) => {
    const errs: FormErrors = {};
    if (!hasText(formData.contactName)) errs.contactName = copy.errorContactNameRequired;
    if (!hasText(formData.contactEmail)) errs.contactEmail = copy.errorContactEmailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
      errs.contactEmail = copy.errorContactEmailInvalid;
    }
    return errs;
  },
};

// ------------------------------------------------------------------ //
// Per-step completion check (presence only — no error messages)       //
// Used to enable/disable the Next button before the user tries to     //
// advance.                                                            //
// ------------------------------------------------------------------ //

export function isStepComplete(step: number, formData: FormData): boolean {
  const check = STEP_COMPLETION_CHECKS[step];
  return check ? check(formData) : true;
}

// ------------------------------------------------------------------ //
// Per-step validation                                                  //
// ------------------------------------------------------------------ //

export function validateStep(
  step: number,
  formData: FormData,
  copy: FormCopy,
): Partial<Record<keyof FormData, string>> {
  const validator = STEP_VALIDATORS[step];
  return validator ? validator(formData, copy) : {};
}

// ------------------------------------------------------------------ //
// FormSpree payload builder                                            //
// ------------------------------------------------------------------ //

export function buildPayload(formData: FormData): Record<string, string> {
  const payload: Record<string, string> = {
    _subject: `Appearance Request: ${formData.eventName}`,
    "Event Name": formData.eventName,
    "Event Type":
      formData.eventType === "Other" ? `Other: ${formData.eventTypeOther}` : formData.eventType,
    "Event Scheduled": formData.isScheduled === "yes" ? "Yes" : "No",
  };

  const addIfValue = (label: string, value: string): void => {
    if (value) payload[label] = value;
  };

  const addPairs = (pairs: Array<[string, string]>): void => {
    for (const [label, value] of pairs) {
      payload[label] = value;
    }
  };

  if (formData.isScheduled === "yes") {
    addPairs([
      ["Event Start Date", formData.eventStartDate],
      ["Event End Date", formData.eventEndDate],
      ["Event Start Time", formData.eventStartTime],
      ["Event End Time", formData.eventEndTime],
      ["Earliest Setup / Arrival Time", formData.earliestSetupTime],
      ["Required Leave Time", formData.requiredLeaveTime],
    ]);
  }
  if (formData.isScheduled === "no") addIfValue("Timing Notes", formData.unscheduledNote);

  addIfValue("Location Description", formData.locationDescription);
  addIfValue("Google Place ID", formData.placeId);
  addIfValue("Street Address", formData.addressLine1);
  addIfValue("Address Line 2", formData.addressLine2);
  addIfValue("City", formData.city);
  addIfValue("State", formData.state);
  addIfValue("ZIP Code", formData.zipCode);

  payload["Requesting Ecto Vehicle"] = formData.requestEctoVehicle === "yes" ? "Yes" : "No";
  if (formData.requestEctoVehicle === "yes") {
    addPairs([
      ["Ecto Vehicle Parking Information", formData.ectoVehicleParkingInfo],
      ["Maximum Ecto Vehicles", formData.maxEctoVehicles],
    ]);
  }
  payload["Member Parking Information"] = formData.memberParkingInfo;

  payload["Tables"] = formData.tablesProvided;
  if (formData.tablesProvided === "we provide tables")
    payload["Number of Tables"] = formData.numberOfTables;
  payload["Chairs"] = formData.chairsProvided;
  if (formData.chairsProvided === "we provide chairs")
    payload["Number of Chairs"] = formData.numberOfChairs;

  payload["Charitable Donations Allowed"] = formData.charitableDonationsAllowed;
  if (formData.charitableDonationsAllowed === "yes" && formData.collectDonationsForHost) {
    payload["Donations For"] = formData.collectDonationsForHost;
    if (formData.collectDonationsForHost === "host choice") {
      addIfValue("Charity", formData.charityInfo);
    }
  }

  // FormSpree uses 'email' as the reply-to address
  payload["email"] = formData.contactEmail;
  payload["Contact Name"] = formData.contactName;
  addIfValue("Phone Number", formData.contactPhone);
  addIfValue("Company Name", formData.companyName);
  addIfValue("Company / Event Website", formData.companyWebsite);
  addIfValue("Additional Information", formData.additionalInfo);

  return payload;
}

// ------------------------------------------------------------------ //
// sessionStorage helpers                                               //
// ------------------------------------------------------------------ //

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadFromSession(key: string): Partial<FormData> | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const saved = storage.getItem(key);
    if (saved) return JSON.parse(saved) as Partial<FormData>;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveToSession(key: string, data: FormData): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearSession(key: string): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}
