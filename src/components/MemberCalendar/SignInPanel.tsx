import { useEffect, useRef, useState } from "react";
import { loadGoogleIdentity } from "./google-identity";

interface Props {
  clientId: string | null;
  onCredential: (credential: string) => void;
  busy: boolean;
  error: string | null;
}

/** Signed-out state: explanation + "Sign in with Google" (PRD 008, R1.1). */
export default function SignInPanel({ clientId, onCredential, busy, error }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    let cancelled = false;
    loadGoogleIdentity()
      .then((gis) => {
        if (cancelled || !buttonRef.current) return;
        gis.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current(response.credential),
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_button: true,
          context: "signin",
          ux_mode: "popup",
        });
        buttonRef.current.replaceChildren();
        gis.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          logo_alignment: "left",
        });
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div className="mc-panel mc-signin">
      <h2 className="mc-panel__title">Members only</h2>
      <p className="mc-panel__text">
        The member calendar shows every GBVA event and lets you RSVP. Sign in with the Google
        account that's on the GBVA member list.
      </p>
      {clientId ? (
        <div ref={buttonRef} className="mc-signin__button" aria-busy={busy} />
      ) : (
        <p className="mc-alert mc-alert--error" role="alert">
          Member sign-in isn't set up yet on this site.
        </p>
      )}
      {busy && <p className="mc-panel__text">Checking your membership…</p>}
      {(error || loadError) && (
        <p className="mc-alert mc-alert--error" role="alert">
          {error ?? loadError}
        </p>
      )}
      <p className="mc-panel__fine">
        We only receive your name and email from Google. See our{" "}
        <a href="/members/privacy">privacy policy</a>.
      </p>
    </div>
  );
}
