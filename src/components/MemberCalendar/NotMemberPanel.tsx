interface Props {
  email: string;
  onSwitchAccount: () => void;
}

/**
 * Signed in, but not on the member list (PRD 008, R1.4). Most members use
 * personal Gmail, so a wrong-account sign-in is expected, not an error.
 */
export default function NotMemberPanel({ email, onSwitchAccount }: Props) {
  return (
    <div className="mc-panel mc-notmember" role="status">
      <h2 className="mc-panel__title">We couldn't find you on the member list</h2>
      <p className="mc-panel__text">
        You're signed in as <strong>{email}</strong>. That address isn't on the GBVA member list. If
        you have another Google account, it may be the one we have on file.
      </p>
      <div className="mc-panel__actions">
        <button type="button" className="mc-btn mc-btn--primary" onClick={onSwitchAccount}>
          Use a different Google account
        </button>
        <a className="mc-btn mc-btn--ghost" href="/contact">
          Think this is wrong? Contact us
        </a>
      </div>
    </div>
  );
}
