import { CustomerRankingTable } from '@/components/charts/CustomerRankingTable';
import type { CustomerRank } from '@/lib/customerRankingUtils';

interface RankingsTabProps {
  customerRankings: CustomerRank[];
}

export function RankingsTab({ customerRankings }: RankingsTabProps) {
  return (
    <div className="fin-tab-content">
      <CustomerRankingTable rankings={customerRankings} />
    </div>
  );
}
