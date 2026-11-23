/**
 * Member calendar island (PRD 008).
 * Handles the signed-out / not-member / member states, and shows the
 * calendar once signed in as a member.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { FaRegEnvelope } from "react-icons/fa6";
import type { SessionState } from "../../lib/member-calendar/types";
import { ApiRequestError, getSession, signIn, signOut } from "./api";
import CalendarView from "./CalendarView";
import { forgetGoogleAccount } from "./google-identity";
import NotMemberPanel from "./NotMemberPanel";
import SignInPanel from "./SignInPanel";
import "./MemberCalendar.css";

export default function MemberCalendarApp() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useLayoutEffect(() => {
    const subtitle = document.querySelector(".page-intro");
    const pageBand = document.querySelector(".page-band");

    if (pageBand) {
      (pageBand as HTMLElement).style.paddingBlockEnd = "var(--space-md)";
    }
    if (subtitle) {
      (subtitle as HTMLElement).style.display = "none";
    }
  }, []);

  const clientId = session?.clientId ?? null;

  const handleCredential = useCallback(async (credential: string) => {
    setBusy(true);
    setSignInError(null);
    try {
      setSession(await signIn(credential));
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const toSignedOut = useCallback(() => {
    forgetGoogleAccount();
    setSession((s) => ({ state: "signed-out", clientId: s?.clientId ?? null }));
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } finally {
      toSignedOut();
    }
  }, [toSignedOut]);

  /** API calls that find the session expired drop back to sign-in. */
  const handleAuthError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        setSignInError(error.message);
        toSignedOut();
        return true;
      }
      return false;
    },
    [toSignedOut],
  );

  if (loadError) {
    return (
      <div className="mc-panel" role="alert">
        <p className="mc-alert mc-alert--error">{loadError}</p>
        <button type="button" className="mc-btn" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mc-panel" aria-busy="true">
        <p className="mc-panel__text">Loading…</p>
      </div>
    );
  }

  if (session.state === "signed-out") {
    return (
      <SignInPanel
        clientId={clientId}
        onCredential={handleCredential}
        busy={busy}
        error={signInError}
      />
    );
  }

  if (session.state === "not-member") {
    return <NotMemberPanel email={session.email} onSwitchAccount={toSignedOut} />;
  }

  return (
    <div className="mc-root">
      <div className="mc-userbar">
        <span>
          <strong>{session.user.name}</strong>{" "}
          <FaRegEnvelope size={"1em"} title={session.user.email} />
        </span>
        <span className="mc-userbar__actions">
          {session.user.isOrganizer && (
            <a className="mc-btn mc-btn--small" href="/api/calendar/late-changes.csv" download>
              Export Late Changes
            </a>
          )}
          <button
            type="button"
            className="mc-btn mc-btn--small mc-btn--ghost"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </span>
      </div>
      <CalendarView onAuthError={handleAuthError} />
    </div>
  );
}
