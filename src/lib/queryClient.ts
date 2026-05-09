import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,       // consider fresh for 2 min
      gcTime: 30 * 60 * 1000,          // keep in cache 30 min (survives tab switch)
      retry: 2,
      refetchOnWindowFocus: true,       // re-fetch when user returns to tab
      refetchOnReconnect: true,         // re-fetch when network comes back
    },
  },
});
