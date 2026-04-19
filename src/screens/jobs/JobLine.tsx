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
  showCommission?: boolean;
  showInlineWorker?: boolean;
  showInlineCommission?: boolean;
  commissionWorkers?: CommissionWorker[];
}

export function JobLine({
  line,
  onChange,
  onRemove,
  showCommission = true,
  showInlineWorker = true,
  showInlineCommission = true,
  commissionWorkers = [],
}: JobLineProps) {
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

  const showWorkerField = showCommission && showInlineWorker && commissionWorkers.length > 0;
  const showCommissionField = showCommission && showInlineCommission;

  return (
    <div className={`wl-row${showWorkerField || showCommissionField ? ' wl-row--comm' : ''}`}>
      <div className="wl-cell wl-cell--type">
        <SearchableSelect
          items={sortedWorkTypes}
          value={line.workType}
          onChange={handleWorkTypeChange}
          getLabel={(wt) => wt.name}
          getSearchText={(wt) => `${wt.name} ${wt.shortCode || ''} ${wt.category || ''}`}
          getKey={(wt) => String(wt.id)}
          groupBy={(wt) => wt.category}
          placeholder="Select work type..."
        />
        {suggestedAmount !== '0' && (
          <button type="button" className="wl-suggest" onClick={handleApplySuggestedAmount}>
            ₹{suggestedAmount}
          </button>
        )}
      </div>

      <div className="wl-cell wl-cell--qty">
        <QuantityStepper value={line.quantity} onChange={handleQuantityChange} min={1} max={9999} step={1} />
      </div>

      <div className="wl-cell wl-cell--amt">
        <input
          type="number"
          className="line-input"
          value={line.amount}
          onChange={handleAmountChange}
          placeholder="0"
          step="0.01"
          min="0"
          required
        />
      </div>

      {showCommissionField && (
        <div className="wl-cell wl-cell--comm">
          <input
            type="number"
            className="line-input"
            value={line.commission}
            onChange={handleCommissionChange}
            placeholder="0"
            step="0.01"
            min="0"
          />
        </div>
      )}

      {showWorkerField && (
        <div className="wl-cell wl-cell--worker">
          <SearchableSelect
            items={sortedWorkers}
            value={line.commissionWorker}
            onChange={handleWorkerChange}
            getLabel={(w) => w.name}
            getKey={(w) => String(w.id)}
            placeholder="Worker..."
          />
        </div>
      )}

      <div className="wl-cell wl-cell--remove">
        <button
          className="wl-remove-btn"
          onClick={onRemove}
          type="button"
          title="Remove line"
          aria-label="Remove job line"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}
