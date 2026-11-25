import { useState } from "react";
import { ApiRequestError, requestAccess } from "./api";

interface Props {
  email: string;
  /** Whether this email is already on the membership sheet (PRD 013, R4.4). */
  request: "none" | "pending";
  /** Signs out (clearing the applicant cookie) and returns to sign-in. */
  onSwitchAccount: () => void;
}

type Stage =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "pending" }
  | { kind: "member" }
  | { kind: "expired"; message: string }
  | { kind: "error"; message: string };

/**
 * Signed in, but not on the member list (PRD 008, R1.4). Most members use
 * personal Gmail, so a wrong-account sign-in comes first. New people can ask
 * the officers to add them (PRD 013, R4).
 */
export default function NotMemberPanel({ email, request, onSwitchAccount }: Props) {
  const [stage, setStage] = useState<Stage>(
    request === "pending" ? { kind: "pending" } : { kind: "idle" },
  );

  async function ask() {
    setStage({ kind: "sending" });
    try {
      const { status } = await requestAccess();
      setStage({ kind: status === "added" ? "sent" : status });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Your request couldn't be sent.";
      setStage(
        e instanceof ApiRequestError && e.status === 401
          ? { kind: "expired", message }
          : { kind: "error", message },
      );
    }
  }

  const canAsk = stage.kind === "idle" || stage.kind === "sending" || stage.kind === "error";
  const signInAgain = stage.kind === "member" || stage.kind === "expired";

  return (
    <div className="mc-panel mc-notmember">
      <h2 className="mc-panel__title">We couldn't find you on the member list</h2>
      <p className="mc-panel__text">
        You're signed in as <strong>{email}</strong>. That address isn't on the GBVA member list. If
        you have another Google account, it may be the one we have on file.
      </p>

      <div role="status">
        {stage.kind === "sent" && (
          <p className="mc-alert mc-alert--ok">
            Request sent. An officer will add you to the member list, then you can sign in again.
          </p>
        )}
        {stage.kind === "pending" && (
          <p className="mc-alert mc-alert--info">
            Your request is waiting for approval. An officer will add you to the member list, then
            you can sign in again.
          </p>
        )}
        {stage.kind === "member" && (
          <p className="mc-alert mc-alert--ok">
            You're on the member list now. Sign in again to open the calendar.
          </p>
        )}
      </div>
      {(stage.kind === "error" || stage.kind === "expired") && (
        <p className="mc-alert mc-alert--error" role="alert">
          {stage.message}
        </p>
      )}

      <div className="mc-panel__actions">
        <button type="button" className="mc-btn mc-btn--primary" onClick={onSwitchAccount}>
          {signInAgain ? "Sign in again" : "Use a different Google account"}
        </button>
        {canAsk && (
          <button
            type="button"
            className="mc-btn mc-btn--ghost"
            onClick={ask}
            disabled={stage.kind === "sending"}
          >
            {stage.kind === "sending" ? "Requesting…" : "Request access"}
          </button>
        )}
      </div>
      {canAsk && <p className="mc-panel__fine">New to GBVA? Ask the officers to add you.</p>}
    </div>
  );
}
