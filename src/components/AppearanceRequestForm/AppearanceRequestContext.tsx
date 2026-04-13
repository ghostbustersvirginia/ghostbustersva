import { createContext, useContext, useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import type { FormCopy, FormData } from "./types";
import {
  SESSION_KEY,
  FORMSPREE_URL,
  DEFAULT_FORM_DATA,
  STEP_DEFINITIONS,
  buildDefaultEnabledSections,
} from "./constants";
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
  /** Optional-section toggle map: enabledSections[originalStepIndex][sectionId] */
  enabledSections: Record<number, Record<string, boolean>>;
  /** Original step indices (into STEP_COMPONENTS) for the currently active steps. */
  activeStepOriginalIndices: number[];
  update: (field: keyof FormData, value: string) => void;
  /** Toggle an optional section on/off. Required sections silently ignore calls. */
  toggleSection: (originalStepIndex: number, sectionId: string) => void;
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
  const [enabledSections, setEnabledSections] = useState<
    Record<number, Record<string, boolean>>
  >(buildDefaultEnabledSections);

  // Step 0 (Event Information) is always first; remaining steps are active when
  // they have a required section OR at least one enabled optional section.
  const activeStepOriginalIndices = useMemo(() => {
    const active = STEP_DEFINITIONS.filter((def) => {
      if (def.sections.some((s) => s.required)) return true;
      return def.sections.some((s) => enabledSections[def.originalIndex]?.[s.id] === true);
    }).map((d) => d.originalIndex);
    return [0, ...active];
  }, [enabledSections]);

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

  const toggleSection = (originalStepIndex: number, sectionId: string) => {
    const def = STEP_DEFINITIONS.find((d) => d.originalIndex === originalStepIndex);
    const sectionDef = def?.sections.find((s) => s.id === sectionId);
    if (!sectionDef || sectionDef.required) return;
    setEnabledSections((prev) => ({
      ...prev,
      [originalStepIndex]: {
        ...prev[originalStepIndex],
        [sectionId]: !prev[originalStepIndex]?.[sectionId],
      },
    }));
  };

  const validate = (): boolean => {
    const originalIndex = activeStepOriginalIndices[step];
    const stepSections = enabledSections[originalIndex] ?? {};
    const errs = validateStep(originalIndex, formData, copy, stepSections);
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
        isLast: step === activeStepOriginalIndices.length - 1,
        copy,
        enabledSections,
        activeStepOriginalIndices,
        update,
        toggleSection,
        goNext,
        goBack,
        handleSubmit,
      }}
    >
      {children}
    </AppearanceRequestContext.Provider>
  );
}
