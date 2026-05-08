import { RevenueTrendChart } from '@/components/charts/RevenueTrendChart';
import type { Job, Payment } from '@/types';

interface TrendsTabProps {
  jobs: Job[];
  payments: Payment[];
  dateRange?: { from: string; to: string };
}

export function TrendsTab({ jobs, payments, dateRange }: TrendsTabProps) {
  return (
    <div className="fin-tab-content">
      <RevenueTrendChart jobs={jobs} payments={payments} dateRange={dateRange} />
    </div>
  );
}
