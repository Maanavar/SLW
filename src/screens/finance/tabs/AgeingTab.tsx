import { AgeingHeatmap } from '@/components/charts/AgeingHeatmap';
import type { BandKey } from '@/components/charts/AgeingHeatmap';
import type { CustomerAgeingRow } from '@/lib/financeUtils';

interface AgeingTabProps {
  customerAgeingRows: CustomerAgeingRow[];
  onCellClick?: (customerId: number, customerName: string, band: BandKey) => void;
}

export function AgeingTab({ customerAgeingRows, onCellClick }: AgeingTabProps) {
  return (
    <div className="fin-tab-content">
      <AgeingHeatmap rows={customerAgeingRows} onCellClick={onCellClick} />
    </div>
  );
}
