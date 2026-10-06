import { useMemo } from 'react';
import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { ApiService } from '../apis/api-service';
import { useWallet } from '../providers/wallet-provider';
import type {
  DashboardDataParams,
  DashboardDataResults,
} from '../types/api-service/dashboard';

/**
 * Generic query options for `useFetchData`.
 *
 * @template TData Raw data returned by `queryFn`.
 * @template TParams Request params shape accepted by `queryFn`.
 * @template TSelected Final selected data type from React Query `select`.
 */
export interface UseFetchDataOptions<
  TData,
  TParams extends Record<string, any> = Record<string, never>,
  TSelected = TData,
> extends Omit<
  UseQueryOptions<TData, Error, TSelected>,
  'queryKey' | 'queryFn' | 'enabled' | 'placeholderData'
> {
  /** Base query key. Request params can be appended automatically. */
  queryKey: QueryKey;
  /** Data request implementation. */
  queryFn: (params: TParams) => Promise<TData>;
  /** Request params passed to `queryFn`. */
  params?: TParams;
  /** Whether the query is active. Default: `true`. */
  enabled?: boolean;
  /** Keep previous page/query result while refetching. Default: `false`. */
  keepPreviousResult?: boolean;
  /**
   * Append `params` to query key for cache separation.
   * Default: `true`.
   */
  includeParamsInQueryKey?: boolean;
  /**
   * Auto-refresh control:
   * - `true`: refresh every 30 seconds.
   * - `number`: refresh with custom interval in milliseconds.
   * - `false` or `undefined`: disable auto refresh.
   */
  autoRefresh?: boolean | number;
}

/**
 * Dashboard-specific convenience options.
 * Internal `queryKey`, `queryFn`, and `params` are managed by the hook.
 */
export interface UseDashboardDataOptions extends Omit<
  UseFetchDataOptions<DashboardDataResults, DashboardDataParams>,
  'queryKey' | 'queryFn' | 'params'
> {
  /** Optional custom chain id. Fallback: current wallet network chain id. */
  chainId?: number;
}

/**
 * Generic data-fetching hook based on React Query.
 *
 * Returns all original React Query result fields, plus:
 * - `rawData`: nullable alias of `data`
 * - `requestParams`: normalized params passed to `queryFn`
 */
export function useFetchData<
  TData,
  TParams extends Record<string, any> = Record<string, never>,
  TSelected = TData,
>({
  queryKey,
  queryFn,
  params,
  enabled = true,
  keepPreviousResult = false,
  includeParamsInQueryKey = true,
  autoRefresh = false,
  ...queryOptions
}: UseFetchDataOptions<TData, TParams, TSelected>) {
  // Normalize params into a stable object so `queryFn` always gets an object.
  const requestParams = useMemo(() => params ?? ({} as TParams), [params]);

  // Optionally include params in key, so different params map to different caches.
  const finalQueryKey = useMemo(
    () => (includeParamsInQueryKey ? [...queryKey, requestParams] : queryKey),
    [includeParamsInQueryKey, queryKey, requestParams],
  );

  // Resolve the polling interval from `autoRefresh`.
  // React Query accepts `false` to disable polling.
  const resolvedRefetchInterval =
    typeof autoRefresh === 'number'
      ? autoRefresh
      : autoRefresh
        ? 30_000
        : false;

  // Delegate fetching/caching/error/loading states to React Query.
  const query = useQuery<TData, Error, TSelected>({
    queryKey: finalQueryKey,
    queryFn: () => queryFn(requestParams),
    enabled,
    placeholderData: keepPreviousResult ? (data, previous) =>
      JSON.stringify(previous?.queryKey.slice(0, includeParamsInQueryKey ? -1 : undefined)) === JSON.stringify(queryKey)
        ? data : undefined : undefined,
    refetchInterval: resolvedRefetchInterval,
    ...queryOptions,
  });

  // Expose normalized params and nullable raw data for easier consumers.
  return {
    ...query,
    rawData: query.data ?? null,
    requestParams,
  };
}
