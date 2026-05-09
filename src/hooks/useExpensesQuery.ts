import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export const EXPENSES_KEY = ['expenses'] as const;

export function expensesQueryKey(range?: { from: string; to: string } | null) {
  return range ? [...EXPENSES_KEY, range.from, range.to] : EXPENSES_KEY;
}

export function useExpensesQuery(range?: { from: string; to: string } | null) {
  return useQuery({
    queryKey: expensesQueryKey(range),
    queryFn: () => apiClient.getExpenses(range ?? undefined),
    staleTime: 2 * 60 * 1000,
    enabled: range !== null,
  });
}
