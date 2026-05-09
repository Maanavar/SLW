import { useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/currencyUtils';
import { getJobFinalBillValue, getJobPaidAmount } from '@/lib/jobUtils';
import type { Job } from '@/types';
import type { BandKey } from '@/components/charts/AgeingHeatmap';

const BAND_LABELS: Record<BandKey, string> = {
  current: '0–7 days',
  band1: '8–30 days',
  band2: '31–60 days',
  band3: '61–90 days',
  band4: '90+ days',
};

function daysOld(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function jobBand(days: number): BandKey {
  if (days <= 7) return 'current';
  if (days <= 30) return 'band1';
  if (days <= 60) return 'band2';
  if (days <= 90) return 'band3';
  return 'band4';
}

interface AgeingDrillDownModalProps {
  customerId: number;
  customerName: string;
  band: BandKey;
  jobs: Job[];
  onClose: () => void;
}

export function AgeingDrillDownModal({
  customerId,
  customerName,
  band,
  jobs,
  onClose,
}: AgeingDrillDownModalProps) {
  const drillJobs = useMemo(() => {
    return jobs
      .filter((j) => {
        if (j.customerId !== customerId) return false;
        const outstanding = getJobFinalBillValue(j) - getJobPaidAmount(j);
        if (outstanding <= 0) return false;
        return jobBand(daysOld(j.date)) === band;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [jobs, customerId, band]);

  const totalOutstanding = drillJobs.reduce(
    (sum, j) => sum + (getJobFinalBillValue(j) - getJobPaidAmount(j)),
    0
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${customerName} — ${BAND_LABELS[band]} outstanding`}
      size="lg"
    >
      {drillJobs.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>No outstanding jobs in this band.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunk)' }}>
                  {['Card ID', 'Date', 'Work Type', 'Bill', 'Paid', 'Outstanding', 'Age (days)'].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-faint)',
                          borderBottom: '1px solid var(--border)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {drillJobs.map((j) => {
                  const bill = getJobFinalBillValue(j);
                  const paid = getJobPaidAmount(j);
                  const outstanding = bill - paid;
                  const age = daysOld(j.date);
                  return (
                    <tr key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {j.jobCardId ?? '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{j.date}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{j.workTypeName}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatCurrency(bill)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--green)' }}>
                        {formatCurrency(paid)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--red)', fontWeight: 600 }}>
                        {formatCurrency(outstanding)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {age}d
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 600, fontSize: 13 }}>
                    Total Outstanding
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>
                    {formatCurrency(totalOutstanding)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
