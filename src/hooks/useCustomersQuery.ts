import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { normalizeCustomers } from '@/lib/customerRules';

export const CUSTOMERS_KEY = ['customers'] as const;

export function useCustomersQuery() {
  return useQuery({
    queryKey: CUSTOMERS_KEY,
    queryFn: () => apiClient.getCustomers(),
    select: normalizeCustomers,
    staleTime: 5 * 60 * 1000,
  });
}
