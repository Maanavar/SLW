import { useEffect, useState } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/currencyUtils';
import { getPaymentDisplayId } from '@/lib/paymentUtils';
import { getLocalDateString } from '@/lib/dateUtils';
import type { Payment } from '@/types';
import './PaymentEditModal.css';

interface PaymentEditModalProps {
  isOpen: boolean;
  payment: Payment | null;
  customerName: string;
  onClose: () => void;
}

export function PaymentEditModal({
  isOpen,
  payment,
  customerName,
  onClose,
}: PaymentEditModalProps) {
  const { updatePayment, deletePayment } = useDataStore();
  const toast = useToast();
  const today = getLocalDateString(new Date());

  const [amount, setAmount] = useState(payment?.amount.toString() || '');
  const [paymentDate, setPaymentDate] = useState(payment?.date || today);
  const [paymentMode, setPaymentMode] = useState<Payment['paymentMode']>(
    payment?.paymentMode || 'Cash'
  );
  const [notes, setNotes] = useState(payment?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync form state when payment changes
  useEffect(() => {
    if (payment && isOpen) {
      setAmount(payment.amount.toString());
      setPaymentDate(payment.date);
      setPaymentMode(payment.paymentMode);
      setNotes(payment.notes || '');
    }
  }, [payment, isOpen]);

  const handleSave = async () => {
    if (!payment) return;

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Error', 'Please enter a valid amount');
      return;
    }

    if (paymentDate > today) {
      toast.error('Error', 'Future payment date is not allowed');
      return;
    }

    setIsSaving(true);
    try {
      await updatePayment(payment.id, {
        amount: parseFloat(amount),
        date: paymentDate,
        paymentMode,
        notes: notes || undefined,
      });
      toast.success('Success', 'Payment updated successfully');
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Error', 'Failed to update payment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!payment) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete this payment of ${formatCurrency(payment.amount)}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deletePayment(payment.id);
      toast.success('Success', 'Payment deleted successfully');
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Error', 'Failed to delete payment');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Payment - ${customerName}`} size="md">
      <div className="payment-edit-form">
        <div className="form-group">
          <label className="form-label">Payment ID</label>
          <div className="form-display">{payment ? getPaymentDisplayId(payment) : '-'}</div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-amount">
            Amount (INR)
          </label>
          <input
            id="edit-amount"
            type="number"
            className="form-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.01"
            min="0"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-date">
            Payment Date
          </label>
          <input
            id="edit-date"
            type="date"
            className="form-input"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            max={today}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-mode">
            Payment Mode
          </label>
          <select
            id="edit-mode"
            className="form-input"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as Payment['paymentMode'])}
          >
            <option value="Cash">Cash</option>
            <option value="Bank">Bank</option>
            <option value="UPI">UPI</option>
            <option value="Cheque">Cheque</option>
            <option value="Mixed">Mixed (Multiple Modes)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-notes">
            Notes
          </label>
          <textarea
            id="edit-notes"
            className="form-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="payment-edit-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={isSaving || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
