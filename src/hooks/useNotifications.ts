import { useCallback, useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { getLocalDateString } from '@/lib/dateUtils';
import { computeNotifications } from '@/lib/notificationUtils';

const DISMISSED_KEY = 'slw_notif_dismissed_v1';

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

export function useNotifications() {
  const { customers, jobs, payments, expenses, commissionWorkers, commissionPayments } = useDataStore();

  // Today is stable for the lifetime of this hook instance (same day)
  const today = useMemo(() => getLocalDateString(new Date()), []);

  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);

  const all = useMemo(
    () => computeNotifications({ customers, jobs, payments, expenses, commissionWorkers, commissionPayments }, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, jobs, payments, expenses, commissionWorkers, commissionPayments, today]
  );

  // Active = not dismissed. Non-dismissible notifications always show until the condition resolves.
  const notifications = useMemo(
    () => all.filter((n) => !n.dismissible || !dismissed.includes(n.id)),
    [all, dismissed]
  );

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      saveDismissed(next);
      return next;
    });
  }, []);

  return {
    notifications,
    count: notifications.length,
    dismiss,
  };
}
