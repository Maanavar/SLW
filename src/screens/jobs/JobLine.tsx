import { useDataStore } from '@/stores/dataStore';
import type { ChangeEvent } from 'react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { WorkType, CommissionWorker } from '@/types';
import './JobLine.css';

export interface JobLineState {
  id: string;
  workType: WorkType | null;
  quantity: number;
  amount: string;
  commission: string;
  commissionWorker: CommissionWorker | null;
}

interface JobLineProps {
  line: JobLineState;
  onChange: (line: JobLineState) => void;
  onRemove: () => void;
  lineNumber: number;
  showCommission?: boolean;
  commissionWorkers?: CommissionWorker[];
}

export function JobLine({ line, onChange, onRemove, lineNumber, showCommission = true, commissionWorkers = [] }: JobLineProps) {
  const { workTypes } = useDataStore();

  const sortedWorkTypes = [...workTypes].sort((a, b) => {
    const categoryCompare = a.category.localeCompare(b.category);
    return categoryCompare !== 0 ? categoryCompare : a.name.localeCompare(b.name);
  });

  const sortedWorkers = [...commissionWorkers].sort((a, b) => a.name.localeCompare(b.name));

  const handleWorkTypeChange = (workType: WorkType) => {
    onChange({ ...line, workType });
  };

  const handleWorkerChange = (worker: CommissionWorker) => {
    onChange({ ...line, commissionWorker: worker });
  };

  const handleQuantityChange = (quantity: number) => {
    onChange({ ...line, quantity });
  };

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...line, amount: e.target.value });
  };

  const handleCommissionChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...line, commission: e.target.value });
  };

  const suggestedAmount =
    line.workType && line.workType.defaultRate
      ? (line.workType.defaultRate * line.quantity).toFixed(2)
      : '0';

  const handleApplySuggestedAmount = () => {
    onChange({
      ...line,
      amount: suggestedAmount,
    });
  };

  return (
    <div className="job-line-container">
      <div className="line-number">{lineNumber}</div>

      <div className="line-field work-type-field">
        <label className="field-label">Work Type</label>
        <SearchableSelect
          items={sortedWorkTypes}
          value={line.workType}
          onChange={handleWorkTypeChange}
          getLabel={(wt) => wt.name}
          getSearchText={(wt) =>
            `${wt.name} ${wt.shortCode || ''} ${wt.category || ''}`
          }
          getKey={(wt) => String(wt.id)}
          groupBy={(wt) => wt.category}
          placeholder="Select work type..."
        />
      </div>

      {showCommission && commissionWorkers.length > 0 && (
        <div className="line-field worker-field">
          <label className="field-label">Worker</label>
          <SearchableSelect
            items={sortedWorkers}
            value={line.commissionWorker}
            onChange={handleWorkerChange}
            getLabel={(w) => w.name}
            getKey={(w) => String(w.id)}
            placeholder="Select worker..."
          />
        </div>
      )}

      <div className="line-field quantity-field">
        <label className="field-label">Quantity</label>
        <QuantityStepper value={line.quantity} onChange={handleQuantityChange} min={1} max={9999} step={1} />
      </div>

      <div className="line-field amount-field">
        <label className="field-label">Amount (INR)</label>
        <input
          type="number"
          className="line-input"
          value={line.amount}
          onChange={handleAmountChange}
          placeholder="0.00"
          step="0.01"
          min="0"
          required
        />
        {suggestedAmount !== '0' ? (
          <button
            type="button"
            className="suggestion-chip suggestion-chip-action"
            onClick={handleApplySuggestedAmount}
            title="Click to use suggested amount"
          >
            Suggested: INR {suggestedAmount}
          </button>
        ) : null}
      </div>

      {showCommission && (
        <div className="line-field commission-field">
          <label className="field-label">Commission (INR)</label>
          <input
            type="number"
            className="line-input"
            value={line.commission}
            onChange={handleCommissionChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            required
          />
        </div>
      )}

      <button
        className="btn-remove"
        onClick={onRemove}
        type="button"
        title="Remove job line"
        aria-label="Remove job line"
      >
        x
      </button>
    </div>
  );
}
