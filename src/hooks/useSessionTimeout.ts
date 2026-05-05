import { useEffect, useRef, useState, useCallback } from 'react';

const IDLE_WARN_MS = 25 * 60 * 1000;  // 25 minutes
const IDLE_LOGOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

export function useSessionTimeout(onLogout: () => void) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300); // 5 min countdown
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  };

  const startCountdown = useCallback(() => {
    setShowWarning(true);
    setSecondsLeft(300);
    countdownInterval.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownInterval.current) clearInterval(countdownInterval.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    setShowWarning(false);

    warnTimer.current = setTimeout(() => {
      startCountdown();
      logoutTimer.current = setTimeout(() => {
        onLogout();
      }, IDLE_LOGOUT_MS - IDLE_WARN_MS);
    }, IDLE_WARN_MS);
  }, [onLogout, startCountdown]);

  const stayActive = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    resetTimers();

    const handleActivity = () => {
      if (!showWarning) resetTimers();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [resetTimers, showWarning]);

  return { showWarning, secondsLeft, stayActive };
}
