import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
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
    return typeof from === 'string' && from.trim() ? from : '/dashboard';
  }, [location.state]);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        await apiClient.getAuthSession();
        if (active) {
          navigate(redirectPath, { replace: true });
        }
      } catch {
        // Not authenticated yet.
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
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-left-panel">
        <div className="login-left-top">
          <div className="login-brand-mark">S</div>
          <div>
            <h1 className="login-brand-title">Siva Lathe Works</h1>
            <p className="login-brand-sub tamil">
              {
                '\u0b9a\u0bbf\u0bb5\u0bbe \u0bb2\u0bc7\u0ba4\u0bcd \u0bb5\u0bca\u0bb0\u0bcd\u0b95\u0bcd\u0bb8\u0bcd'
              }
            </p>
          </div>
        </div>

        <div className="login-hero">
          <h2>Workshop operations, in one place.</h2>
          <p>
            Manage jobs, payments, commissions, expenses, and customer balances in one focused,
            bilingual workspace.
          </p>
        </div>

        <p className="login-meta numeric">
          {'v1.0 \u00b7 May 2026 \u00b7 Secure session \u00b7 INR \u20b9'}
        </p>
      </section>

      <section className="login-right-panel" aria-label="Login form">
        <div className="login-card">
          <h2 className="login-title">Sign in</h2>
          <p className="login-subtitle">Enter your credentials</p>

          <form
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="login-form"
          >
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
          </form>
        </div>
      </section>
    </main>
  );
}
