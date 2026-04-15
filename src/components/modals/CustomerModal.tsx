/**
 * Customer Modal Component
 * Create and edit customer information
 */

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import type { CommissionWorker } from '@/types';
import { formatCurrency } from '@/lib/currencyUtils';
import './Modals.css';

export function CustomerModal() {
  const { modal, closeModal } = useUIStore();
  const {
    getCustomer,
    addCustomer,
    updateCustomer,
    getCommissionWorkersForCustomer,
    addCommissionWorker,
    updateCommissionWorker,
    deleteCommissionWorker,
  } = useDataStore();
  const toast = useToast();

  const isCustomerModal = modal.isOpen && modal.type === 'customer';
  const isEditMode = isCustomerModal && (modal.id || 0) > 0;

  // Form state
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [customerType, setCustomerType] = useState<'Monthly' | 'Invoice' | 'Party-Credit' | 'Cash'>('Monthly');
  const [hasCommission, setHasCommission] = useState(false);
  const [requiresDc, setRequiresDc] = useState(false);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [commissionWorkers, setCommissionWorkers] = useState<CommissionWorker[]>([]);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerShareType, setNewWorkerShareType] = useState<'percentage' | 'fixed'>('percentage');
  const [newWorkerShareValue, setNewWorkerShareValue] = useState('');
  const [newWorkerActive, setNewWorkerActive] = useState(true);

  // Load customer data for edit mode
  useEffect(() => {
    if (isEditMode && modal.id) {
      const customer = getCustomer(modal.id as number);
      if (customer) {
        setName(customer.name);
        setShortCode(customer.shortCode);
        setCustomerType(customer.type);
        setHasCommission(customer.hasCommission);
        setRequiresDc(customer.requiresDc);
        setNotes(customer.notes);
        setIsActive(customer.isActive);

        // Load commission workers if this customer has commission
        if (customer.hasCommission) {
          const workers = getCommissionWorkersForCustomer(customer.id);
          setCommissionWorkers(workers);
        } else {
          setCommissionWorkers([]);
        }
      }
    } else {
      // Reset form for add mode
      setName('');
      setShortCode('');
      setCustomerType('Monthly');
      setHasCommission(false);
      setRequiresDc(false);
      setNotes('');
      setIsActive(true);
      setCommissionWorkers([]);
    }
    // Reset new worker form
    setNewWorkerName('');
    setNewWorkerShareType('percentage');
    setNewWorkerShareValue('');
    setNewWorkerActive(true);
  }, [isEditMode, modal.id, getCustomer, getCommissionWorkersForCustomer]);

  const handleAddWorker = async () => {
    if (!newWorkerName.trim()) {
      toast.error('Error', 'Worker name is required');
      return;
    }

    if (!newWorkerShareValue || parseFloat(newWorkerShareValue) <= 0) {
      toast.error('Error', 'Share value must be greater than 0');
      return;
    }

    if (newWorkerShareType === 'percentage' && parseFloat(newWorkerShareValue) > 100) {
      toast.error('Error', 'Percentage cannot exceed 100%');
      return;
    }

    try {
      if (isEditMode && modal.id) {
        await addCommissionWorker({
          customerId: modal.id as number,
          name: newWorkerName.trim(),
          shareType: newWorkerShareType,
          shareValue: parseFloat(newWorkerShareValue),
          isActive: newWorkerActive,
        });

        // Reload workers
        const workers = getCommissionWorkersForCustomer(modal.id as number);
        setCommissionWorkers(workers);

        setNewWorkerName('');
        setNewWorkerShareValue('');
        setNewWorkerShareType('percentage');
        setNewWorkerActive(true);

        toast.success('Success', 'Worker added successfully');
      }
    } catch (error) {
      toast.error('Error', 'Failed to add worker');
    }
  };

  const handleDeleteWorker = async (workerId: number) => {
    if (!confirm('Are you sure you want to delete this worker?')) {
      return;
    }

    try {
      await deleteCommissionWorker(workerId);
      setCommissionWorkers(commissionWorkers.filter((w) => w.id !== workerId));
      toast.success('Success', 'Worker deleted successfully');
    } catch (error) {
      toast.error('Error', 'Failed to delete worker');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Error', 'Customer name is required');
      return;
    }

    if (!shortCode.trim()) {
      toast.error('Error', 'Short code is required');
      return;
    }

    try {
      const customerData = {
        name: name.trim(),
        shortCode: shortCode.trim(),
        type: customerType,
        hasCommission,
        requiresDc,
        notes: notes.trim(),
        isActive,
      };

      if (isEditMode) {
        await updateCustomer(modal.id as number, customerData);
        toast.success('Success', `${name} updated successfully`);
      } else {
        await addCustomer(customerData);
        toast.success('Success', `${name} added successfully`);
      }

      closeModal();
    } catch (error) {
      toast.error('Error', 'Failed to save customer');
    }
  };

  const showCommissionWorkers = isEditMode && hasCommission;

  return (
    <Modal
      isOpen={isCustomerModal}
      onClose={closeModal}
      title={isEditMode ? `Edit Customer: ${name}` : 'Add Customer'}
      size={showCommissionWorkers ? 'lg' : 'md'}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="form-group">
          <label className="form-label" htmlFor="name">
            Customer Name *
          </label>
          <input
            id="name"
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer name..."
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="shortCode">
            Short Code *
          </label>
          <input
            id="shortCode"
            type="text"
            className="form-input"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value)}
            placeholder="Short code..."
            maxLength={20}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="customerType">
            Type
          </label>
          <select
            id="customerType"
            className="form-input"
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as any)}
          >
            <option value="Monthly">Monthly</option>
            <option value="Invoice">Invoice</option>
            <option value="Party-Credit">Party-Credit</option>
            <option value="Cash">Cash</option>
          </select>
        </div>

        <div className="form-group">
          <div className="checkbox-group">
            <ToggleSwitch
              checked={hasCommission}
              onChange={setHasCommission}
              label="Has Commission"
              id="has-commission"
            />
          </div>
        </div>

        <div className="form-group">
          <div className="checkbox-group">
            <ToggleSwitch
              checked={requiresDc}
              onChange={setRequiresDc}
              label="Requires DC"
              id="requires-dc"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            className="form-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this customer..."
            rows={3}
          />
        </div>

        {showCommissionWorkers && (
          <div className="form-group" style={{ borderTop: '1px solid #ddd', paddingTop: '1rem', marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Commission Workers</h4>

            {commissionWorkers.length > 0 && (
              <div style={{ marginBottom: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Share</th>
                      <th style={{ textAlign: 'center', padding: '8px', width: '60px' }}>Active</th>
                      <th style={{ textAlign: 'center', padding: '8px', width: '60px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionWorkers.map((worker) => (
                      <tr key={worker.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px' }}>{worker.name}</td>
                        <td style={{ padding: '8px' }}>
                          {worker.shareType === 'percentage'
                            ? `${worker.shareValue}%`
                            : formatCurrency(worker.shareValue)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          {worker.isActive ? '✓' : '✗'}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleDeleteWorker(worker.id)}
                            title="Delete worker"
                            style={{ color: '#d32f2f', cursor: 'pointer' }}
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

            <div style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
              <h5 style={{ marginTop: 0, marginBottom: '0.8rem' }}>Add New Worker</h5>

              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label className="form-label" htmlFor="worker-name">
                  Name
                </label>
                <input
                  id="worker-name"
                  type="text"
                  className="form-input"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  placeholder="Worker name..."
                  style={{ marginBottom: 0 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="worker-share-type">
                    Type
                  </label>
                  <select
                    id="worker-share-type"
                    className="form-input"
                    value={newWorkerShareType}
                    onChange={(e) => setNewWorkerShareType(e.target.value as 'percentage' | 'fixed')}
                    style={{ marginBottom: 0 }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (₹)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="worker-share-value">
                    {newWorkerShareType === 'percentage' ? 'Percentage' : 'Amount'}
                  </label>
                  <input
                    id="worker-share-value"
                    type="number"
                    className="form-input"
                    value={newWorkerShareValue}
                    onChange={(e) => setNewWorkerShareValue(e.target.value)}
                    placeholder={newWorkerShareType === 'percentage' ? '0-100' : '0.00'}
                    step={newWorkerShareType === 'percentage' ? '0.01' : '0.01'}
                    min="0"
                    max={newWorkerShareType === 'percentage' ? '100' : undefined}
                    style={{ marginBottom: 0 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newWorkerActive}
                    onChange={(e) => setNewWorkerActive(e.target.checked)}
                  />
                  <span>Active</span>
                </label>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddWorker}
                style={{ width: '100%' }}
              >
                Add Worker
              </button>
            </div>
          </div>
        )}

        <div className="form-group">
          <div className="checkbox-group">
            <ToggleSwitch
              checked={isActive}
              onChange={setIsActive}
              label="Active"
              id="is-active"
            />
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeModal}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
          >
            {isEditMode ? 'Update' : 'Add'} Customer
          </button>
        </div>
      </form>
    </Modal>
  );
}
