import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';

type AuthCheckState = 'checking' | 'authenticated' | 'unauthenticated';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [authState, setAuthState] = useState<AuthCheckState>('checking');

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      if (!active) {
        return;
      }

      setAuthState('checking');
      if (!apiClient.hasAuthToken()) {
        if (active) {
          setAuthState('unauthenticated');
        }
        return;
      }

      try {
        await apiClient.getAuthSession();
        if (active) {
          setAuthState('authenticated');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        const isNetworkError =
          message.includes('failed to fetch') ||
          message.includes('network') ||
          message.includes('timeout') ||
          message.includes('unable to connect');

        if (isNetworkError) {
          apiClient.createOfflineSession('Offline Admin');
          if (active) {
            setAuthState('authenticated');
          }
          return;
        }

        apiClient.clearAuthToken();
        if (active) {
          setAuthState('unauthenticated');
        }
      }
    };

    void verifySession();

    const handleAuthChange = () => {
      void verifySession();
    };
    window.addEventListener('slw-auth-changed', handleAuthChange);

    return () => {
      active = false;
      window.removeEventListener('slw-auth-changed', handleAuthChange);
    };
  }, []);

  if (authState === 'checking') {
    return (
      <div className="auth-check-screen">
        <p>Checking session...</p>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
