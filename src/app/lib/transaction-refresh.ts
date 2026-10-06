import type { QueryClient } from '@tanstack/react-query';

export const TRANSACTION_DATA_REFRESH_DELAYS_MS = [0, 3_000, 8_000, 15_000, 30_000, 60_000] as const;

/**
 * Give the API/indexer time to process a submitted transaction, then refresh
 * active application queries for one minute to cover delayed indexing.
 */
export function scheduleTransactionDataRefresh(queryClient: QueryClient) {
  TRANSACTION_DATA_REFRESH_DELAYS_MS.forEach((delay) => {
    window.setTimeout(() => {
      void queryClient.invalidateQueries({
        predicate: (query) => typeof query.queryKey[0] === 'string',
        refetchType: 'active',
      });
    }, delay);
  });
}
