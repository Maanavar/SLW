import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { detectAnomalies } from '@/lib/anomalyUtils';
import './AnomalyAlerts.css';

const STORAGE_KEY = 'slw.dashboard.dismissedAnomalies';

function loadDismissedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveDismissedIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors for non-critical UI persistence.
  }
}

export function AnomalyAlerts() {
  const { jobs, payments } = useDataStore();
  const { data: customers = [] } = useCustomersQuery();
  const [expanded, setExpanded] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => loadDismissedIds());

  const anomalies = useMemo(() => detectAnomalies(jobs, payments, customers), [jobs, payments, customers]);
  const visibleAnomalies = anomalies.filter((anomaly) => !dismissedIds.includes(anomaly.id));
  const allDismissed = anomalies.length > 0 && visibleAnomalies.length === 0;
  const hasAlerts = visibleAnomalies.length > 0;

  return (
    <section className="anomaly-alerts">
      <button
        type="button"
        className="anomaly-alerts-head"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="anomaly-alerts-head-left">
          <span className="anomaly-bell" aria-hidden="true">
            {hasAlerts ? '!' : 'i'}
          </span>
          <span className="anomaly-alerts-title">
            {hasAlerts
              ? `${visibleAnomalies.length} ${visibleAnomalies.length === 1 ? 'anomaly' : 'anomalies'} detected`
              : allDismissed
                ? 'All anomalies dismissed'
                : 'No anomalies detected'}
          </span>
        </span>
        <span className="anomaly-chevron" aria-hidden="true">
          {expanded ? '⌃' : '⌄'}
        </span>
      </button>

      {expanded ? (
        <div className="anomaly-alerts-list">
          {hasAlerts ? (
            visibleAnomalies.map((anomaly) => (
              <article
                key={anomaly.id}
                className={`anomaly-alert-item ${
                  anomaly.severity === 'warning' ? 'severity-warning' : 'severity-info'
                }`}
              >
                <span className="anomaly-alert-dot" aria-hidden="true" />
                <p className="anomaly-alert-message">{anomaly.message}</p>
                <button
                  type="button"
                  className="anomaly-dismiss-btn"
                  onClick={() => {
                    const next = [...dismissedIds, anomaly.id];
                    setDismissedIds(next);
                    saveDismissedIds(next);
                  }}
                >
                  Dismiss
                </button>
              </article>
            ))
          ) : (
            <div className="anomaly-alert-empty">
              <p className="anomaly-alert-empty-text">
                {allDismissed
                  ? 'You dismissed all current alerts. Reset to show them again.'
                  : 'No unusual activity found right now.'}
              </p>
              {allDismissed ? (
                <button
                  type="button"
                  className="anomaly-dismiss-btn"
                  onClick={() => {
                    setDismissedIds([]);
                    saveDismissedIds([]);
                  }}
                >
                  Reset dismissed
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
