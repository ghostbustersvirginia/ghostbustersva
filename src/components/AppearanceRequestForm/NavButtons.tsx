import { useAppearanceRequest } from "./AppearanceRequestContext";

export default function NavButtons() {
  const { isFirst, isLast, submitting, goBack, goNext, handleSubmit, copy } = useAppearanceRequest();

  return (
    <div className={["arf__nav", isFirst ? "arf__nav--end" : ""].filter(Boolean).join(" ")}>
      {!isFirst && (
        <button type="button" className="btn btn--secondary" onClick={goBack}>
          {copy.navBack}
        </button>
      )}
      {isLast ? (
        <button
          type="button"
          className="btn btn--primary"
          disabled={submitting}
          aria-busy={submitting}
          onClick={handleSubmit}
        >
          {submitting ? copy.navSubmitting : copy.navSubmit}
        </button>
      ) : (
        <button type="button" className="btn btn--primary" onClick={goNext}>
          {copy.navNext}
        </button>
      )}
    </div>
  );
}
