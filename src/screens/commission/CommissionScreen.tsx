/**
 * Commission Management Screen
 * View and manage commission workers and payments
 */

import { useMemo, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/lib/currencyUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import { calculateWorkerCommissionSummary } from '@/lib/financeUtils';
import './CommissionScreen.css';

type TabType = 'workers' | 'history';

export function CommissionScreen() {
  const { jobs, commissionWorkers, commissionPayments, addCommissionPayment, deleteCommissionPayment, getCustomer } =
    useDataStore();
  const toast = useToast();
  const today = getLocalDateString(new Date());

  const [activeTab, setActiveTab] = useState<TabType>('workers');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const workerSummary = useMemo(
    () => calculateWorkerCommissionSummary(jobs, commissionPayments, commissionWorkers),
    [jobs, commissionPayments, commissionWorkers]
  );

  const handleRecordPayment = async () => {
    if (!selectedWorker) {
      toast.error('Error', 'Please select a worker');
      return;
    }

    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Error', 'Payment amount must be greater than 0');
      return;
    }

    const worker = commissionWorkers.find((w) => w.id === selectedWorker);
    if (!worker) {
      toast.error('Error', 'Worker not found');
      return;
    }

    setIsSubmitting(true);
    try {
      await addCommissionPayment({
        workerId: selectedWorker,
        workerName: worker.name,
        customerId: worker.customerId,
        jobIds: [],
        amount: parseFloat(paymentAmount),
        date: paymentDate,
        notes: paymentNotes || undefined,
      });

      toast.success('Success', 'Commission payment recorded successfully');
      setSelectedWorker(null);
      setPaymentAmount('');
      setPaymentDate(today);
      setPaymentNotes('');
      setShowPaymentForm(false);
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Error', 'Failed to record commission payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm('Are you sure you want to delete this payment record?')) {
      return;
    }

    try {
      await deleteCommissionPayment(paymentId);
      toast.success('Success', 'Payment deleted successfully');
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Error', 'Failed to delete payment');
    }
  };

  const totalDue = workerSummary.reduce((sum, w) => sum + w.totalDue, 0);
  const totalPaid = workerSummary.reduce((sum, w) => sum + w.totalPaid, 0);
  const totalOutstanding = workerSummary.reduce((sum, w) => sum + w.outstanding, 0);

  return (
    <div className="commission-screen">
      <div className="commission-header">
        <h1>Commission Management</h1>
        <p className="commission-subtitle">Track commission workers and payments</p>
      </div>

      {/* Summary Cards */}
      <div className="commission-summary">
        <div className="summary-card">
          <div className="summary-label">Total Commission Due</div>
          <div className="summary-value">{formatCurrency(totalDue)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Commission Paid</div>
          <div className="summary-value paid">{formatCurrency(totalPaid)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Outstanding</div>
          <div className="summary-value pending">{formatCurrency(totalOutstanding)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Workers</div>
          <div className="summary-value">{workerSummary.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="commission-tabs">
        <button
          className={`tab-btn ${activeTab === 'workers' ? 'active' : ''}`}
          onClick={() => setActiveTab('workers')}
        >
          👥 Workers
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📋 Payment History
        </button>
      </div>

      {/* Workers Tab */}
      {activeTab === 'workers' && (
        <div className="commission-section">
          <div className="section-header">
            <h2>Commission Workers</h2>
            <button
              className="btn btn-primary"
              onClick={() => setShowPaymentForm(!showPaymentForm)}
            >
              {showPaymentForm ? 'Cancel' : '+ Record Payment'}
            </button>
          </div>

          {showPaymentForm && (
            <div className="payment-form-box">
              <h3>Record Commission Payment</h3>
              <div className="form-group">
                <label className="form-label">Worker</label>
                <select
                  className="form-select"
                  value={selectedWorker ? String(selectedWorker) : ''}
                  onChange={(e) => setSelectedWorker(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select a worker...</option>
                  {[...workerSummary]
                    .sort((a, b) => a.workerName.localeCompare(b.workerName))
                    .map((worker) => (
                      <option key={worker.workerId} value={String(worker.workerId)}>
                        {worker.workerName} ({getCustomer(worker.customerId)?.shortCode || worker.customerId})
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (INR)</label>
                <input
                  type="number"
                  className="form-input"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  max={today}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  className="form-textarea"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Add any notes..."
                  rows={2}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleRecordPayment}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          )}

          {workerSummary.length === 0 ? (
            <div className="empty-state">
              <p>No commission workers configured</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker Name</th>
                    <th className="text-right">Total Due</th>
                    <th className="text-right">Total Paid</th>
                    <th className="text-right">Outstanding</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workerSummary.map((worker) => (
                    <tr key={worker.workerId}>
                      <td>{worker.workerName}</td>
                      <td className="text-right">{formatCurrency(worker.totalDue)}</td>
                      <td className="text-right">{formatCurrency(worker.totalPaid)}</td>
                      <td className="text-right pending">
                        {formatCurrency(worker.outstanding)}
                      </td>
                      <td className="text-center">
                        {worker.outstanding > 0 ? '⏳ Pending' : '✓ Settled'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="commission-section">
          <h2>Payment History</h2>

          {commissionPayments.length === 0 ? (
            <div className="empty-state">
              <p>No commission payments recorded yet</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Worker</th>
                    <th className="text-right">Amount</th>
                    <th>Notes</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...commissionPayments]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          {new Date(payment.date).toLocaleDateString('en-IN')}
                        </td>
                        <td>{payment.workerName}</td>
                        <td className="text-right">{formatCurrency(payment.amount)}</td>
                        <td>{payment.notes || '-'}</td>
                        <td className="text-center">
                          <button
                            className="icon-btn icon-delete"
                            onClick={() => handleDeletePayment(payment.id)}
                            title="Delete payment"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
