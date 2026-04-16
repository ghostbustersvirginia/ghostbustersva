import { useState } from "react";
import { useAppearanceRequest } from "./AppearanceRequestContext";

function ResetModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { copy } = useAppearanceRequest();
  return (
    <div
      className="arf__modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arf-reset-heading"
    >
      <div className="arf__modal">
        <h3 id="arf-reset-heading" className="arf__modal-heading">
          {copy.navResetModalHeading}
        </h3>
        <p className="arf__modal-body">{copy.navResetModalBody}</p>
        <div className="arf__modal-actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            {copy.navResetModalCancel}
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>
            {copy.navResetModalConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NavButtons() {
  const { isFirst, isLast, submitting, canAdvance, goBack, goNext, resetForm, copy } =
    useAppearanceRequest();
  const [showResetModal, setShowResetModal] = useState(false);

  return (
    <>
      {showResetModal && (
        <ResetModal
          onConfirm={() => {
            setShowResetModal(false);
            resetForm();
          }}
          onCancel={() => setShowResetModal(false)}
        />
      )}
      <div className={["arf__nav", isFirst ? "arf__nav--end" : ""].filter(Boolean).join(" ")}>
        {!isFirst && (
          <button type="button" className="btn btn--secondary" onClick={goBack}>
            {copy.navBack}
          </button>
        )}
        <div className="arf__nav-right">
          {isLast && (
            <button
              type="button"
              className="btn btn--danger-outline"
              onClick={() => setShowResetModal(true)}
            >
              {copy.navReset}
            </button>
          )}
          {isLast ? (
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !canAdvance}
              aria-busy={submitting}
            >
              {submitting ? copy.navSubmitting : copy.navSubmit}
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={goNext}>
              {copy.navNext}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
