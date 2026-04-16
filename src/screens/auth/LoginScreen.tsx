import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
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
      <section className="login-card" aria-label="Login form">
        <h1 className="login-title">Siva Lathe Works</h1>
        <p className="login-subtitle">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label" htmlFor="login-name">
            Display Name
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

          <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
          <button
            type="button"
            className="btn btn-secondary login-offline"
            onClick={handleContinueOffline}
            disabled={submitting}
          >
            Continue Offline
          </button>
        </form>
      </section>
    </main>
  );
}
