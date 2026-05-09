import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export const COMMISSION_WORKERS_KEY = ['commissionWorkers'] as const;

export function useCommissionWorkersQuery() {
  return useQuery({
    queryKey: COMMISSION_WORKERS_KEY,
    queryFn: () => apiClient.getCommissionWorkers(),
    staleTime: 5 * 60 * 1000,
  });
}
