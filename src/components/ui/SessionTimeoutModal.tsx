interface Props {
  secondsLeft: number;
  onStayActive: () => void;
  onLogout: () => void;
}

export function SessionTimeoutModal({ secondsLeft, onStayActive, onLogout }: Props) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const countdown = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;

  return (
    <div className="session-timeout-backdrop">
      <div className="session-timeout-modal">
        <h2 className="session-timeout-title">Session expiring</h2>
        <p className="session-timeout-body">
          You have been inactive. You will be signed out in{' '}
          <strong className="session-timeout-countdown">{countdown}</strong>.
        </p>
        <div className="session-timeout-actions">
          <button type="button" className="btn-primary" onClick={onStayActive}>
            Stay signed in
          </button>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
