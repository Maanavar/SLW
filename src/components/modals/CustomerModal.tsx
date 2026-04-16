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

  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [customerType, setCustomerType] = useState<'Monthly' | 'Invoice' | 'Party-Credit' | 'Cash'>('Monthly');
  const [hasCommission, setHasCommission] = useState(false);
  const [requiresDc, setRequiresDc] = useState(false);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [commissionWorkers, setCommissionWorkers] = useState<CommissionWorker[]>([]);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerActive, setNewWorkerActive] = useState(true);
  const [editingWorkerId, setEditingWorkerId] = useState<number | null>(null);

  const resetWorkerForm = () => {
    setNewWorkerName('');
    setNewWorkerActive(true);
    setEditingWorkerId(null);
  };

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

        const workers = customer.hasCommission ? getCommissionWorkersForCustomer(customer.id) : [];
        setCommissionWorkers(workers);
      }
    } else {
      setName('');
      setShortCode('');
      setCustomerType('Monthly');
      setHasCommission(false);
      setRequiresDc(false);
      setNotes('');
      setIsActive(true);
      setCommissionWorkers([]);
    }

    resetWorkerForm();
  }, [isEditMode, modal.id, getCustomer, getCommissionWorkersForCustomer]);

  const handleAddOrUpdateWorker = async () => {
    if (!newWorkerName.trim()) {
      toast.error('Error', 'Worker name is required');
      return;
    }

    const duplicateName = commissionWorkers.some(
      (worker) =>
        worker.id !== editingWorkerId &&
        worker.name.trim().toLowerCase() === newWorkerName.trim().toLowerCase()
    );
    if (duplicateName) {
      toast.error('Error', 'Worker name already exists for this customer');
      return;
    }

    try {
      const workerPatch = {
        name: newWorkerName.trim(),
        isActive: newWorkerActive,
        shareType: 'fixed' as const,
        shareValue: 0,
      };

      if (editingWorkerId !== null) {
        if (isEditMode && editingWorkerId > 0) {
          await updateCommissionWorker(editingWorkerId, workerPatch);
        }

        setCommissionWorkers((prev) =>
          prev.map((worker) => (worker.id === editingWorkerId ? { ...worker, ...workerPatch } : worker))
        );

        resetWorkerForm();
        toast.success('Success', 'Worker updated successfully');
        return;
      }

      if (isEditMode && modal.id) {
        const created = await addCommissionWorker({
          customerId: modal.id as number,
          ...workerPatch,
        });
        setCommissionWorkers((prev) => [...prev, created]);
      } else {
        const draftWorker: CommissionWorker = {
          id: -Date.now(),
          customerId: 0,
          ...workerPatch,
        };
        setCommissionWorkers((prev) => [...prev, draftWorker]);
      }

      resetWorkerForm();
      toast.success('Success', 'Worker added successfully');
    } catch {
      toast.error('Error', `Failed to ${editingWorkerId !== null ? 'update' : 'add'} worker`);
    }
  };

  const handleEditWorker = (worker: CommissionWorker) => {
    setEditingWorkerId(worker.id);
    setNewWorkerName(worker.name);
    setNewWorkerActive(worker.isActive);
  };

  const handleDeleteWorker = async (workerId: number) => {
    if (!confirm('Are you sure you want to delete this worker?')) {
      return;
    }

    try {
      if (isEditMode && workerId > 0) {
        await deleteCommissionWorker(workerId);
      }
      setCommissionWorkers((prev) => prev.filter((w) => w.id !== workerId));
      if (editingWorkerId === workerId) {
        resetWorkerForm();
      }
      toast.success('Success', 'Worker deleted successfully');
    } catch {
      toast.error('Error', 'Failed to delete worker');
    }
  };

  const handleHasCommissionChange = (checked: boolean) => {
    if (!checked && commissionWorkers.length > 0) {
      const confirmed = confirm(
        'This customer has commission workers configured. Turn off commission for this customer?'
      );
      if (!confirmed) {
        return;
      }
      resetWorkerForm();
    }
    setHasCommission(checked);
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
        const createdCustomer = await addCustomer(customerData);
        if (hasCommission && commissionWorkers.length > 0) {
          await Promise.all(
            commissionWorkers.map((worker) =>
              addCommissionWorker({
                customerId: createdCustomer.id,
                name: worker.name,
                isActive: worker.isActive,
                shareType: 'fixed',
                shareValue: 0,
              })
            )
          );
        }
        toast.success('Success', `${name} added successfully`);
      }

      closeModal();
    } catch {
      toast.error('Error', 'Failed to save customer');
    }
  };

  const showCommissionWorkers = hasCommission;

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
            onChange={(e) => setCustomerType(e.target.value as typeof customerType)}
          >
            <option value="Monthly">Monthly</option>
            <option value="Invoice">Invoice</option>
            <option value="Party-Credit">Party-Credit</option>
            <option value="Cash">Cash</option>
          </select>
        </div>

        <div className="customer-flags-row">
          <div className="form-group">
            <div className="checkbox-group">
              <ToggleSwitch
                checked={hasCommission}
                onChange={handleHasCommissionChange}
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
          <section className="commission-workers-panel">
            <div className="commission-workers-header">
              <h4>Commission Workers</h4>
              <p>
                Worker tagging only. Commission amount is entered per job card.
              </p>
            </div>

            {commissionWorkers.length === 0 ? (
              <p className="commission-workers-empty">No workers added for this customer yet.</p>
            ) : (
              <div className="commission-workers-list" role="list">
                {commissionWorkers.map((worker) => (
                  <div className="commission-worker-item" role="listitem" key={worker.id}>
                    <div className="commission-worker-meta">
                      <strong>{worker.name}</strong>
                      <span className={`worker-status ${worker.isActive ? 'active' : 'inactive'}`}>
                        {worker.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="commission-worker-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEditWorker(worker)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-danger-soft"
                        onClick={() => handleDeleteWorker(worker.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="commission-worker-editor">
              <h5>{editingWorkerId !== null ? 'Edit Worker' : 'Add Worker'}</h5>
              <div className="commission-worker-editor-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="worker-name">
                    Worker Name
                  </label>
                  <input
                    id="worker-name"
                    type="text"
                    className="form-input"
                    value={newWorkerName}
                    onChange={(e) => setNewWorkerName(e.target.value)}
                    placeholder="Enter worker name"
                  />
                </div>

                <div className="form-group">
                  <div className="checkbox-group">
                    <ToggleSwitch
                      checked={newWorkerActive}
                      onChange={setNewWorkerActive}
                      label="Active"
                      id="worker-active"
                    />
                  </div>
                </div>
              </div>

              <div className="commission-worker-editor-actions">
                <button type="button" className="btn btn-secondary" onClick={handleAddOrUpdateWorker}>
                  {editingWorkerId !== null ? 'Update Worker' : 'Add Worker'}
                </button>
                {editingWorkerId !== null && (
                  <button type="button" className="btn btn-secondary" onClick={resetWorkerForm}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="form-group">
          <div className="checkbox-group">
            <ToggleSwitch checked={isActive} onChange={setIsActive} label="Active" id="is-active" />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={closeModal}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {isEditMode ? 'Update' : 'Add'} Customer
          </button>
        </div>
      </form>
    </Modal>
  );
}
