import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export const JOBS_KEY = ['jobs'] as const;

export function jobsQueryKey(range?: { from: string; to: string } | null) {
  return range ? [...JOBS_KEY, range.from, range.to] : JOBS_KEY;
}

export function useJobsQuery(range?: { from: string; to: string } | null) {
  return useQuery({
    queryKey: jobsQueryKey(range),
    queryFn: () => apiClient.getJobs(range ?? undefined),
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30 * 1000,
    enabled: range !== null,
  });
}
