import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { FormCopy, FormData } from "./types";
import { SESSION_KEY, FORMSPREE_URL, DEFAULT_FORM_DATA, FORM_COPY, TOTAL_STEPS } from "./constants";
import {
  validateStep,
  isStepComplete,
  buildPayload,
  loadFromSession,
  saveToSession,
  clearSession,
} from "./helpers";

// ------------------------------------------------------------------ //
// Context shape                                                        //
// ------------------------------------------------------------------ //

interface AppearanceRequestContextValue {
  step: number;
  formData: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  submitting: boolean;
  submitted: boolean;
  submitError: string;
  isFirst: boolean;
  isLast: boolean;
  canAdvance: boolean;
  skipLogistics: boolean;
  effectiveStep: number;
  effectiveTotalSteps: number;
  copy: FormCopy;
  update: (field: keyof FormData, value: string) => void;
  goNext: () => void;
  goBack: () => void;
  goToStep: (realStep: number) => void;
  resetForm: () => void;
  handleSubmit: () => Promise<void>;
}

// ------------------------------------------------------------------ //
// Context + hook                                                       //
// ------------------------------------------------------------------ //

const AppearanceRequestContext = createContext<AppearanceRequestContextValue | null>(null);

export function useAppearanceRequest(): AppearanceRequestContextValue {
  const ctx = useContext(AppearanceRequestContext);
  if (!ctx) {
    throw new Error("useAppearanceRequest must be used within AppearanceRequestProvider");
  }
  return ctx;
}

// ------------------------------------------------------------------ //
// Provider                                                             //
// ------------------------------------------------------------------ //

export function AppearanceRequestProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const copy: FormCopy = FORM_COPY;

  const LOGISTICS_STEP = 3;

  // Restore from sessionStorage on mount
  useEffect(() => {
    const saved = loadFromSession(SESSION_KEY);
    if (saved) setFormData((prev) => ({ ...prev, ...saved }));
  }, []);

  // Persist to sessionStorage on every change
  useEffect(() => {
    saveToSession(SESSION_KEY, formData);
  }, [formData]);

  const update = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validate = (): boolean => {
    const errs = validateStep(step, formData, copy);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const skipLogistics = formData.needsLogistics === "no" && formData.requestEctoVehicle !== "yes";

  const skippedSteps = new Set<number>([...(skipLogistics ? [LOGISTICS_STEP] : [])]);

  const effectiveStep = Array.from({ length: step }, (_, i) => i).filter(
    (i) => !skippedSteps.has(i),
  ).length;
  const effectiveTotalSteps = TOTAL_STEPS - skippedSteps.size;

  const goNext = () => {
    if (validate()) {
      setStep((s) => {
        let next = s + 1;
        while (skippedSteps.has(next) && next < TOTAL_STEPS) next++;
        return next;
      });
    }
  };

  const goBack = () => {
    setStep((s) => {
      let prev = s - 1;
      while (skippedSteps.has(prev) && prev >= 0) prev--;
      return prev;
    });
  };

  const goToStep = (targetStep: number) => {
    if (targetStep < step) {
      setStep(targetStep);
    }
  };

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA);
    setErrors({});
    setStep(0);
    clearSession(SESSION_KEY);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(buildPayload(formData)),
      });

      if (res.ok) {
        setSubmitted(true);
        clearSession(SESSION_KEY);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(data.error ?? copy.errorSubmitFailed);
      }
    } catch {
      setSubmitError(copy.errorNetworkError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppearanceRequestContext.Provider
      value={{
        step,
        formData,
        errors,
        submitting,
        submitted,
        submitError,
        isFirst: step === 0,
        isLast: step === TOTAL_STEPS - 1,
        canAdvance: isStepComplete(step, formData),
        skipLogistics,
        effectiveStep,
        effectiveTotalSteps,
        copy,
        update,
        goNext,
        goBack,
        goToStep,
        resetForm,
        handleSubmit,
      }}
    >
      {children}
    </AppearanceRequestContext.Provider>
  );
}
