import { Modal } from '@/components/ui/Modal';
import { Badge, StatusBadge, TypeBadge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/currencyUtils';
import {
  getJobCardPaymentSummary,
  getJobNetValue,
  getJobPaymentMode,
  isDcApplicableCustomer,
} from '@/lib/jobUtils';
import { useDataStore } from '@/stores/dataStore';
import type { Customer, Job } from '@/types';
import './JobCardDetailsModal.css';

interface JobCardDetailsModalProps {
  isOpen: boolean;
  jobs: Job[] | null;
  onClose: () => void;
  getCustomer: (id: number) => Customer | undefined;
  onDelete?: (card?: any) => void;
  onEdit?: (card?: any) => void;
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function JobCardDetailsModal({
  isOpen,
  jobs,
  onClose,
  getCustomer,
  onDelete,
  onEdit,
}: JobCardDetailsModalProps) {
  const { workTypes } = useDataStore();

  const sortedJobs =
    jobs?.length
      ? [...jobs].sort((a, b) => (a.jobCardLine || a.id) - (b.jobCardLine || b.id))
      : [];
  const primary    = sortedJobs.length > 0 ? sortedJobs[0] : null;
  const customer   = primary ? getCustomer(primary.customerId) : undefined;
  const hasDcValues = Boolean(
    primary && (primary.dcNo || primary.vehicleNo || primary.dcDate || primary.dcApproval)
  );
  const shouldShowDc = isDcApplicableCustomer(customer) || hasDcValues;
  const payment = getJobCardPaymentSummary(sortedJobs);
  const totalAmount     = sortedJobs.reduce((s, j) => s + (Number(j.amount) || 0), 0);
  const totalCommission = sortedJobs.reduce((s, j) => s + (Number(j.commissionAmount) || 0), 0);
  const paymentModes = [
    ...new Set(
      sortedJobs.map(j => getJobPaymentMode(j)).filter(m => Boolean(m) && m !== '-')
    ),
  ];

  const cardId = primary ? (primary.jobCardId || `LEGACY-${primary.id}`) : '';
  const subtitle = primary ? `${fmtDate(primary.date)} · ${customer?.name || 'Unknown'}` : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={primary ? `Job card ${cardId}` : ''}
      subtitle={subtitle}
      size="lg"
    >
      {primary ? (
        <div className="jcd">

          {/* ── Badges row ── */}
          <div className="jcd-badges">
            <StatusBadge status={payment.status} />
            {customer?.type && <TypeBadge type={customer.type} />}
            {shouldShowDc && !primary.dcApproval && <Badge label="DC" variant="primary" />}
            {primary.workMode === 'Spot' && <Badge label="Spot" variant="info" />}
          </div>

          {/* ── Work lines table ── */}
          <div className="jcd-table-wrap">
            <table className="jcd-table">
              <thead>
                <tr>
                  <th>Work Type</th>
                  <th className="jcd-th-r">QTY</th>
                  <th className="jcd-th-r">Amount</th>
                  <th className="jcd-th-r">Commission</th>
                  <th className="jcd-th-r">Worker</th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map(job => {
                  const wt = workTypes.find(w => w.name === job.workTypeName);
                  return (
                    <tr key={job.id}>
                      <td>
                        <div className="jcd-work-name">{job.workTypeName}</div>
                        {wt?.category && <div className="jcd-work-cat">{wt.category}</div>}
                      </td>
                      <td className="jcd-td-r jcd-mono">{job.quantity}</td>
                      <td className="jcd-td-r jcd-mono">{formatCurrency(job.amount)}</td>
                      <td className="jcd-td-r jcd-mono">
                        {(job.commissionAmount || 0) > 0 ? formatCurrency(job.commissionAmount) : <span className="jcd-dash">—</span>}
                      </td>
                      <td className="jcd-td-r jcd-mono">
                        {job.commissionWorkerName || <span className="jcd-dash">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="jcd-total-row">
                  <td><span className="jcd-total-label">Final bill</span></td>
                  <td />
                  <td className="jcd-td-r jcd-mono jcd-total-val">{formatCurrency(totalAmount)}</td>
                  <td className="jcd-td-r jcd-mono jcd-total-val">{formatCurrency(totalCommission)}</td>
                  <td className="jcd-td-r jcd-mono jcd-total-val">{formatCurrency(payment.finalBill)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Payment boxes ── */}
          <div className="jcd-pay-row">
            <div className="jcd-pay-box">
              <div className="jcd-pay-label">Paid</div>
              <div className="jcd-pay-amount jcd-pay-amount--paid">{formatCurrency(payment.paid)}</div>
              {paymentModes.length > 0 && (
                <div className="jcd-pay-mode">Mode: {paymentModes.join(', ')}</div>
              )}
            </div>
            <div className="jcd-pay-box">
              <div className="jcd-pay-label">Pending</div>
              <div className="jcd-pay-amount jcd-pay-amount--pending">{formatCurrency(payment.pending)}</div>
            </div>
          </div>

          {/* ── DC box ── */}
          {shouldShowDc && (
            <div className="jcd-dc-box">
              <div className="jcd-dc-title">Delivery challan</div>
              <div className="jcd-dc-row">
                {primary.dcNo     && <span>No: <strong>{primary.dcNo}</strong></span>}
                {primary.dcDate   && <span>Date: <strong>{fmtDate(primary.dcDate)}</strong></span>}
                {primary.vehicleNo && <span>Vehicle: <strong>{primary.vehicleNo}</strong></span>}
                {primary.dcApproval && <span className="jcd-dc-exempt">DC-Exempt</span>}
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          {primary.notes && (
            <div className="jcd-notes">
              <div className="jcd-notes-label">Notes</div>
              <p>{primary.notes}</p>
            </div>
          )}

          {/* ── Footer actions ── */}
          {(onEdit || onDelete) && (
            <div className="jcd-footer">
              <div className="jcd-footer-left">
                {onDelete && (
                  <button type="button" className="jcd-btn-delete"
                    onClick={() => onDelete({ jobs, primary })} title="Delete job card">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                    Delete
                  </button>
                )}
              </div>
              <div className="jcd-footer-right">
                <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
                {onEdit && (
                  <button type="button" className="jcd-btn-edit"
                    onClick={() => onEdit({ jobs, primary })} title="Edit job card">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      ) : null}
    </Modal>
  );
}
