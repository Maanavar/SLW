/**
 * Work Type Modal Component
 * Create and edit work type information
 */

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useDataStore } from '@/stores/dataStore';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import './Modals.css';

export function WorkTypeModal() {
  const { modal, closeModal } = useUIStore();
  const { workTypes, addWorkType, updateWorkType, categories } = useDataStore();
  const toast = useToast();

  const isWorkTypeModal = modal.isOpen && modal.type === 'worktype';
  const isEditMode = isWorkTypeModal && (modal.id || 0) > 0;

  // Form state
  const [category, setCategory] = useState('Skimming');
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('');
  const [defaultRate, setDefaultRate] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Load work type data for edit mode
  useEffect(() => {
    if (isEditMode && modal.id) {
      const workType = workTypes.find((wt) => wt.id === (modal.id as number));
      if (workType) {
        setCategory(workType.category);
        setName(workType.name);
        setShortCode(workType.shortCode);
        setDefaultUnit(workType.defaultUnit);
        setDefaultRate(workType.defaultRate.toString());
        setIsActive(workType.isActive !== false);
      }
    } else {
      // Reset form for add mode
      setCategory('Skimming');
      setName('');
      setShortCode('');
      setDefaultUnit('');
      setDefaultRate('');
      setIsActive(true);
    }
  }, [isEditMode, modal.id, workTypes]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Error', 'Work type name is required');
      return;
    }

    if (!shortCode.trim()) {
      toast.error('Error', 'Short code is required');
      return;
    }

    if (!defaultUnit.trim()) {
      toast.error('Error', 'Unit is required');
      return;
    }

    if (!defaultRate || parseFloat(defaultRate) < 0) {
      toast.error('Error', 'Please enter a valid rate');
      return;
    }

    try {
      const workTypeData = {
        category,
        name: name.trim(),
        shortCode: shortCode.trim(),
        defaultUnit: defaultUnit.trim(),
        defaultRate: parseFloat(defaultRate),
        isActive,
      };

      if (isEditMode) {
        await updateWorkType(modal.id as number, workTypeData);
        toast.success('Success', `${name} updated successfully`);
      } else {
        await addWorkType(workTypeData);
        toast.success('Success', `${name} added successfully`);
      }

      closeModal();
    } catch (error) {
      toast.error('Error', 'Failed to save work type');
    }
  };

  return (
    <Modal
      isOpen={isWorkTypeModal}
      onClose={closeModal}
      title={isEditMode ? `Edit Work Type: ${name}` : 'Add Work Type'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="form-group">
          <label className="form-label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            className="form-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[...categories].sort().map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="name">
            Work Type Name *
          </label>
          <input
            id="name"
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Work type name..."
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
          <label className="form-label" htmlFor="defaultUnit">
            Unit *
          </label>
          <input
            id="defaultUnit"
            type="text"
            className="form-input"
            value={defaultUnit}
            onChange={(e) => setDefaultUnit(e.target.value)}
            placeholder="e.g., Piece, Hour, Meter..."
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="defaultRate">
            Default Rate (₹) *
          </label>
          <input
            id="defaultRate"
            type="number"
            className="form-input"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            required
          />
        </div>

        <div className="form-group">
          <div className="checkbox-group">
            <ToggleSwitch
              checked={isActive}
              onChange={setIsActive}
              label="Active"
              id="is-active-wt"
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
            {isEditMode ? 'Update' : 'Add'} Work Type
          </button>
        </div>
      </form>
    </Modal>
  );
}
