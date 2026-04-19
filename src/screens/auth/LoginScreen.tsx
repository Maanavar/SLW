import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { Icon } from '@/components/ui/Icon';
import './LoginScreen.css';

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('SLW Admin');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const redirectPath = useMemo(() => {
    const from = (location.state as { from?: unknown } | null)?.from;
    return typeof from === 'string' && from.trim() ? from : '/';
  }, [location.state]);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      if (!apiClient.hasAuthToken()) {
        return;
      }
      try {
        await apiClient.getAuthSession();
        if (active) {
          navigate(redirectPath, { replace: true });
        }
      } catch {
        apiClient.clearAuthToken();
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [navigate, redirectPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiClient.login({
        name: name.trim() || undefined,
        password: password.trim(),
      });
      navigate(redirectPath, { replace: true });
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Login failed';
      const normalized = message.toLowerCase();
      const isNetworkError =
        normalized.includes('failed to fetch') ||
        normalized.includes('network') ||
        normalized.includes('timeout') ||
        normalized.includes('unable to connect');

      if (isNetworkError) {
        apiClient.createOfflineSession(name.trim() || 'Offline Admin');
        navigate(redirectPath, { replace: true });
        return;
      }

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueOffline = () => {
    apiClient.createOfflineSession(name.trim() || 'Offline Admin');
    navigate(redirectPath, { replace: true });
  };

  return (
    <main className="login-page">
      <section className="login-left-panel">
        <div className="login-left-top">
          <div className="login-brand-mark">S</div>
          <div>
            <h1 className="login-brand-title">Siva Lathe Works</h1>
            <p className="login-brand-sub tamil">சிவா லேத் வொர்க்ஸ்</p>
          </div>
        </div>

        <div className="login-hero">
          <h2>Workshop operations, in one place.</h2>
          <p>
            Manage jobs, payments, commissions, expenses, and customer balances in one focused,
            bilingual workspace.
          </p>
        </div>

        <p className="login-meta numeric">v1.0 � Apr 2026 � Works offline � INR ?</p>
      </section>

      <section className="login-right-panel" aria-label="Login form">
        <div className="login-card">
          <h2 className="login-title">Sign in</h2>
          <p className="login-subtitle">Enter your credentials</p>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-label" htmlFor="login-name">
              Display name
            </label>
            <input
              id="login-name"
              className="login-input"
              type="text"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />

            <label className="login-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn btn-accent login-submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="login-divider">or</div>

            <button
              type="button"
              className="btn btn-secondary login-offline"
              onClick={handleContinueOffline}
              disabled={submitting}
            >
              <Icon name="offline" width={14} height={14} />
              Continue offline
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
