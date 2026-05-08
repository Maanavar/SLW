import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FollowUpCustomerRow, FollowUpOverview } from '@/types';
import { apiClient } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/currencyUtils';
import { useToast } from '@/hooks/useToast';
import { useUIStore } from '@/stores/uiStore';
import './FollowUpsScreen.css';

type AgeingFilter = 'all' | FollowUpCustomerRow['ageingBucket'];

interface DraftFollowUp {
  nextFollowUpDate: string;
  notes: string;
}

function getDraftForRow(
  row: FollowUpCustomerRow,
  existingDraft: DraftFollowUp | undefined
): DraftFollowUp {
  if (existingDraft) {
    return existingDraft;
  }
  return {
    nextFollowUpDate: row.nextFollowUpDate ?? '',
    notes: row.followUpNotes ?? '',
  };
}

export function FollowUpsScreen() {
  const toast = useToast();
  const addToast = useUIStore((state) => state.addToast);
  const [loading, setLoading] = useState(true);
  const [savingCustomerId, setSavingCustomerId] = useState<number | null>(null);
  const [overview, setOverview] = useState<FollowUpOverview | null>(null);
  const [search, setSearch] = useState('');
  const [ageingFilter, setAgeingFilter] = useState<AgeingFilter>('all');
  const [drafts, setDrafts] = useState<Record<number, DraftFollowUp>>({});

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getFollowUpOverview();
      setOverview(data);
      setDrafts((prev) => {
        const next: Record<number, DraftFollowUp> = { ...prev };
        data.rows.forEach((row) => {
          next[row.customerId] = getDraftForRow(row, prev[row.customerId]);
        });
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load follow-up overview';
      addToast('Error', message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const filteredRows = useMemo(() => {
    if (!overview) {
      return [];
    }
    const needle = search.trim().toLowerCase();
    return overview.rows.filter((row) => {
      if (ageingFilter !== 'all' && row.ageingBucket !== ageingFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        row.customerName.toLowerCase().includes(needle) ||
        row.shortCode.toLowerCase().includes(needle) ||
        row.customerType.toLowerCase().includes(needle)
      );
    });
  }, [overview, search, ageingFilter]);

  const totalOutstanding = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.outstanding, 0),
    [filteredRows]
  );

  const handleDraftChange = (customerId: number, changes: Partial<DraftFollowUp>) => {
    setDrafts((prev) => ({
      ...prev,
      [customerId]: {
        nextFollowUpDate: prev[customerId]?.nextFollowUpDate ?? '',
        notes: prev[customerId]?.notes ?? '',
        ...changes,
      },
    }));
  };

  const handleSaveFollowUp = async (row: FollowUpCustomerRow) => {
    const draft = drafts[row.customerId];
    const nextDate = draft?.nextFollowUpDate?.trim() ?? '';
    const notes = draft?.notes ?? '';
    if (!nextDate) {
      toast.error('Date Required', 'Set a follow-up date before saving');
      return;
    }

    setSavingCustomerId(row.customerId);
    try {
      await apiClient.upsertCustomerFollowUp(row.customerId, {
        nextFollowUpDate: nextDate,
        notes: notes.trim() ? notes.trim() : null,
      });
      toast.success('Saved', `Follow-up saved for ${row.customerName}`);
      await loadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save follow-up';
      toast.error('Error', message);
    } finally {
      setSavingCustomerId(null);
    }
  };

  const handleClearFollowUp = async (row: FollowUpCustomerRow) => {
    setSavingCustomerId(row.customerId);
    try {
      await apiClient.clearCustomerFollowUp(row.customerId);
      toast.success('Cleared', `Follow-up cleared for ${row.customerName}`);
      setDrafts((prev) => ({
        ...prev,
        [row.customerId]: { nextFollowUpDate: '', notes: '' },
      }));
      await loadOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear follow-up';
      toast.error('Error', message);
    } finally {
      setSavingCustomerId(null);
    }
  };

  return (
    <div className="fup-screen">
      <header className="fup-header">
        <div>
          <h1 className="fup-title">Outstanding Follow-up Center</h1>
          <p className="fup-subtitle">
            {overview
              ? `${overview.rows.length} customers with outstanding balances`
              : 'Loading...'}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void loadOverview()}>
          Refresh
        </button>
      </header>

      <section className="fup-summary">
        {(overview?.ageingSummary ?? []).map((bucket) => (
          <article className="fup-summary-card" key={bucket.bucket}>
            <p className="fup-summary-label">{bucket.bucket}</p>
            <p className="fup-summary-value">{bucket.customerCount}</p>
            <p className="fup-summary-amount">{formatCurrency(bucket.outstandingAmount)}</p>
          </article>
        ))}
        <article className="fup-summary-card fup-summary-card--strong">
          <p className="fup-summary-label">Filtered Total</p>
          <p className="fup-summary-value">{filteredRows.length}</p>
          <p className="fup-summary-amount">{formatCurrency(totalOutstanding)}</p>
        </article>
      </section>

      <section className="fup-call-list">
        <h2>Daily Collection Call List</h2>
        <p className="fup-call-note">
          Due or overdue follow-ups as of {overview?.asOfDate ?? '--'}.
        </p>
        {overview && overview.callList.length > 0 ? (
          <div className="fup-call-chips">
            {overview.callList.map((row) => (
              <div className="fup-call-chip" key={row.customerId}>
                <p className="fup-call-name">
                  {row.customerName}
                  <span className="fup-call-code">{row.shortCode || '-'}</span>
                </p>
                <p className="fup-call-meta">
                  Follow-up: {row.nextFollowUpDate ?? '--'} | Outstanding:{' '}
                  {formatCurrency(row.outstanding)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="fup-empty">No due follow-up calls for today.</p>
        )}
      </section>

      <section className="fup-controls">
        <input
          type="text"
          className="fup-search search-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customer..."
        />
        <select
          className="fup-filter form-select"
          value={ageingFilter}
          onChange={(event) => setAgeingFilter(event.target.value as AgeingFilter)}
        >
          <option value="all">All ageing buckets</option>
          <option value="Current">Current (0-7)</option>
          <option value="8-30">8-30 days</option>
          <option value="31-60">31-60 days</option>
          <option value="61-90">61-90 days</option>
          <option value="90+">90+ days</option>
        </select>
      </section>

      <section className="fup-table-wrap">
        {loading ? (
          <p className="fup-empty">Loading follow-up rows...</p>
        ) : filteredRows.length === 0 ? (
          <p className="fup-empty">No follow-up rows for this filter.</p>
        ) : (
          <table className="fup-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="numeric">Outstanding</th>
                <th className="numeric">Oldest Due</th>
                <th>Bucket</th>
                <th>Next Follow-up</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const draft = getDraftForRow(row, drafts[row.customerId]);
                const rowSaving = savingCustomerId === row.customerId;
                return (
                  <tr key={row.customerId}>
                    <td>
                      <p className="fup-customer-name">{row.customerName}</p>
                      <p className="fup-customer-meta">
                        {row.shortCode || '-'} | {row.customerType}
                      </p>
                    </td>
                    <td className="numeric">{formatCurrency(row.outstanding)}</td>
                    <td className="numeric">{row.oldestOutstandingDays} d</td>
                    <td>{row.ageingBucket}</td>
                    <td>
                      <input
                        type="date"
                        value={draft.nextFollowUpDate}
                        onChange={(event) =>
                          handleDraftChange(row.customerId, {
                            nextFollowUpDate: event.target.value,
                          })
                        }
                        className="fup-date-input form-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={draft.notes}
                        onChange={(event) =>
                          handleDraftChange(row.customerId, { notes: event.target.value })
                        }
                        placeholder="Optional note"
                        className="fup-note-input form-input"
                      />
                    </td>
                    <td>
                      <div className="fup-row-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={rowSaving}
                          onClick={() => void handleSaveFollowUp(row)}
                        >
                          {rowSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={rowSaving}
                          onClick={() => void handleClearFollowUp(row)}
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
