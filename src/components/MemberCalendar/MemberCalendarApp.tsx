/**
 * Member calendar island (PRD 008).
 * Handles the signed-out / not-member / member states, and shows the
 * calendar once signed in as a member.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type {
  DiscordLinkState,
  DiscordLinkStatus,
  SessionState,
} from "../../lib/member-calendar/types";
import { ApiRequestError, getSession, signIn, signOut } from "./api";
import CalendarView from "./CalendarView";
import { DISCORD_STATUS_MESSAGES, takeDiscordStatus } from "./discord-status";
import { forgetGoogleAccount } from "./google-identity";
import NotMemberPanel from "./NotMemberPanel";
import SignInPanel from "./SignInPanel";
import UserMenu from "./UserMenu";
import "./MemberCalendar.css";

/** Slot in the page header (calendar.astro) that the user menu is rendered into. */
const USER_MENU_SLOT_ID = "member-calendar-user-menu";

export default function MemberCalendarApp() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discordStatus, setDiscordStatus] = useState<DiscordLinkStatus | null>(null);
  const [discordError, setDiscordError] = useState<string | null>(null);
  // client:only island, so the header slot already exists in the document.
  const [userMenuSlot] = useState(() => document.getElementById(USER_MENU_SLOT_ID));

  useEffect(() => {
    setDiscordStatus(takeDiscordStatus());
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

  const handleDiscordChange = useCallback(
    (discord: DiscordLinkState, status?: DiscordLinkStatus) => {
      setDiscordStatus(status ?? null);
      setDiscordError(null);
      setSession((s) => (s?.state === "member" ? { ...s, discord } : s));
    },
    [],
  );

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

  const userMenu = (
    <UserMenu
      name={session.user.name}
      isOrganizer={session.user.isOrganizer}
      discord={session.discord}
      onDiscordChange={handleDiscordChange}
      onDiscordError={setDiscordError}
      onSignOut={handleSignOut}
    />
  );

  return (
    <div className="mc-root">
      {discordError ? (
        <p className="mc-alert mc-alert--error" role="alert">
          {discordError}
        </p>
      ) : (
        discordStatus &&
        session.discord.enabled && (
          <p
            className={`mc-alert mc-alert--${DISCORD_STATUS_MESSAGES[discordStatus].tone}`}
            role="status"
          >
            {DISCORD_STATUS_MESSAGES[discordStatus].text}
          </p>
        )
      )}
      {/* In the page header next to the title; in the toolbar if the slot is missing. */}
      {userMenuSlot && createPortal(userMenu, userMenuSlot)}
      <CalendarView
        onAuthError={handleAuthError}
        toolbarEnd={userMenuSlot ? undefined : userMenu}
      />
    </div>
  );
}
