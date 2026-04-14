import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/currencyUtils';
import {
  getJobCardPaymentSummary,
  getJobNetValue,
  getJobPaymentMode,
  isDcApplicableCustomer,
} from '@/lib/jobUtils';
import type { Customer, Job } from '@/types';
import './JobCardDetailsModal.css';

interface JobCardDetailsModalProps {
  isOpen: boolean;
  jobs: Job[] | null;
  onClose: () => void;
  getCustomer: (id: number) => Customer | undefined;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function JobCardDetailsModal({
  isOpen,
  jobs,
  onClose,
  getCustomer,
  onDelete,
  onEdit,
}: JobCardDetailsModalProps) {
  const sortedJobs =
    jobs?.length
      ? [...jobs].sort((a, b) => (a.jobCardLine || a.id) - (b.jobCardLine || b.id))
      : [];
  const primary = sortedJobs.length > 0 ? sortedJobs[0] : null;
  const customer = primary ? getCustomer(primary.customerId) : undefined;
  const shouldShowDc = isDcApplicableCustomer(customer);
  const payment = getJobCardPaymentSummary(sortedJobs);
  const totalAmount = sortedJobs.reduce((sum, job) => sum + (Number(job.amount) || 0), 0);
  const totalCommission = sortedJobs.reduce(
    (sum, job) => sum + (Number(job.commissionAmount) || 0),
    0
  );
  const paymentModes = [
    ...new Set(
      sortedJobs
        .map((job) => getJobPaymentMode(job))
        .filter((mode) => Boolean(mode) && mode !== '-')
    ),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={primary ? `JobCard ${primary.jobCardId || `LEGACY-${primary.id}`}` : ''}
      size="lg"
    >
      {primary ? (
        <div className="job-card-detail">
          <div className="job-card-detail-meta">
            <div>
              <span className="job-card-detail-label">Customer</span>
              <strong>{customer?.name || 'Unknown'}</strong>
            </div>
            <div>
              <span className="job-card-detail-label">Date</span>
              <strong>{primary.date}</strong>
            </div>
            <div>
              <span className="job-card-detail-label">Lines</span>
              <strong>{sortedJobs.length}</strong>
            </div>
            <div>
              <span className="job-card-detail-label">Payment Status</span>
              <StatusBadge status={payment.status} />
            </div>
            <div>
              <span className="job-card-detail-label">Paid</span>
              <strong>{formatCurrency(payment.paid)}</strong>
            </div>
            <div>
              <span className="job-card-detail-label">Pending</span>
              <strong>{formatCurrency(payment.pending)}</strong>
            </div>
            <div>
              <span className="job-card-detail-label">Payment Mode</span>
              <strong>{paymentModes.length > 0 ? paymentModes.join(', ') : '-'}</strong>
            </div>
          </div>

          {shouldShowDc ? (
            <div className="job-card-detail-meta">
              <div>
                <span className="job-card-detail-label">DC Number</span>
                <strong>{primary.dcNo || '-'}</strong>
              </div>
              <div>
                <span className="job-card-detail-label">Vehicle Number</span>
                <strong>{primary.vehicleNo || '-'}</strong>
              </div>
              <div>
                <span className="job-card-detail-label">DC Date</span>
                <strong>{primary.dcDate || '-'}</strong>
              </div>
              <div>
                <span className="job-card-detail-label">Approved Without DC</span>
                <strong>{primary.dcApproval ? 'Yes' : 'No'}</strong>
              </div>
            </div>
          ) : null}

          <div className="job-card-detail-table">
            <table>
              <thead>
                <tr>
                  <th>Work Type</th>
                  <th>Qty</th>
                  <th>Amount</th>
                  <th>Commission</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.workTypeName}</td>
                    <td>{job.quantity}</td>
                    <td>{formatCurrency(job.amount)}</td>
                    <td>{formatCurrency(job.commissionAmount || 0)}</td>
                    <td>{formatCurrency(getJobNetValue(job))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="job-card-detail-summary">
            <span>Total Amount: {formatCurrency(totalAmount)}</span>
            <span>Total Commission: {formatCurrency(totalCommission)}</span>
            <span>Net Total: {formatCurrency(payment.net)}</span>
            <span>Paid: {formatCurrency(payment.paid)}</span>
            <span>Pending: {formatCurrency(payment.pending)}</span>
          </div>

          {(onEdit || onDelete) && (
            <div className="job-card-detail-actions">
              {onEdit && (
                <button
                  type="button"
                  className="btn btn-secondary btn-edit"
                  onClick={onEdit}
                  title="Edit this job card"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="btn btn-danger btn-delete"
                  onClick={onDelete}
                  title="Delete this job card"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
