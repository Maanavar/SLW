import { AgeingHeatmap } from '@/components/charts/AgeingHeatmap';
import type { CustomerAgeingRow } from '@/lib/financeUtils';

interface AgeingTabProps {
  customerAgeingRows: CustomerAgeingRow[];
}

export function AgeingTab({ customerAgeingRows }: AgeingTabProps) {
  return (
    <div className="fin-tab-content">
      <AgeingHeatmap rows={customerAgeingRows} />
    </div>
  );
}
