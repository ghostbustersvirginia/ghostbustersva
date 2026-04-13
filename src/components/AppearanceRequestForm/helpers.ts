import type { FormCopy, FormData } from "./types";

// ------------------------------------------------------------------ //
// Per-step validation                                                  //
// ------------------------------------------------------------------ //

export function validateStep(
  step: number,
  formData: FormData,
  copy: FormCopy,
  enabledSections: Record<string, boolean> = {},
): Partial<Record<keyof FormData, string>> {
  const errs: Partial<Record<keyof FormData, string>> = {};

  if (step === 0) {
    if (!formData.eventName.trim()) errs.eventName = copy.errorEventNameRequired;
    if (!formData.eventType) errs.eventType = copy.errorEventTypeRequired;
    if (formData.eventType === "Other" && !formData.eventTypeOther.trim())
      errs.eventTypeOther = copy.errorEventTypeOtherRequired;
    if (!formData.charitableDonationsAllowed)
      errs.charitableDonationsAllowed = copy.errorCharitableDonationsRequired;
  }

  if (step === 1) {
    if (!formData.isScheduled) errs.isScheduled = copy.errorIsScheduledRequired;
    if (formData.isScheduled === "yes") {
      if (enabledSections.eventDateTime !== false) {
        if (!formData.eventStartDate) errs.eventStartDate = copy.errorEventStartDateRequired;
        if (!formData.eventEndDate) errs.eventEndDate = copy.errorEventEndDateRequired;
        if (!formData.eventStartTime) errs.eventStartTime = copy.errorEventStartTimeRequired;
        if (!formData.eventEndTime) errs.eventEndTime = copy.errorEventEndTimeRequired;
      }
      // earliestSetup fields (earliestSetupTime, requiredLeaveTime) are optional
    }
  }

  // Step 2 (Location) — no required fields
  // Step 3 (Vehicles & Parking) — all fields optional
  // Step 4 (Tables & Chairs) — all fields optional

  // Step 5 (Charitable Donations) is now embedded in step 0 — no standalone validation needed.

  if (step === 6) {
    if (!formData.contactName.trim()) errs.contactName = copy.errorContactNameRequired;
    if (!formData.contactEmail.trim()) errs.contactEmail = copy.errorContactEmailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim()))
      errs.contactEmail = copy.errorContactEmailInvalid;
  }

  return errs;
}

// ------------------------------------------------------------------ //
// FormSpree payload builder                                            //
// ------------------------------------------------------------------ //

export function buildPayload(formData: FormData): Record<string, string> {
  const payload: Record<string, string> = {
    _subject: `Appearance Request: ${formData.eventName}`,
    "Event Name": formData.eventName,
    "Event Type": formData.eventType === "Other"
      ? `Other: ${formData.eventTypeOther}`
      : formData.eventType,
    "Event Scheduled": formData.isScheduled === "yes" ? "Yes" : "No",
  };

  if (formData.isScheduled === "yes") {
    payload["Event Start Date"] = formData.eventStartDate;
    payload["Event End Date"] = formData.eventEndDate;
    payload["Event Start Time"] = formData.eventStartTime;
    payload["Event End Time"] = formData.eventEndTime;
    payload["Earliest Setup / Arrival Time"] = formData.earliestSetupTime;
    payload["Required Leave Time"] = formData.requiredLeaveTime;
  }

  if (formData.locationDescription) payload["Location Description"] = formData.locationDescription;
  if (formData.placeId) payload["Google Place ID"] = formData.placeId;
  if (formData.addressLine1) payload["Street Address"] = formData.addressLine1;
  if (formData.addressLine2) payload["Address Line 2"] = formData.addressLine2;
  if (formData.city) payload["City"] = formData.city;
  if (formData.state) payload["State"] = formData.state;
  if (formData.zipCode) payload["ZIP Code"] = formData.zipCode;

  payload["Requesting Ecto Vehicle"] = formData.requestEctoVehicle === "yes" ? "Yes" : "No";
  if (formData.requestEctoVehicle === "yes") {
    payload["Ecto Vehicle Parking Information"] = formData.ectoVehicleParkingInfo;
    payload["Maximum Ecto Vehicles"] = formData.maxEctoVehicles;
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
    payload["Collect Donations for Host Organization"] =
      formData.collectDonationsForHost === "yes" ? "Yes" : "No";
  }

  // FormSpree uses 'email' as the reply-to address
  payload["email"] = formData.contactEmail;
  payload["Contact Name"] = formData.contactName;
  if (formData.contactPhone) payload["Phone Number"] = formData.contactPhone;
  if (formData.companyName) payload["Company Name"] = formData.companyName;
  if (formData.companyWebsite) payload["Company / Event Website"] = formData.companyWebsite;

  if (formData.additionalInfo) payload["Additional Information"] = formData.additionalInfo;

  return payload;
}

// ------------------------------------------------------------------ //
// sessionStorage helpers                                               //
// ------------------------------------------------------------------ //

export function loadFromSession(key: string): Partial<FormData> | null {
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return JSON.parse(saved) as Partial<FormData>;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveToSession(key: string, data: FormData): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

