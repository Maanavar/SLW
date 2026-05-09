import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export const WORK_TYPES_KEY = ['workTypes'] as const;

export function useWorkTypesQuery() {
  return useQuery({
    queryKey: WORK_TYPES_KEY,
    queryFn: () => apiClient.getWorkTypes(),
    staleTime: 5 * 60 * 1000,
  });
}
