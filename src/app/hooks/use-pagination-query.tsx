import {
  useQuery,
  type QueryKey,
} from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';

export interface PaginationParams {
  pageNum: number;
  pageSize: number;
}

export interface PaginationPayload<TItem> {
  list: TItem[];
  count: number;
}

export interface PaginationLabels {
  totalLabel?: string;
  pageLabel?: string;
  pageSizeLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  loadingLabel?: string;
}

export interface PaginationControlsProps {
  pageNum: number;
  pageSize: number;
  count: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  isFetching?: boolean;
  onPageChange: (pageNum: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  pageSizeOptions?: number[];
  hideWhenSinglePage?: boolean;
  showSummary?: boolean;
  showPageSizeSelector?: boolean;
  labels?: PaginationLabels;
  className?: string;
}

interface PaginationUiOptions {
  pageSizeOptions?: number[];
  hideWhenSinglePage?: boolean;
  showSummary?: boolean;
  showPageSizeSelector?: boolean;
  labels?: PaginationLabels;
}

interface UsePaginationQueryOptions<
  TItem,
  TParams extends Record<string, any>,
  TRawData,
> {
  queryKey: QueryKey;
  queryFn: (params: TParams & PaginationParams) => Promise<TRawData>;
  params?: TParams;
  enabled?: boolean;
  initialPageNum?: number;
  initialPageSize?: number;
  keepPreviousResult?: boolean;
  getPaginationData?: (
    data: TRawData,
    page: { size: number; num: number },
  ) => PaginationPayload<TItem>;
  pagination?: PaginationUiOptions;
}

export function PaginationControls({
  pageNum,
  pageSize,
  count,
  totalPages,
  hasPrevPage,
  hasNextPage,
  isFetching = false,
  onPageChange,
  onPageSizeChange,
  onPrevPage,
  onNextPage,
  pageSizeOptions = [10, 20, 50],
  hideWhenSinglePage = true,
  showSummary = true,
  showPageSizeSelector = true,
  labels,
  className,
}: PaginationControlsProps) {
  const resolvedTotalPages = Math.max(totalPages, 1);
  const resolvedPageNum = Math.min(pageNum, resolvedTotalPages);

  if (count === 0) {
    return null;
  }

  if (hideWhenSinglePage && !hasPrevPage && !hasNextPage) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/70 px-3 py-2.5',
        className,
      )}>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground sm:text-sm'>
        {showSummary ? (
          <span>
            {labels?.totalLabel ?? 'Total'} {count}
          </span>
        ) : null}
        <span>
          {labels?.pageLabel ?? 'Page'} {resolvedPageNum} / {resolvedTotalPages}
        </span>
        {showPageSizeSelector && onPageSizeChange ? (
          <label className='flex items-center gap-2'>
            <span>{labels?.pageSizeLabel ?? 'Page size'}</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className='h-8 rounded-md border border-border/60 bg-background/80 px-2 text-xs text-foreground outline-none transition-colors hover:border-primary/40 sm:text-sm'>
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {isFetching ? (
          <span className='text-primary'>
            {labels?.loadingLabel ?? 'Loading...'}
          </span>
        ) : null}
      </div>

      <div className='flex items-center gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={onPrevPage}
          disabled={!hasPrevPage || isFetching}>
          <ChevronLeft className='h-4 w-4' />
          {labels?.previousLabel ?? 'Prev'}
        </Button>
        <div className='hidden items-center gap-1 sm:flex'>
          {Array.from({ length: resolvedTotalPages }, (_, index) => index + 1)
            .slice(
              Math.max(0, resolvedPageNum - 2),
              Math.max(0, resolvedPageNum - 2) + 3,
            )
            .map((itemPageNum) => (
              <Button
                key={itemPageNum}
                type='button'
                variant={itemPageNum === resolvedPageNum ? 'default' : 'ghost'}
                size='sm'
                onClick={() => onPageChange(itemPageNum)}
                disabled={isFetching}>
                {itemPageNum}
              </Button>
            ))}
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={onNextPage}
          disabled={!hasNextPage || isFetching}>
          {labels?.nextLabel ?? 'Next'}
          <ChevronRight className='h-4 w-4' />
        </Button>
      </div>
    </div>
  );
}

export function usePaginationQuery<
  TItem,
  TParams extends Record<string, any> = Record<string, never>,
  TRawData extends PaginationPayload<TItem> = PaginationPayload<TItem>,
>({
  queryKey,
  queryFn,
  params,
  enabled = true,
  initialPageNum = 1,
  initialPageSize = 10,
  keepPreviousResult = true,
  getPaginationData,
  pagination,
}: UsePaginationQueryOptions<TItem, TParams, TRawData>) {
  const [pageNum, setPageNum] = useState(initialPageNum);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  useEffect(() => {
    setPageNum(initialPageNum);
  }, [initialPageNum]);

  useEffect(() => {
    setPageSizeState(initialPageSize);
  }, [initialPageSize]);

  const requestParams = useMemo(
    () =>
      ({
        ...(params ?? ({} as TParams)),
        pageNum,
        pageSize,
      }) as TParams & PaginationParams,
    [params, pageNum, pageSize],
  );

  const query = useQuery({
    queryKey: [...queryKey, requestParams],
    queryFn: () => queryFn(requestParams),
    enabled,
    placeholderData: keepPreviousResult ? (data, previous) =>
      JSON.stringify(previous?.queryKey.slice(0, -1)) === JSON.stringify(queryKey)
        ? data : undefined : undefined,
  });

  const paginationData = useMemo(() => {
    if (!query.data) {
      return {
        list: [] as TItem[],
        count: 0,
      };
    }

    if (getPaginationData) {
      return getPaginationData(query.data, { size: pageSize, num: pageNum });
    }

    return query.data as PaginationPayload<TItem>;
  }, [getPaginationData, query.data]);

  const total = paginationData.count ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const hasPrevPage = pageNum > 1;
  const hasNextPage = totalPages > 0 && pageNum < totalPages;

  const setPageSize = (nextPageSize: number) => {
    setPageSizeState(nextPageSize);
    setPageNum(1);
  };

  const goToPage = (nextPageNum: number) => {
    if (nextPageNum < 1) {
      setPageNum(1);
      return;
    }

    if (totalPages > 0 && nextPageNum > totalPages) {
      setPageNum(totalPages);
      return;
    }

    setPageNum(nextPageNum);
  };

  const nextPage = () => {
    if (!hasNextPage) {
      return;
    }

    setPageNum((currentPageNum) => currentPageNum + 1);
  };

  const prevPage = () => {
    if (!hasPrevPage) {
      return;
    }

    setPageNum((currentPageNum) => Math.max(1, currentPageNum - 1));
  };

  const resetPagination = () => {
    setPageNum(initialPageNum);
    setPageSizeState(initialPageSize);
  };

  const paginationProps = useMemo<PaginationControlsProps>(
    () => ({
      pageNum,
      pageSize,
      count: total,
      totalPages,
      hasPrevPage,
      hasNextPage,
      isFetching: query.isFetching,
      onPageChange: goToPage,
      onPageSizeChange: setPageSize,
      onPrevPage: prevPage,
      onNextPage: nextPage,
      pageSizeOptions: pagination?.pageSizeOptions ?? [10, 20, 50],
      hideWhenSinglePage: pagination?.hideWhenSinglePage ?? true,
      showSummary: pagination?.showSummary ?? true,
      showPageSizeSelector: pagination?.showPageSizeSelector ?? true,
      labels: pagination?.labels,
    }),
    [
      hasNextPage,
      hasPrevPage,
      nextPage,
      pageNum,
      pageSize,
      pagination?.hideWhenSinglePage,
      pagination?.labels,
      pagination?.pageSizeOptions,
      pagination?.showPageSizeSelector,
      pagination?.showSummary,
      prevPage,
      query.isFetching,
      setPageSize,
      total,
      totalPages,
    ],
  );

  const Pagination = useMemo<ComponentType<{ className?: string }>>(
    () =>
      function PaginationComponent({ className }: { className?: string }) {
        return (
          <PaginationControls {...paginationProps} className={className} />
        );
      },
    [paginationProps],
  );

  return {
    ...query,
    rawData: query.data ?? null,
    list: paginationData.list ?? [],
    count: total,
    pageNum,
    pageSize,
    totalPages,
    hasPrevPage,
    hasNextPage,
    requestParams,
    setPageNum: goToPage,
    setPageSize,
    nextPage,
    prevPage,
    resetPagination,
    paginationProps,
    Pagination,
  };
}
