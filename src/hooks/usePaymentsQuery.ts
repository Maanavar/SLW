import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export const PAYMENTS_KEY = ['payments'] as const;

export function paymentsQueryKey(range?: { from: string; to: string } | null) {
  return range ? [...PAYMENTS_KEY, range.from, range.to] : PAYMENTS_KEY;
}

export function usePaymentsQuery(range?: { from: string; to: string } | null) {
  return useQuery({
    queryKey: paymentsQueryKey(range),
    queryFn: () => apiClient.getPayments(range ?? undefined),
    staleTime: 1 * 60 * 1000,
    enabled: range !== null,
  });
}
