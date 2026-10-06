export interface PaginationParams {
  pageNum: number;
  pageSize: number;
}

export interface ChainIdParams {
  chainId: number;
}

export interface ChainAndAddressParams extends ChainIdParams {
  address: string;
}

export interface PaginatedResult<TItem = UnknownRecord> {
  list: TItem[];
  pageNum: number;
  pageSize: number;
  total: number;
}
