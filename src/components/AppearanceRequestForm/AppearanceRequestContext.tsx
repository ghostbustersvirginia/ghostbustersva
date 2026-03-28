import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { FormCopy, FormData } from "./types";
import { SESSION_KEY, FORMSPREE_URL, TOTAL_STEPS, DEFAULT_FORM_DATA } from "./constants";
import { validateStep, buildPayload, loadFromSession, saveToSession, clearSession } from "./helpers";

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
  copy: FormCopy;
  update: (field: keyof FormData, value: string) => void;
  goNext: () => void;
  goBack: () => void;
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

export function AppearanceRequestProvider({
  children,
  copy,
}: {
  children: ReactNode;
  copy: FormCopy;
}) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

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
        copy,
        update,
        goNext,
        goBack,
        handleSubmit,
      }}
    >
      {children}
    </AppearanceRequestContext.Provider>
  );
}


