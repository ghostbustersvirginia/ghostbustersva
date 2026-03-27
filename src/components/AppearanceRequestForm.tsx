/**
 * AppearanceRequestForm — 8-step appearance request form.
 *
 * Wired to FormSpree for submission. Persists form data in
 * sessionStorage so the user can restart without losing progress.
 */
import { useState, useEffect } from "react";
import "./AppearanceRequestForm.css";

const SESSION_KEY = "gbva-appearance-request";
const FORMSPREE_URL = "https://formspree.io/f/xpqybzjj";
const TOTAL_STEPS = 8;

const EVENT_TYPES = [
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
] as const;

const STEP_TITLES = [
  "Event Information",
  "Event Schedule",
  "Location",
  "Vehicles & Parking",
  "Tables & Chairs",
  "Charitable Donations",
  "Contact Information",
  "Additional Information",
] as const;

// ------------------------------------------------------------------ //
// Types                                                               //
// ------------------------------------------------------------------ //

interface FormData {
  // Step 1
  eventName: string;
  eventType: string;
  // Step 2
  isScheduled: string;
  eventStartDate: string;
  eventEndDate: string;
  eventStartTime: string;
  eventEndTime: string;
  earliestSetupTime: string;
  requiredLeaveTime: string;
  // Step 3
  locationDescription: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  // Step 4
  requestEctoVehicle: string;
  ectoVehicleParkingInfo: string;
  maxEctoVehicles: string;
  memberParkingInfo: string;
  paidParkingCovered: string;
  // Step 5
  tablesProvided: string;
  chairsProvided: string;
  numberOfTables: string;
  numberOfChairs: string;
  // Step 6
  charitableDonationsAllowed: string;
  // Step 7
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  companyWebsite: string;
  // Step 8
  additionalInfo: string;
}

const DEFAULT_FORM_DATA: FormData = {
  eventName: "",
  eventType: "",
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

// ------------------------------------------------------------------ //
// Small helper components                                              //
// ------------------------------------------------------------------ //

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="arf__error" role="alert">
      {message}
    </span>
  );
}

function FormLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="arf__label" htmlFor={htmlFor}>
      {children}
      {required && (
        <span className="arf__required" aria-label="required">
          {" "}
          *
        </span>
      )}
    </label>
  );
}

function RadioGroup({
  name,
  options,
  value,
  onChange,
  errorId,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  errorId?: string;
}) {
  return (
    <div className="arf__radio-group" role="group" aria-describedby={errorId}>
      {options.map((opt) => (
        <label key={opt.value} className="arf__radio-option">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span className="arf__radio-label">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ //
// Step progress indicator                                              //
// ------------------------------------------------------------------ //

function StepProgress({
  step,
  totalSteps,
  stepTitles,
}: {
  step: number;
  totalSteps: number;
  stepTitles: readonly string[];
}) {
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < totalSteps; i++) {
    const nodeClass = [
      "arf__step-node",
      i < step ? "arf__step-node--done" : "",
      i === step ? "arf__step-node--active" : "",
    ]
      .filter(Boolean)
      .join(" ");

    nodes.push(
      <span key={`node-${i}`} className={nodeClass} aria-hidden="true">
        {i < step ? "✓" : i + 1}
      </span>,
    );

    if (i < totalSteps - 1) {
      nodes.push(
        <span
          key={`conn-${i}`}
          className={["arf__step-connector", i < step ? "arf__step-connector--done" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        />,
      );
    }
  }

  return (
    <div className="arf__progress">
      <div className="arf__step-track" aria-hidden="true">
        {nodes}
      </div>
      <div className="arf__step-meta">
        <span className="arf__step-count" aria-live="polite" aria-atomic="true">
          Step {step + 1} of {totalSteps}
        </span>
        <h2 className="arf__step-title">{stepTitles[step]}</h2>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ //
// Navigation buttons                                                   //
// ------------------------------------------------------------------ //

function NavButtons({
  isFirst,
  isLast,
  submitting,
  onBack,
  onNext,
}: {
  isFirst: boolean;
  isLast: boolean;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className={["arf__nav", isFirst ? "arf__nav--end" : ""].filter(Boolean).join(" ")}>
      {!isFirst && (
        <button type="button" className="btn btn--secondary" onClick={onBack}>
          ← Back
        </button>
      )}
      {isLast ? (
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
      ) : (
        <button type="button" className="btn btn--primary" onClick={onNext}>
          Next →
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ //
// Main component                                                       //
// ------------------------------------------------------------------ //

export default function AppearanceRequestForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Restore from session storage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormData>;
        setFormData((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist to session storage on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(formData));
    } catch {
      /* ignore */
    }
  }, [formData]);

  const update = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // ---------------------------------------------------------------- //
  // Per-step validation                                               //
  // ---------------------------------------------------------------- //

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};

    if (step === 0) {
      if (!formData.eventName.trim()) errs.eventName = "Event name is required.";
      if (!formData.eventType) errs.eventType = "Please select an event type.";
    }

    if (step === 1) {
      if (!formData.isScheduled)
        errs.isScheduled = "Please indicate whether the event is already scheduled.";
      if (formData.isScheduled === "yes") {
        if (!formData.eventStartDate) errs.eventStartDate = "Event start date is required.";
        if (!formData.eventEndDate) errs.eventEndDate = "Event end date is required.";
        if (!formData.eventStartTime) errs.eventStartTime = "Event start time is required.";
        if (!formData.eventEndTime) errs.eventEndTime = "Event end time is required.";
        if (!formData.earliestSetupTime)
          errs.earliestSetupTime = "Earliest setup / arrival time is required.";
        if (!formData.requiredLeaveTime) errs.requiredLeaveTime = "Required leave time is required.";
      }
    }

    // Step 3 (index 2) — Location, no required fields

    if (step === 3) {
      if (!formData.requestEctoVehicle)
        errs.requestEctoVehicle = "Please indicate whether you are requesting an ecto vehicle.";
      if (formData.requestEctoVehicle === "yes") {
        if (!formData.ectoVehicleParkingInfo.trim())
          errs.ectoVehicleParkingInfo = "Ecto vehicle parking information is required.";
        if (!formData.maxEctoVehicles.trim())
          errs.maxEctoVehicles = "Maximum number of ecto vehicles is required.";
      }
      if (!formData.memberParkingInfo.trim())
        errs.memberParkingInfo = "Member parking information is required.";
      if (!formData.paidParkingCovered)
        errs.paidParkingCovered = "Please indicate whether paid parking is covered.";
    }

    if (step === 4) {
      if (!formData.tablesProvided) errs.tablesProvided = "Please indicate table availability.";
      if (!formData.chairsProvided) errs.chairsProvided = "Please indicate chair availability.";
      if (formData.tablesProvided === "we provide tables" && !formData.numberOfTables.trim())
        errs.numberOfTables = "Please specify the number of tables.";
      if (formData.chairsProvided === "we provide chairs" && !formData.numberOfChairs.trim())
        errs.numberOfChairs = "Please specify the number of chairs.";
    }

    if (step === 5) {
      if (!formData.charitableDonationsAllowed)
        errs.charitableDonationsAllowed =
          "Please indicate whether charitable donations are allowed.";
    }

    if (step === 6) {
      if (!formData.contactName.trim()) errs.contactName = "Name is required.";
      if (!formData.contactEmail.trim()) errs.contactEmail = "Email address is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim()))
        errs.contactEmail = "Please enter a valid email address.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ---------------------------------------------------------------- //
  // Navigation                                                        //
  // ---------------------------------------------------------------- //

  const goNext = () => {
    if (validate()) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------------------------------------------------------------- //
  // Form submission                                                   //
  // ---------------------------------------------------------------- //

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");

    const payload: Record<string, string> = {
      _subject: `Appearance Request: ${formData.eventName}`,
      "Event Name": formData.eventName,
      "Event Type": formData.eventType,
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

    if (formData.locationDescription)
      payload["Location Description"] = formData.locationDescription;
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
    payload["Paid Parking Covered"] = formData.paidParkingCovered;

    payload["Tables"] = formData.tablesProvided;
    if (formData.tablesProvided === "we provide tables")
      payload["Number of Tables"] = formData.numberOfTables;
    payload["Chairs"] = formData.chairsProvided;
    if (formData.chairsProvided === "we provide chairs")
      payload["Number of Chairs"] = formData.numberOfChairs;

    payload["Charitable Donations Allowed"] = formData.charitableDonationsAllowed;

    // FormSpree uses 'email' as the reply-to address
    payload["email"] = formData.contactEmail;
    payload["Contact Name"] = formData.contactName;
    if (formData.contactPhone) payload["Phone Number"] = formData.contactPhone;
    if (formData.companyName) payload["Company Name"] = formData.companyName;
    if (formData.companyWebsite) payload["Company / Event Website"] = formData.companyWebsite;

    if (formData.additionalInfo) payload["Additional Information"] = formData.additionalInfo;

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitted(true);
        try {
          sessionStorage.removeItem(SESSION_KEY);
        } catch {
          /* ignore */
        }
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(data.error ?? "Submission failed. Please try again.");
      }
    } catch {
      setSubmitError("A network error occurred. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------- //
  // Step renderers                                                    //
  // ---------------------------------------------------------------- //

  const renderStep0 = () => (
    <>
      {/* Event Name */}
      <div className="arf__group">
        <FormLabel htmlFor="eventName" required>
          Event Name
        </FormLabel>
        <input
          id="eventName"
          type="text"
          className={["arf__input", errors.eventName ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.eventName}
          onChange={(e) => update("eventName", e.target.value)}
          aria-required="true"
          aria-describedby={errors.eventName ? "eventName-error" : undefined}
          autoComplete="off"
        />
        <FieldError id="eventName-error" message={errors.eventName} />
      </div>

      {/* Event Type */}
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            Event Type
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="eventType"
              options={EVENT_TYPES.map((t) => ({ value: t, label: t }))}
              value={formData.eventType}
              onChange={(v) => update("eventType", v)}
              errorId={errors.eventType ? "eventType-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="eventType-error" message={errors.eventType} />
      </div>
    </>
  );

  const renderStep1 = () => (
    <>
      {/* Is the event scheduled? */}
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            Is the event already scheduled?
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="isScheduled"
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              value={formData.isScheduled}
              onChange={(v) => update("isScheduled", v)}
              errorId={errors.isScheduled ? "isScheduled-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="isScheduled-error" message={errors.isScheduled} />
      </div>

      {/* Conditional: date/time fields */}
      {formData.isScheduled === "yes" && (
        <div className="arf__conditional">
          <div className="arf__grid-2">
            <div className="arf__group">
              <FormLabel htmlFor="eventStartDate" required>
                Event Start Date
              </FormLabel>
              <input
                id="eventStartDate"
                type="date"
                className={["arf__input", errors.eventStartDate ? "arf__input--error" : ""]
                  .filter(Boolean)
                  .join(" ")}
                value={formData.eventStartDate}
                onChange={(e) => update("eventStartDate", e.target.value)}
                aria-required="true"
                aria-describedby={errors.eventStartDate ? "eventStartDate-error" : undefined}
              />
              <FieldError id="eventStartDate-error" message={errors.eventStartDate} />
            </div>

            <div className="arf__group">
              <FormLabel htmlFor="eventEndDate" required>
                Event End Date
              </FormLabel>
              <input
                id="eventEndDate"
                type="date"
                className={["arf__input", errors.eventEndDate ? "arf__input--error" : ""]
                  .filter(Boolean)
                  .join(" ")}
                value={formData.eventEndDate}
                onChange={(e) => update("eventEndDate", e.target.value)}
                aria-required="true"
                aria-describedby={errors.eventEndDate ? "eventEndDate-error" : undefined}
              />
              <FieldError id="eventEndDate-error" message={errors.eventEndDate} />
            </div>

            <div className="arf__group">
              <FormLabel htmlFor="eventStartTime" required>
                Event Start Time
              </FormLabel>
              <input
                id="eventStartTime"
                type="time"
                className={["arf__input", errors.eventStartTime ? "arf__input--error" : ""]
                  .filter(Boolean)
                  .join(" ")}
                value={formData.eventStartTime}
                onChange={(e) => update("eventStartTime", e.target.value)}
                aria-required="true"
                aria-describedby={errors.eventStartTime ? "eventStartTime-error" : undefined}
              />
              <FieldError id="eventStartTime-error" message={errors.eventStartTime} />
            </div>

            <div className="arf__group">
              <FormLabel htmlFor="eventEndTime" required>
                Event End Time
              </FormLabel>
              <input
                id="eventEndTime"
                type="time"
                className={["arf__input", errors.eventEndTime ? "arf__input--error" : ""]
                  .filter(Boolean)
                  .join(" ")}
                value={formData.eventEndTime}
                onChange={(e) => update("eventEndTime", e.target.value)}
                aria-required="true"
                aria-describedby={errors.eventEndTime ? "eventEndTime-error" : undefined}
              />
              <FieldError id="eventEndTime-error" message={errors.eventEndTime} />
            </div>

            <div className="arf__group">
              <FormLabel htmlFor="earliestSetupTime" required>
                Earliest Setup / Arrival Time
              </FormLabel>
              <input
                id="earliestSetupTime"
                type="time"
                className={["arf__input", errors.earliestSetupTime ? "arf__input--error" : ""]
                  .filter(Boolean)
                  .join(" ")}
                value={formData.earliestSetupTime}
                onChange={(e) => update("earliestSetupTime", e.target.value)}
                aria-required="true"
                aria-describedby={
                  errors.earliestSetupTime ? "earliestSetupTime-error" : undefined
                }
              />
              <FieldError id="earliestSetupTime-error" message={errors.earliestSetupTime} />
            </div>

            <div className="arf__group">
              <FormLabel htmlFor="requiredLeaveTime" required>
                Required Leave Time
              </FormLabel>
              <input
                id="requiredLeaveTime"
                type="time"
                className={["arf__input", errors.requiredLeaveTime ? "arf__input--error" : ""]
                  .filter(Boolean)
                  .join(" ")}
                value={formData.requiredLeaveTime}
                onChange={(e) => update("requiredLeaveTime", e.target.value)}
                aria-required="true"
                aria-describedby={errors.requiredLeaveTime ? "requiredLeaveTime-error" : undefined}
              />
              <FieldError id="requiredLeaveTime-error" message={errors.requiredLeaveTime} />
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderStep2 = () => (
    <>
      <div className="arf__group">
        <FormLabel htmlFor="locationDescription">Location Description</FormLabel>
        <textarea
          id="locationDescription"
          className="arf__textarea"
          value={formData.locationDescription}
          onChange={(e) => update("locationDescription", e.target.value)}
          placeholder="Describe the venue or provide any helpful location context…"
        />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="addressLine1">Street Address</FormLabel>
        <input
          id="addressLine1"
          type="text"
          className="arf__input"
          value={formData.addressLine1}
          onChange={(e) => update("addressLine1", e.target.value)}
          autoComplete="street-address"
        />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="addressLine2">Address Line 2</FormLabel>
        <input
          id="addressLine2"
          type="text"
          className="arf__input"
          value={formData.addressLine2}
          onChange={(e) => update("addressLine2", e.target.value)}
          autoComplete="address-line2"
        />
      </div>

      <div className="arf__grid-2">
        <div className="arf__group">
          <FormLabel htmlFor="city">City</FormLabel>
          <input
            id="city"
            type="text"
            className="arf__input"
            value={formData.city}
            onChange={(e) => update("city", e.target.value)}
            autoComplete="address-level2"
          />
        </div>

        <div className="arf__group">
          <FormLabel htmlFor="state">State</FormLabel>
          <input
            id="state"
            type="text"
            className="arf__input"
            value={formData.state}
            onChange={(e) => update("state", e.target.value)}
            autoComplete="address-level1"
          />
        </div>
      </div>

      <div className="arf__group" style={{ maxWidth: "12rem" }}>
        <FormLabel htmlFor="zipCode">ZIP Code</FormLabel>
        <input
          id="zipCode"
          type="text"
          className="arf__input"
          value={formData.zipCode}
          onChange={(e) => update("zipCode", e.target.value)}
          autoComplete="postal-code"
        />
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      {/* Ecto vehicle request */}
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            Are you requesting an ecto vehicle?
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="requestEctoVehicle"
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              value={formData.requestEctoVehicle}
              onChange={(v) => update("requestEctoVehicle", v)}
              errorId={errors.requestEctoVehicle ? "requestEctoVehicle-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="requestEctoVehicle-error" message={errors.requestEctoVehicle} />
      </div>

      {/* Conditional: ecto vehicle details */}
      {formData.requestEctoVehicle === "yes" && (
        <div className="arf__conditional">
          <div className="arf__group">
            <FormLabel htmlFor="ectoVehicleParkingInfo" required>
              Where should ecto vehicles park?
            </FormLabel>
            <textarea
              id="ectoVehicleParkingInfo"
              className={[
                "arf__textarea",
                errors.ectoVehicleParkingInfo ? "arf__textarea--error" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              value={formData.ectoVehicleParkingInfo}
              onChange={(e) => update("ectoVehicleParkingInfo", e.target.value)}
              aria-required="true"
              aria-describedby={
                errors.ectoVehicleParkingInfo ? "ectoVehicleParkingInfo-error" : undefined
              }
              placeholder="Parking area, access instructions, etc."
            />
            <FieldError
              id="ectoVehicleParkingInfo-error"
              message={errors.ectoVehicleParkingInfo}
            />
          </div>

          <div className="arf__group">
            <FormLabel htmlFor="maxEctoVehicles" required>
              Maximum number of ecto vehicles that can be accommodated
            </FormLabel>
            <input
              id="maxEctoVehicles"
              type="number"
              min="1"
              className={["arf__input", errors.maxEctoVehicles ? "arf__input--error" : ""]
                .filter(Boolean)
                .join(" ")}
              value={formData.maxEctoVehicles}
              onChange={(e) => update("maxEctoVehicles", e.target.value)}
              aria-required="true"
              aria-describedby={errors.maxEctoVehicles ? "maxEctoVehicles-error" : undefined}
              style={{ maxWidth: "8rem" }}
            />
            <FieldError id="maxEctoVehicles-error" message={errors.maxEctoVehicles} />
          </div>
        </div>
      )}

      {/* Member parking */}
      <div className="arf__group">
        <FormLabel htmlFor="memberParkingInfo" required>
          Where should members park on the day of the event?
        </FormLabel>
        <textarea
          id="memberParkingInfo"
          className={["arf__textarea", errors.memberParkingInfo ? "arf__textarea--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.memberParkingInfo}
          onChange={(e) => update("memberParkingInfo", e.target.value)}
          aria-required="true"
          aria-describedby={errors.memberParkingInfo ? "memberParkingInfo-error" : undefined}
          placeholder="Describe member parking location and instructions…"
        />
        <FieldError id="memberParkingInfo-error" message={errors.memberParkingInfo} />
      </div>

      {/* Paid parking */}
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            Is paid parking covered for members?
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="paidParkingCovered"
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "n/a", label: "N/A" },
              ]}
              value={formData.paidParkingCovered}
              onChange={(v) => update("paidParkingCovered", v)}
              errorId={errors.paidParkingCovered ? "paidParkingCovered-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="paidParkingCovered-error" message={errors.paidParkingCovered} />
      </div>
    </>
  );

  const renderStep4 = () => (
    <>
      {/* Tables */}
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            Tables
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="tablesProvided"
              options={[
                { value: "we provide tables", label: "We provide tables" },
                {
                  value: "ghostbusters virginia provides tables",
                  label: "Ghostbusters Virginia provides tables",
                },
                { value: "n/a", label: "N/A" },
              ]}
              value={formData.tablesProvided}
              onChange={(v) => update("tablesProvided", v)}
              errorId={errors.tablesProvided ? "tablesProvided-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="tablesProvided-error" message={errors.tablesProvided} />
      </div>

      {formData.tablesProvided === "we provide tables" && (
        <div className="arf__conditional">
          <div className="arf__group">
            <FormLabel htmlFor="numberOfTables" required>
              How many tables will be provided?
            </FormLabel>
            <input
              id="numberOfTables"
              type="number"
              min="1"
              className={["arf__input", errors.numberOfTables ? "arf__input--error" : ""]
                .filter(Boolean)
                .join(" ")}
              value={formData.numberOfTables}
              onChange={(e) => update("numberOfTables", e.target.value)}
              aria-required="true"
              aria-describedby={errors.numberOfTables ? "numberOfTables-error" : undefined}
              style={{ maxWidth: "8rem" }}
            />
            <FieldError id="numberOfTables-error" message={errors.numberOfTables} />
          </div>
        </div>
      )}

      {/* Chairs */}
      <div className="arf__group">
        <fieldset>
          <legend className="arf__label">
            Chairs
            <span className="arf__required" aria-label="required">
              {" "}
              *
            </span>
          </legend>
          <div>
            <RadioGroup
              name="chairsProvided"
              options={[
                { value: "we provide chairs", label: "We provide chairs" },
                {
                  value: "ghostbusters virginia provides chairs",
                  label: "Ghostbusters Virginia provides chairs",
                },
                { value: "n/a", label: "N/A" },
              ]}
              value={formData.chairsProvided}
              onChange={(v) => update("chairsProvided", v)}
              errorId={errors.chairsProvided ? "chairsProvided-error" : undefined}
            />
          </div>
        </fieldset>
        <FieldError id="chairsProvided-error" message={errors.chairsProvided} />
      </div>

      {formData.chairsProvided === "we provide chairs" && (
        <div className="arf__conditional">
          <div className="arf__group">
            <FormLabel htmlFor="numberOfChairs" required>
              How many chairs will be provided?
            </FormLabel>
            <input
              id="numberOfChairs"
              type="number"
              min="1"
              className={["arf__input", errors.numberOfChairs ? "arf__input--error" : ""]
                .filter(Boolean)
                .join(" ")}
              value={formData.numberOfChairs}
              onChange={(e) => update("numberOfChairs", e.target.value)}
              aria-required="true"
              aria-describedby={errors.numberOfChairs ? "numberOfChairs-error" : undefined}
              style={{ maxWidth: "8rem" }}
            />
            <FieldError id="numberOfChairs-error" message={errors.numberOfChairs} />
          </div>
        </div>
      )}
    </>
  );

  const renderStep5 = () => (
    <div className="arf__group">
      <fieldset>
        <legend className="arf__label">
          Are charitable donations allowed at this event?
          <span className="arf__required" aria-label="required">
            {" "}
            *
          </span>
        </legend>
        <div>
          <RadioGroup
            name="charitableDonationsAllowed"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "unsure", label: "Unsure" },
            ]}
            value={formData.charitableDonationsAllowed}
            onChange={(v) => update("charitableDonationsAllowed", v)}
            errorId={
              errors.charitableDonationsAllowed
                ? "charitableDonationsAllowed-error"
                : undefined
            }
          />
        </div>
      </fieldset>
      <FieldError
        id="charitableDonationsAllowed-error"
        message={errors.charitableDonationsAllowed}
      />
    </div>
  );

  const renderStep6 = () => (
    <>
      <div className="arf__group">
        <FormLabel htmlFor="contactName" required>
          Name
        </FormLabel>
        <input
          id="contactName"
          type="text"
          className={["arf__input", errors.contactName ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.contactName}
          onChange={(e) => update("contactName", e.target.value)}
          aria-required="true"
          aria-describedby={errors.contactName ? "contactName-error" : undefined}
          autoComplete="name"
        />
        <FieldError id="contactName-error" message={errors.contactName} />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="contactEmail" required>
          Email Address
        </FormLabel>
        <input
          id="contactEmail"
          type="email"
          className={["arf__input", errors.contactEmail ? "arf__input--error" : ""]
            .filter(Boolean)
            .join(" ")}
          value={formData.contactEmail}
          onChange={(e) => update("contactEmail", e.target.value)}
          aria-required="true"
          aria-describedby={errors.contactEmail ? "contactEmail-error" : undefined}
          autoComplete="email"
        />
        <FieldError id="contactEmail-error" message={errors.contactEmail} />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="contactPhone">Phone Number</FormLabel>
        <input
          id="contactPhone"
          type="tel"
          className="arf__input"
          value={formData.contactPhone}
          onChange={(e) => update("contactPhone", e.target.value)}
          autoComplete="tel"
        />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="companyName">Company Name</FormLabel>
        <input
          id="companyName"
          type="text"
          className="arf__input"
          value={formData.companyName}
          onChange={(e) => update("companyName", e.target.value)}
          autoComplete="organization"
        />
      </div>

      <div className="arf__group">
        <FormLabel htmlFor="companyWebsite">Company / Event Website</FormLabel>
        <input
          id="companyWebsite"
          type="url"
          className="arf__input"
          value={formData.companyWebsite}
          onChange={(e) => update("companyWebsite", e.target.value)}
          placeholder="https://"
          autoComplete="url"
        />
      </div>
    </>
  );

  const renderStep7 = () => (
    <div className="arf__group">
      <FormLabel htmlFor="additionalInfo">
        Is there anything else you&rsquo;d like us to know?
      </FormLabel>
      <textarea
        id="additionalInfo"
        className="arf__textarea"
        value={formData.additionalInfo}
        onChange={(e) => update("additionalInfo", e.target.value)}
        placeholder="Any additional context, special requirements, or questions…"
        style={{ minHeight: "10rem" }}
      />
    </div>
  );

  const STEP_RENDERERS = [
    renderStep0,
    renderStep1,
    renderStep2,
    renderStep3,
    renderStep4,
    renderStep5,
    renderStep6,
    renderStep7,
  ] as const;

  // ---------------------------------------------------------------- //
  // Success state                                                     //
  // ---------------------------------------------------------------- //

  if (submitted) {
    return (
      <div className="arf__success">
        <div className="arf__success-icon" aria-hidden="true">
          👻
        </div>
        <h2 className="arf__success-heading">Request Received!</h2>
        <p className="arf__success-body">
          Thank you for reaching out to Ghostbusters Virginia. We&rsquo;ve received your appearance
          request and will be in touch soon. Who ya gonna call?
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------- //
  // Main render                                                       //
  // ---------------------------------------------------------------- //

  const isFirst = step === 0;
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <div className="arf">
      <StepProgress step={step} totalSteps={TOTAL_STEPS} stepTitles={STEP_TITLES} />

      <form noValidate onSubmit={isLast ? handleSubmit : (e) => e.preventDefault()}>
        {STEP_RENDERERS[step]()}

        {submitError && (
          <div className="arf__submit-error" role="alert">
            {submitError}
          </div>
        )}

        <NavButtons
          isFirst={isFirst}
          isLast={isLast}
          submitting={submitting}
          onBack={goBack}
          onNext={goNext}
        />
      </form>
    </div>
  );
}
