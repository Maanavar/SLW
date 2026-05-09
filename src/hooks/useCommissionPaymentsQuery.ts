import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export const COMMISSION_PAYMENTS_KEY = ['commissionPayments'] as const;

export function useCommissionPaymentsQuery() {
  return useQuery({
    queryKey: COMMISSION_PAYMENTS_KEY,
    queryFn: () => apiClient.getCommissionPayments(),
    staleTime: 2 * 60 * 1000,
  });
}
