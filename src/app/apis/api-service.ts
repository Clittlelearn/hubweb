import { HttpFetch, HttpError } from './http-fetch';
import { OPENHIVE_ASSET_DECIMALS } from '@/app/constants/assets';
import { toUnitsAmount } from '@/app/lib/format';
import type {
  DashboardBlocksParams,
  DashboardBlocksResult,
  DashboardDataParams,
  DashboardDataResults,
} from '../types/api-service/dashboard';
import type {
  DelegateHistoryParams,
  DelegateHistoryResult,
  DelegatePageParams,
  DelegatePageResult,
  DelegatePositionsResult,
  DelegateRewardsParams,
  DelegateRewardsResult,
  DelegateTokensParams,
  DelegateTokensResult,
  DelegatedTokensResult,
  DelegateValidatorsParams,
  DelegateValidatorsResult,
} from '../types/api-service/delegate';
import type {
  FlowAssetsParams,
  FlowAssetsResult,
  FlowHistoryParams,
  FlowHistoryResult,
  FlowPageResult,
} from '../types/api-service/flow';
import type {
  GovernancePageParams,
  GovernancePageResult,
  GovernanceProposalsParams,
  GovernanceProposalsResult,
  GovernanceProposalDetailParams,
  GovernanceProposalDetailResult,
  GovernanceProposalVotesParams,
  GovernanceProposalVotesResult,
} from '../types/api-service/governance';
import type {
  LockHistoryParams,
  LockPageResult,
  LockPositionsResult,
  LockRewardsHistoryResult,
  LockUnlockHistoryResult,
  LockUserSummaryResult,
} from '../types/api-service/lock';
import type {
  StakingStakeInfoParams,
  StakingStakeInfoResult,
  StakingValidatorDetailParams,
  StakingValidatorDetailResult,
  StakingValidatorsParams,
  StakingValidatorsResult,
  ValidatorsDataParams,
  ValidatorsDataResult,
} from '../types/api-service/validators';
import type {
  WalletBindCustomTokenParams,
  WalletBindTokenParams,
  WalletPageParams,
  WalletPageResult,
  WalletRemoveTokenParams,
  WalletTokenCatalogParams,
  WalletTokenCatalogResult,
  WalletTokenMetadata,
  WalletTokenMetadataParams,
  WalletTokensReuslt,
  WalletTransactionsParams,
  WalletTransactionsResult,
  WalletWriteResult,
} from '../types/api-service/wallet';
import type {
  ChainAndAddressParams,
  ChainIdParams,
} from '../types/api-service/common';

interface ApiServiceResponse<TData> {
  code: number;
  message: string;
  data: TData;
  success?: boolean;
}

const TX_TYPE_LABELS: Record<string, string> = {
  '-1': 'Unknown',
  '0': 'Genesis',
  '1': 'Transfer',
  '2': 'Stake',
  '3': 'Unstake',
  '4': 'Delegate',
  '5': 'Undelegate',
  '6': 'Declaration',
  '7': 'Contract Deploy',
  '8': 'Contract Call',
  '9': 'Lock',
  '10': 'Unlock',
  '11': 'Proposal',
  '12': 'Revoke Proposal',
  '13': 'Vote',
  '98': 'Treasury Fund Claim',
  '99': 'Bonus',
  '100': 'Punishment',
  '101': 'Evidence',
};

function isChainAddress(value: unknown) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function sumValues(values: unknown[]) {
  try {
    return values.reduce<bigint>(
      (total, value) => total + BigInt(String(value ?? '0')),
      0n,
    );
  } catch {
    return 0n;
  }
}

const LOCK_DURATION_MS = 24 * 60 * 60 * 1000;
const LOCK_PERIOD = {
  periodId: 1,
  label: '24 hours',
  durationDays: 1,
  aprPct: '0',
  multiplier: '1',
  bonusPct: '0',
};

function rawInteger(value: unknown) {
  const text = String(value ?? '0').trim();
  return text.match(/^([+-]?\d+)\.0+$/)?.[1] ?? text;
}

function sumRawAmounts(rows: any[], field: string) {
  return rows.reduce((total: bigint, item: any) => {
    try {
      return total + BigInt(rawInteger(item?.[field]));
    } catch {
      return total;
    }
  }, 0n).toString();
}

function createLockToken(amount = '0', assetType = 'OHI') {
  return {
    name: assetType === 'OHI' ? 'HiveX' : assetType,
    symbol: assetType === 'OHI' ? 'OHI' : assetType,
    logoUrl: '',
    decimals: OPENHIVE_ASSET_DECIMALS,
    contractAddress: '',
    assetType,
    amount: rawInteger(amount),
  };
}

function isLockReady(startedAt: unknown, now = Date.now()) {
  const startedAtMs = normalizeTimestampMs(startedAt);
  return startedAtMs > 0 && startedAtMs + LOCK_DURATION_MS <= now;
}

function mapLockPosition(item: any) {
  const startedAt = normalizeTimestampMs(item.lock_time);
  const endsAt = startedAt ? startedAt + LOCK_DURATION_MS : 0;
  const canUnlock = !item.is_unlocked && isLockReady(item.lock_time);
  const elapsed = startedAt ? Date.now() - startedAt : 0;
  const progressPct = Math.max(
    0,
    Math.min(100, (elapsed / LOCK_DURATION_MS) * 100),
  );

  return {
    lockId: item.tx_hash,
    lockToken: createLockToken(item.lock_amount, item.asset_type),
    rewardToken: createLockToken('0', item.asset_type),
    period: LOCK_PERIOD,
    votingPower: rawInteger(item.lock_amount),
    status: canUnlock ? 'unlockable' : 'locked',
    startedAt,
    endsAt,
    progressPct,
    lockTxHash: item.tx_hash,
    unlockTxHash: item.unlock_tx_hash || '',
    canUnlock,
    canClaimRewards: false,
    canEarlyUnlock: false,
  };
}

function mapWalletTransactionRecord(item: any, account: string) {
  const txType = String(item.tx_type ?? '');
  const accountKey = account.toLowerCase();
  const utxos = Array.isArray(item.utxo) ? item.utxo : [];
  let assetType = 'OHI';
  let outgoing = 0n;
  let incoming = 0n;
  let counterparty = '';

  for (const utxo of utxos) {
    assetType = String(utxo?.assetType || assetType);
    const owner = Array.isArray(utxo?.owner) ? String(utxo.owner[0] ?? '') : '';
    const outputs = Array.isArray(utxo?.vout) ? utxo.vout : [];
    const realOutputs = outputs.filter((output: any) => isChainAddress(output?.addr));
    const ownerIsAccount = owner.toLowerCase() === accountKey;
    const receivedByAccount = realOutputs.filter(
      (output: any) => String(output.addr).toLowerCase() === accountKey,
    );

    if (ownerIsAccount) {
      const externalOutputs = realOutputs.filter(
        (output: any) => String(output.addr).toLowerCase() !== accountKey,
      );
      outgoing += sumValues(externalOutputs.map((output: any) => output.value));
      counterparty ||= String(externalOutputs[0]?.addr ?? '');
    } else if (receivedByAccount.length > 0) {
      incoming += sumValues(receivedByAccount.map((output: any) => output.value));
      counterparty ||= owner;
    }
  }

  // FUND and BONUS are protocol distributions. A normal TX (type 1) is
  // never a reward and must derive its direction from its UTXO outputs.
  const systemIncome = ['98', '99'].includes(txType);
  const direction = incoming > 0n || (systemIncome && outgoing === 0n) ? 'in' : 'out';
  const amount = direction === 'in' ? incoming : outgoing;
  const hasAmount = amount > 0n;

  return {
    txHash: item.tx_hash,
    txType,
    kind: TX_TYPE_LABELS[txType] ?? `Unknown transaction (${txType || '-'})`,
    status: 'success',
    direction,
    amount: amount.toString(),
    hasAmount,
    symbol: assetType === 'OHI' ? 'OHI' : 'ASSET',
    assetType,
    decimals: OPENHIVE_ASSET_DECIMALS,
    counterpartyRole: direction === 'in' ? 'From' : 'To',
    counterpartyAddress: counterparty,
    rawData: typeof item.utxo_raw === 'string'
      ? item.utxo_raw
      : JSON.stringify(utxos, null, 2),
    blockNumber: Number(item.block_height ?? 0),
    timestampMs: 0,
    contractName: '', contractAddress: '', methodName: '', methodId: '', from: '', to: '',
    blockHash: '', transactionIndex: 0, nonce: 0, value: '0', gasLimit: '0', gasUsed: '0',
    gasPrice: '0', maxFeePerGas: '0', maxPriorityFeePerGas: '0', effectiveGasPrice: '0',
    feeAmount: '0', feeSymbol: 'OHI', tokenTransfers: [], evm: {},
    gasCost: { native: { amount: '0', symbol: 'OHI', decimals: OPENHIVE_ASSET_DECIMALS }, custom: { isUsed: false, amount: '0', symbol: '', decimals: 0, contractAddress: '', assetType: '' } },
  };
}

export class ApiService extends HttpFetch {
  private static reads = new Map<string, Promise<any>>();
  private static metadataCache = new Map<string, { expires: number; data: any }>();
  private static metadataFailures = new Map<string, number>();
  private static metadataBackoff = new Map<string, number>();
  private readonly readScope: string;
  constructor(url: string, base: string) {
    super(url);
    this.base = base;
    this.readScope = url + base;
  }

  base = '';

  private async safeGet<T>(path: string, params: Record<string, any>, fallback: T): Promise<T> {
    try { return await this._get<T>(path, params); } catch { return fallback; }
  }

  async _post<TData = unknown>(path: string, param?: any): Promise<TData> {
    const res = await this.httpPost<ApiServiceResponse<TData>>(
      `${this.base}${path}`,
      param ?? {},
    );

    await new Promise((re) => {
      setTimeout(() => {
        re(true);
      }, 200);
    });
    console.log(res);

    if (res.code === 0 || res.success) {
      return res.data;
    }

    throw new Error(res.message);
  }

  async _get<TData = unknown>(
    path: string,
    param?: Record<string, any>,
  ): Promise<TData> {
    const key = JSON.stringify([this.readScope, path, param ?? {}]);
    const isMetadata = /^\/assets\/0x[\da-f]{40}\/metadata$/i.test(path);
    const cached = ApiService.metadataCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.data;
    if (isMetadata && ((ApiService.metadataFailures.get(key) ?? 0) > Date.now() ||
        (ApiService.metadataBackoff.get(this.readScope) ?? 0) > Date.now())) {
      if (cached) return cached.data;
      throw new Error('Token metadata temporarily unavailable. Retry later.');
    }
    const pending = ApiService.reads.get(key);
    if (pending) return pending;
    const request = this.httpGet<ApiServiceResponse<TData>>(`${this.base}${path}`, param).then(res => {
      if (res.code !== 0) throw Object.assign(new Error(res.message || 'Indexer request failed'), { apiCode: res.code });
      if (isMetadata) {
        if (ApiService.metadataCache.size >= 2048) {
          const oldest = ApiService.metadataCache.keys().next().value;
          if (oldest) ApiService.metadataCache.delete(oldest);
        }
        ApiService.metadataCache.set(key, { expires: Date.now() + 300_000, data: res.data });
      }
      return res.data;
    }).catch(error => {
      if (isMetadata) {
        if (ApiService.metadataFailures.size >= 512) ApiService.metadataFailures.clear();
        ApiService.metadataFailures.set(key, Date.now() + 30_000);
        // A missing route/proxy outage affects all tokens. Stop the current batch.
        // A JSON API error affects only this contract (e.g. a non-ERC20 contract).
        if (error instanceof HttpError || !('apiCode' in error)) {
          ApiService.metadataBackoff.set(this.readScope, Date.now() + 30_000);
        }
      }
      // A failed metadata refresh must not replace verified decimals with 18.
      if (cached) return cached.data;
      throw error;
    }).finally(() => ApiService.reads.delete(key));
    ApiService.reads.set(key, request);
    return request;
  }

  async _delete<TData = unknown>(
    path: string,
    param?: Record<string, any>,
  ): Promise<TData> {
    const res = await this.httpDeleteWithBody<ApiServiceResponse<TData>>(
      `${this.base}${path}`,
      param ?? {},
    );
    if (res.code === 0 || res.success) {
      return res.data;
    }
    throw new Error(res.message);
  }

  async dashboardData(params: DashboardDataParams): Promise<DashboardDataResults> {
    const [overview, txs, stakes, investments, proposals] = await Promise.all([
      this._get<any>('/stats/overview'),
      this.safeGet<any>('/txrecords', { page: 1, size: 500 }, { list: [], total: 0 }),
      this.safeGet<any>('/staking', { page: 1, size: 500, is_unstaked: 0 }, { list: [] }),
      this.safeGet<any>('/investments', { page: 1, size: 500, is_deinvested: 0 }, { list: [] }),
      this.safeGet<any>('/proposals', { page: 1, size: 500 }, { list: [] }),
    ]);
    const txList = txs.list ?? [];
    const blockHeight = txList.reduce(
      (max: number, item: any) => Math.max(max, Number(item.block_height ?? 0)),
      0,
    );
    const validatorAddresses = new Set<string>();
    for (const item of stakes.list ?? []) validatorAddresses.add(String(item.address ?? '').toLowerCase());
    for (const item of investments.list ?? []) validatorAddresses.add(String(item.bonus_addr ?? '').toLowerCase());
    validatorAddresses.delete('');
    const totalStakedRaw = [...(stakes.list ?? []), ...(investments.list ?? [])]
      .reduce((sum: bigint, item: any) => sum + BigInt(String(item.stake_amount ?? item.invest_amount ?? 0).split('.')[0] || '0'), 0n)
      .toString();
    const totalStaked = toUnitsAmount(
      totalStakedRaw,
      OPENHIVE_ASSET_DECIMALS,
    );
    const nowMicros = Date.now() * 1000;
    const activeProposalCount = (proposals.list ?? []).filter((item: any) => {
      const info = item.tx_info ?? {};
      return !item.is_revoked && (!info.endTime || Number(info.endTime) > nowMicros);
    }).length;
    const uniqueAddresses = new Set<string>();
    for (const item of txList) {
      for (const utxo of item.utxo ?? []) {
        for (const owner of utxo.owner ?? []) uniqueAddresses.add(String(owner).toLowerCase());
      }
    }
    const recentBlocks = this.mapTxRecordsToBlocks(txList).slice(0, 5);
    const totalTxs = Number(overview.total_txs ?? overview.business_counts?.tx_records ?? txs.total ?? txList.length);
    const totalSupply = '1000000000';
    return {
      network: { chainId: params.chainId, networkName: 'HiveX Devnet', isOnline: true, blockHeight, epoch: 0 },
      primaryStats: { totalSupply, currentEpoch: 0, totalSupplySymbol: 'OHI', totalSupplyChangePct: '0',
        circulatingSupply: '0', circulatingSupplySymbol: 'OHI', circulatingSupplyChangePct: '0', totalStaked,
        totalStakedSymbol: 'OHI', totalStakedChangePct: '0', activeValidatorCount: validatorAddresses.size,
        activeValidatorDelta: 0, totalVotingPower: totalStakedRaw, totalVotingPowerSymbol: 'OHI', activeProposalCount,
        networkTps: 0, uniqueAddressCount: uniqueAddresses.size },
      secondaryStats: { totalVotingPower: totalStakedRaw, totalVotingPowerSymbol: 'OHI', activeProposalCount,
        networkTps: 0, uniqueAddressCount: uniqueAddresses.size },
      charts: { tvl: [], dailyTransactions: [{ label: 'Current', txCount: totalTxs }], staking: [] },
      recentBlocks,
    } as DashboardDataResults;
  }

  async dashboardBlocks(
    params: DashboardBlocksParams,
  ): Promise<DashboardBlocksResult> {
    const data = await this.safeGet<any>('/txrecords', { page: params.pageNum, size: params.pageSize * 5 }, { list: [], total: 0 });
    const list = this.mapTxRecordsToBlocks(data.list ?? []).slice(0, params.pageSize);
    return { list, pageNum: params.pageNum, pageSize: params.pageSize, total: list.length };
  }

  private mapTxRecordsToBlocks(records: any[]): any[] {
    const blocks = new Map<number, any>();
    for (const item of records) {
      const height = Number(item.block_height ?? 0);
      if (!height) continue;
      const block = blocks.get(height) ?? { height, txCount: 0, timestampMs: 0, proposerName: '', proposerAddress: '', hash: item.tx_hash ?? '' };
      block.txCount += 1;
      blocks.set(height, block);
    }
    return [...blocks.values()].sort((a, b) => b.height - a.height);
  }

  async walletData(params: WalletPageParams): Promise<WalletPageResult> {
    const tokens = await this.walletTokens(params);
    return { overview: {
      totalBalance: tokens.list.find((item) => item.assetType === 'OHI')?.balance ?? '0',
      balanceSymbol: 'OHI', tokenCount: tokens.list.length, txsCount: 0,
    }};
  }

  async walletTokens(params: WalletPageParams): Promise<WalletTokensReuslt> {
    const [native, erc20, catalog] = await Promise.all([
      this._get<any>(`/balances/${params.address}`),
      this._get<any>(`/accounts/${params.address}/erc20-balances`),
      this._get<any>('/assets/catalog', { address: params.address }),
    ]);
    if (!Array.isArray(native.balances) || !Array.isArray(erc20.balances) || !Array.isArray(catalog.list)) {
      throw new Error('Invalid wallet balance response.');
    }
    // Native balances are keyed by proposal hash, not the backing ERC20 address.
    const nativeMeta = new Map<string, any>((catalog.list ?? [])
      .filter((item: any) => item.kind === 'proposal' && item.asset_type)
      .map((item: any) => [String(item.asset_type).toLowerCase(), item]));
    const erc20Meta = new Map<string, any>((catalog.list ?? [])
      .filter((item: any) => item.kind === 'erc20' && item.contract_address)
      .map((item: any) => [String(item.contract_address).toLowerCase(), item]));
    // Flowed-in ERC20s are native proposal assets.  Their balances come from
    // /balances and must never be rendered again as contract tokens.
    const localContractAddresses = new Set(
      (catalog.list ?? [])
        .filter((item: any) =>
          item.kind === 'proposal' &&
          item.contract_address &&
          (item.asset_type === 'OHI' || item.is_native_flow_active),
        )
        .map((item: any) => String(item.contract_address).toLowerCase()),
    );
    const base = (native.balances ?? []).map((item: any) => {
      const key = String(item.asset_type).toLowerCase();
      const info = nativeMeta.get(key) ?? {};
      return {
        tokenId: item.asset_type, name: item.asset_type === 'OHI' ? 'HiveX' : (decodeBase64(info.name) || item.asset_type),
        symbol: item.asset_type === 'OHI' ? 'OHI' : (decodeBase64(info.symbol) || decodeBase64(info.name) || 'ASSET'), logoUrl: '',
        balance: String(item.balance ?? '0'), decimals: OPENHIVE_ASSET_DECIMALS, contractAddress: '',
        assetType: item.asset_type, standard: 'NATIVE', ownerAddress: params.address,
        deployutxo: '', priceUsd: '0', valueUsd: '0', change24hPct: '0', isCustom: false,
      };
    });
    if (!base.some((item: any) => item.assetType === 'OHI')) base.unshift({
      tokenId: 'OHI', name: 'HiveX', symbol: 'OHI', logoUrl: '', balance: '0', decimals: OPENHIVE_ASSET_DECIMALS,
      contractAddress: '', assetType: 'OHI', standard: 'NATIVE', ownerAddress: params.address,
      deployutxo: '', priceUsd: '0', valueUsd: '0', change24hPct: '0', isCustom: false,
    });
    // Only this account's assets belong in its wallet, not the global catalog.
    const knownNativeAssetTypes = new Set(
      base.map((item: any) => String(item.assetType).toLowerCase()),
    );
    for (const item of catalog.list ?? []) {
      if (
        item.kind !== 'proposal' ||
        !item.is_added ||
        (item.asset_type !== 'OHI' && !item.is_native_flow_active)
      ) continue;
      const assetType = String(item.asset_type ?? item.asset_id ?? '');
      if (!assetType || knownNativeAssetTypes.has(assetType.toLowerCase())) continue;
      base.push({
        tokenId: item.asset_id ?? assetType,
        name: decodeBase64(item.name) || assetType,
        symbol: decodeBase64(item.symbol) || decodeBase64(item.name) || 'ASSET',
        logoUrl: '',
        balance: '0',
        decimals: OPENHIVE_ASSET_DECIMALS,
        contractAddress: '',
        assetType,
        standard: 'NATIVE',
        ownerAddress: params.address,
        deployutxo: '', priceUsd: '0', valueUsd: '0', change24hPct: '0', isCustom: false,
      });
      knownNativeAssetTypes.add(assetType.toLowerCase());
    }
    const contracts = (erc20.balances ?? [])
      .filter(
        (item: any) =>
          erc20Meta.get(String(item.contract_address ?? '').toLowerCase())?.is_added === true &&
          !localContractAddresses.has(String(item.contract_address ?? '').toLowerCase()),
      )
      .map((item: any) => {
      const info = erc20Meta.get(String(item.contract_address).toLowerCase()) ?? {};
      return {
        tokenId: item.contract_address, name: info.name || `Token ${String(item.contract_address).slice(0, 8)}`,
        symbol: info.symbol || 'TOKEN', logoUrl: '', balance: String(item.balance ?? '0'),
        decimals: Number(info.decimals ?? 18), contractAddress: item.contract_address, assetType: '',
        standard: 'ERC20', ownerAddress: params.address, deployutxo: '', priceUsd: '0', valueUsd: '0',
        change24hPct: '0', isCustom: true,
      };
      });
    await Promise.all(contracts.map(async (item: any) => {
      try {
        if (catalog.metadata_supported !== true) throw new Error('HubSQL metadata support requires a backend restart.');
        const metadata = await this._get<any>(`/assets/${item.contractAddress}/metadata`);
        if (metadata.name && metadata.symbol && Number.isInteger(metadata.decimals) && metadata.decimals >= 0 && metadata.decimals <= 255) {
          item.name = metadata.name; item.symbol = metadata.symbol; item.decimals = metadata.decimals;
        } else throw new Error('Invalid token metadata');
      } catch {
        if (item.symbol === 'TOKEN') throw new Error('Token metadata unavailable. Balances could not be refreshed safely.');
      }
    }));
    return { list: [...base, ...contracts] } as WalletTokensReuslt;
  }

  async walletTransactions(
    params: WalletTransactionsParams,
  ): Promise<WalletTransactionsResult> {
    const data = await this.safeGet<any>('/txrecords', { page: params.pageNum, size: params.pageSize }, { list: [], total: 0 });
    return {
      list: (data.list ?? []).map((item: any) => mapWalletTransactionRecord(item, params.address)),
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      total: Number(data.total ?? 0),
    } as WalletTransactionsResult;
  }

  async walletTokenCatalog(
    params: WalletTokenCatalogParams,
  ): Promise<WalletTokenCatalogResult> {
    const data = await this.walletTokenCatalogEntries(params);
    const keyword = params.keyword?.trim().toLowerCase() ?? '';
    const matches = data.list.filter(item =>
      [item.name, item.symbol, item.contractAddress, item.tokenId].some(value =>
        String(value ?? '').toLowerCase().includes(keyword)));
    const start = (params.pageNum - 1) * params.pageSize;
    return { ...data, list: matches.slice(start, start + params.pageSize), total: matches.length,
      pageNum: params.pageNum, pageSize: params.pageSize };
  }

  async walletTokenCatalogEntries(params: ChainAndAddressParams): Promise<WalletTokenCatalogResult> {
    return this._get<any>('/assets/catalog', { address: params.address }).then(data => {
      const entries = data.list ?? [];
      const localContracts = new Set(
        entries
          .filter((item: any) =>
            item.kind === 'proposal' &&
            item.contract_address &&
            (item.asset_type === 'OHI' || item.is_native_flow_active),
          )
          .map((item: any) => String(item.contract_address).toLowerCase()),
      );
      const contracts = entries.filter((item: any) => item.kind === 'erc20');
      const metadataSupported = data.metadata_supported === true;
      // Never wait for RPC-backed metadata before returning the indexed directory.
      const list = contracts.map((entry: any) => {
        const key = JSON.stringify([this.readScope, `/assets/${entry.contract_address}/metadata`, {}]);
        const cached = ApiService.metadataCache.get(key);
        const item = { ...entry, ...(cached?.data ?? {}) };
        return { tokenId: item.asset_id, contractAddress: item.contract_address,
          name: item.name || item.asset_id, symbol: item.symbol || 'TOKEN', logoUrl: '',
          decimals: Number(item.decimals ?? 18), assetType: item.asset_type, standard: 'ERC20',
          isVerified: Boolean(cached && cached.expires > Date.now()), isAdded: Boolean(item.is_added),
          isNativeAsset: localContracts.has(String(item.contract_address ?? '').toLowerCase()),
          listSource: 'catalog' };
      });
      return {
        list, pageNum: 1, pageSize: list.length, total: list.length, metadataSupported,
        metadataWarning: !metadataSupported
          ? 'HubSQL is running without token metadata support. Restart the updated HubSQL service to load token names.'
          : (ApiService.metadataBackoff.get(this.readScope) ?? 0) > Date.now()
            ? 'Some token metadata is unavailable. Names and search results may be incomplete; retry later.' : undefined,
      } as WalletTokenCatalogResult;
    });
  }

  async enrichWalletTokenCatalog(
    entries: WalletTokenCatalogResult['list'], signal: AbortSignal,
    onEntry: (entry: WalletTokenCatalogResult['list'][number], failed: boolean) => void,
  ) {
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
      while (!signal.aborted && cursor < entries.length &&
          (ApiService.metadataBackoff.get(this.readScope) ?? 0) <= Date.now()) {
        const entry = entries[cursor++];
        if (entry.isVerified) continue;
        try {
          const metadata = await this._get<any>(`/assets/${entry.contractAddress}/metadata`);
          if (!metadata.name || !metadata.symbol || !Number.isInteger(metadata.decimals) ||
              metadata.decimals < 0 || metadata.decimals > 255) throw new Error('Invalid token metadata');
          if (!signal.aborted) onEntry({ ...entry, name: metadata.name, symbol: metadata.symbol,
            decimals: metadata.decimals, isVerified: true }, false);
        } catch {
          if (!signal.aborted) onEntry(entry, true);
        }
      }
    }));
    return { unavailable: (ApiService.metadataBackoff.get(this.readScope) ?? 0) > Date.now() };
  }

  walletTokenMetadata(
    params: WalletTokenMetadataParams,
  ): Promise<WalletTokenMetadata> {
    return this._get<any>('/assets/catalog', { address: params.address }).then(async (data) => {
      const entries = data.list ?? [];
      const contractAddress = params.contractAddress.toLowerCase();
      if (entries.some((entry: any) =>
        entry.kind === 'proposal' &&
        (entry.asset_type === 'OHI' || entry.is_native_flow_active) &&
        String(entry.contract_address ?? '').toLowerCase() === contractAddress,
      )) {
        throw new Error('This is a native Flow asset and is already managed in your wallet.');
      }
      const item = entries.find((entry: any) =>
        entry.kind === 'erc20' &&
        String(entry.contract_address).toLowerCase() === contractAddress,
      );
      if (!item) throw new Error('Token contract not found');
      if (data.metadata_supported !== true) throw new Error('HubSQL metadata support requires a backend restart.');
      const metadata = await this._get<any>(`/assets/${contractAddress}/metadata`);
      return { tokenId: item.asset_id, contractAddress: item.contract_address, name: metadata.name,
        symbol: metadata.symbol, logoUrl: '', decimals: Number(metadata.decimals), assetType: item.asset_type,
        standard: item.kind === 'erc20' ? 'ERC20' : 'NATIVE', isVerified: true, isAdded: Boolean(item.is_added), priceUsd: '0' };
    });
  }

  walletBindToken(params: WalletBindTokenParams): Promise<WalletWriteResult> {
    return this._post<any>(`/accounts/${params.address}/erc20-contracts`, { contract_address: params.contractAddress })
      .then(() => ({ success: true, contractAddress: params.contractAddress }));
  }

  walletRemoveToken(
    contractAddress: string,
    params: WalletRemoveTokenParams,
  ): Promise<WalletWriteResult> {
    return this._delete<any>(`/accounts/${params.address}/erc20-contracts/${contractAddress}`)
      .then(() => ({ success: true, contractAddress }));
  }

  walletBindCustomToken(
    params: WalletBindCustomTokenParams,
  ): Promise<WalletWriteResult> {
    return this._post<any>(`/accounts/${params.address}/erc20-contracts`, { contract_address: params.contractAddress })
      .then(() => ({ success: true, contractAddress: params.contractAddress }));
  }

  walletRemoveCustomToken(
    contractAddress: string,
    params: ChainAndAddressParams,
  ): Promise<WalletWriteResult> {
    return this._delete<any>(`/accounts/${params.address}/erc20-contracts/${contractAddress}`)
      .then(() => ({ success: true, contractAddress }));
  }

  stakingData(params: ValidatorsDataParams): Promise<ValidatorsDataResult> {
    return this._get<ValidatorsDataResult>('/staking/page', params);
  }

  stakingValidators(
    params: StakingValidatorsParams,
  ): Promise<StakingValidatorsResult> {
    return this._get<StakingValidatorsResult>('/staking/validators', params);
  }

  async stakingValidatorDetail(
    validatorId: string,
    params: StakingValidatorDetailParams,
  ): Promise<StakingValidatorDetailResult> {
    const validators = await this.delegateValidators({
      chainId: params.chainId,
      status: 'all',
      pageNum: 1,
      pageSize: 500,
    });
    const item = validators.list.find((entry) => String(entry.validatorId) === validatorId);
    if (!item) throw new Error('Validator not found');
    return {
      ...item,
      operatorAddress: item.address,
      identityName: item.name,
      identityVerified: false,
      selfStakeCurrency: 'OHI',
      totalStakedCurrency: 'OHI',
      totalStakedUsd: '0',
      supportedStakeTokens: [{ tokenId: 'OHI', symbol: 'OHI', assetType: 'OHI', logoUrl: '' }],
      stakeTokenCount: 1,
      delegatorRewardsUsd24h: '0',
      slashCount30d: 0,
      proposedBlockCount24h: 0,
      version: '',
      updatedAt: item.lastActiveAt ?? 0,
      canStake: true,
    } as StakingValidatorDetailResult;
  }

  stakingStakeInfo(
    params: StakingStakeInfoParams,
  ): Promise<StakingStakeInfoResult> {
    return this._get<StakingStakeInfoResult>('/staking/stake-info', params);
  }

  async delegateValidators(
    params: DelegateValidatorsParams,
  ): Promise<DelegateValidatorsResult> {
    const [stakes, investments] = await Promise.all([
      this.safeGet<any>('/staking', { page: 1, size: 500, is_unstaked: 0 }, { list: [] }),
      this.safeGet<any>('/investments', { page: 1, size: 500, is_deinvested: 0 }, { list: [] }),
    ]);
    const validators = new Map<string, any>();
    for (const stake of stakes.list ?? []) {
      const address = stake.address;
      validators.set(address, { validatorId: validatorIdFromAddress(address), name: `Validator ${String(address).slice(2, 8)}`, address,
        logoUrl: '', status: stake.is_unstaked ? 'inactive' : 'active', description: '', website: '', delegatorCount: 0,
        commissionRatePct: String(stake.commission_rate ?? 0), apyPct: '0', totalStaked: String(stake.amount ?? stake.stake_amount ?? 0),
        delegatedStake: '0', selfStake: String(stake.amount ?? stake.stake_amount ?? 0), performancePct: '100', uptimePct: '100',
        online: !stake.is_unstaked, lastActiveAt: Number(stake.time ?? stake.stake_time ?? 0) });
    }
    for (const investment of investments.list ?? []) {
      const address = investment.bonus_addr || investment.address;
      const current = validators.get(address) ?? { validatorId: validatorIdFromAddress(address), name: `Validator ${String(address).slice(2, 8)}`, address,
        logoUrl: '', status: 'active', description: '', website: '', delegatorCount: 0, commissionRatePct: '0', apyPct: '0',
        totalStaked: '0', delegatedStake: '0', selfStake: '0', performancePct: '100', uptimePct: '100', online: true, lastActiveAt: null };
      current.delegatorCount += 1;
      current.delegatedStake = (BigInt(String(current.delegatedStake).split('.')[0] || '0') + BigInt(String(investment.amount ?? investment.invest_amount ?? 0).split('.')[0] || '0')).toString();
      current.totalStaked = (BigInt(String(current.selfStake).split('.')[0] || '0') + BigInt(current.delegatedStake)).toString();
      validators.set(address, current);
    }
    const list = [...validators.values()].map((item, index) => ({ ...item, rank: index + 1 }));
    return { list: list.slice((params.pageNum - 1) * params.pageSize, params.pageNum * params.pageSize),
      pageNum: params.pageNum, pageSize: params.pageSize, total: list.length } as DelegateValidatorsResult;
  }

  async delegatePage(params: DelegatePageParams): Promise<DelegatePageResult> {
    const [validators, tokens, positions, rewards] = await Promise.all([
      this.delegateValidators({ chainId: params.chainId, pageNum: 1, pageSize: 100, status: 'all' }),
      this.walletTokens(params), this.delegatePositions({ ...params, pageNum: 1, pageSize: 100 }),
      this.delegateRewards({ ...params, pageNum: 1, pageSize: 500 }),
    ]);
    const totalRewards = rewards.list.reduce(
      (sum, item) => sum + BigInt(String(item.rewardToken.amount ?? 0).split('.')[0] || '0'),
      0n,
    ).toString();
    return { networkStats: { activeValidatorCount: validators.total, totalDelegatorsCount: validators.list.reduce((n, v) => n + v.delegatorCount, 0),
      totalDelegated: validators.list.reduce((n, v) => n + BigInt(String(v.delegatedStake).split('.')[0] || '0'), 0n).toString(), totalDelegatedSymbol: 'OHI' },
      delegateTokens: tokens.list.map((t) => ({ tokenId: t.tokenId, name: t.name, symbol: t.symbol, logoUrl: t.logoUrl,
        contractAddress: t.contractAddress, assetType: t.assetType, decimals: t.decimals, balance: t.balance })),
      topValidators: validators.list.slice(0, 5), userSummary: { availableBalance: tokens.list[0]?.balance ?? '0', availableBalanceSymbol: 'OHI',
        totalDelegated: positions.summary.totalDelegated, totalDelegatedSymbol: 'OHI', positionCount: positions.total,
        validatorCount: positions.summary.validatorCount, totalRewards, totalRewardsSymbol: 'OHI' } } as DelegatePageResult;
  }

  delegateTokens(params: DelegateTokensParams): Promise<DelegateTokensResult> {
    return this._get<DelegateTokensResult>('/delegate/tokens', params);
  }

  delegatedTokens(
    params: DelegateTokensParams,
  ): Promise<DelegatedTokensResult> {
    return this.walletTokens(params as DelegatePageParams).then((data) => ({ list: data.list.map((t) => ({
      tokenId: t.tokenId, name: t.name, symbol: t.symbol, logoUrl: t.logoUrl, contractAddress: t.contractAddress,
      assetType: t.assetType, decimals: t.decimals, balance: t.balance,
    })) }) as DelegatedTokensResult);
  }

  async delegatePositions(
    params: DelegateHistoryParams,
  ): Promise<DelegatePositionsResult> {
    const data = await this._get<any>('/investments', { address: params.address, is_deinvested: 0, page: params.pageNum, size: params.pageSize });
    const list = (data.list ?? []).filter((item: any) => ![true, 1, '1', 'true'].includes(item.is_deinvested)).map((item: any) => ({ positionId: item.tx_hash, validator: { validatorId: validatorIdFromAddress(item.bonus_addr),
      name: `Validator ${String(item.bonus_addr || '').slice(2, 8)}`, address: item.bonus_addr, logoUrl: '', status: item.is_deinvested ? 'inactive' : 'active',
      description: '', commissionRatePct: '0', apyPct: '0', performancePct: '100', uptimePct: '100' },
      delegateToken: { tokenId: 'OHI', name: 'HiveX', symbol: 'OHI', logoUrl: '', decimals: OPENHIVE_ASSET_DECIMALS, contractAddress: '', assetType: 'OHI',
        amount: String(item.amount ?? item.invest_amount ?? 0) }, rewardAmount: '0', rewardSymbol: 'OHI', delegateTxHash: item.tx_hash,
      delegatedAt: normalizeTimestampMs(item.time ?? item.invest_time) }));
    const total = list.reduce((n: bigint, item: any) => n + BigInt(String(item.delegateToken.amount).split('.')[0] || '0'), 0n).toString();
    return { list, pageNum: params.pageNum, pageSize: params.pageSize, total: Number(data.total ?? list.length),
      summary: { totalDelegated: total, totalDelegatedSymbol: 'OHI', positionCount: list.length,
        validatorCount: new Set(list.map((i: any) => i.validator.address)).size, totalRewards: '0', totalRewardsSymbol: 'OHI' } } as DelegatePositionsResult;
  }

  delegateHistory(
    params: DelegateHistoryParams,
  ): Promise<DelegateHistoryResult> {
    return this._get<DelegateHistoryResult>('/delegate/history', params);
  }

  async delegateRewards(
    params: DelegateRewardsParams,
  ): Promise<DelegateRewardsResult> {
    const data = await this.safeGet<any>('/claims', { address: params.address, page: params.pageNum, size: params.pageSize }, { list: [], total: 0 });
    return { list: (data.list ?? []).map((item: any) => ({ rewardId: item.tx_hash, positionId: '', validator: { validatorId: validatorIdFromAddress(item.address),
      name: `Account ${String(item.address).slice(2, 8)}`, address: item.address, logoUrl: '', status: 'active', description: '', commissionRatePct: '0',
      apyPct: '0', performancePct: '100', uptimePct: '100' }, rewardToken: { tokenId: item.asset_type, name: item.asset_type,
      symbol: item.asset_type, logoUrl: '', decimals: OPENHIVE_ASSET_DECIMALS, contractAddress: '', assetType: item.asset_type, amount: String(item.amount ?? item.claim_amount ?? 0) },
      claimedAt: normalizeTimestampMs(item.time ?? item.claim_time), txHash: item.tx_hash, txType: 99 })),
      pageNum: params.pageNum, pageSize: params.pageSize, total: Number(data.total ?? 0) } as DelegateRewardsResult;
  }

  async lockData(_params: ChainIdParams): Promise<LockPageResult> {
    const data = await this.safeGet<any>(
      '/locks',
      { page: 1, size: 1000 },
      { list: [] },
    );
    const rows = data.list ?? [];
    const activeRows = rows.filter((item: any) => !item.is_unlocked);
    const now = Date.now();
    const oneDayAgo = now - LOCK_DURATION_MS;
    const unlockedLast24Hours = rows.filter((item: any) => {
      if (!item.is_unlocked) return false;
      const unlockedAt = normalizeTimestampMs(item.unlock_time);
      return unlockedAt >= oneDayAgo && unlockedAt <= now;
    });

    return {
      networkOverview: {
        totalLockedAmount: sumRawAmounts(activeRows, 'lock_amount'),
        lockedSymbol: 'OHI',
        totalLockedUsd: '0',
        lockedCurrency: 'USD',
        totalVotingPower: sumRawAmounts(activeRows, 'lock_amount'),
        votingPowerSymbol: 'OHI',
        totalRewardAmount: '0',
        rewardSymbol: 'OHI',
        activeLockCount: activeRows.length,
        readyToUnlockCount: activeRows.filter((item: any) =>
          isLockReady(item.lock_time, now),
        ).length,
        totalUnlockedAmount24h: sumRawAmounts(
          unlockedLast24Hours,
          'lock_amount',
        ),
        totalUnlockedUsd24h: '0',
      },
      lockAsset: createLockToken(),
    } as LockPageResult;
  }

  async lockUserSummary(
    params: ChainAndAddressParams,
  ): Promise<LockUserSummaryResult> {
    const [tokens, locks] = await Promise.all([
      this.walletTokens(params as WalletPageParams),
      this.safeGet<any>(
        '/locks',
        { address: params.address, is_unlocked: 0, page: 1, size: 1000 },
        { list: [] },
      ),
    ]);
    const activeRows = (locks.list ?? []).filter(
      (item: any) => !item.is_unlocked,
    );
    const availableBalance =
      tokens.list.find((item) => item.assetType === 'OHI')?.balance ?? '0';
    const totalLockedAmount = sumRawAmounts(activeRows, 'lock_amount');

    return {
      lockAsset: createLockToken(),
      userOverview: {
        availableBalance,
        availableBalanceSymbol: 'OHI',
        totalLockedAmount,
        totalLockedUsd: '0',
        lockedSymbol: 'OHI',
        totalVotingPower: totalLockedAmount,
        votingPowerSymbol: 'OHI',
        claimableRewardAmount: '0',
        rewardSymbol: 'OHI',
        readyToUnlockCount: activeRows.filter((item: any) =>
          isLockReady(item.lock_time),
        ).length,
        claimableLockCount: 0,
      },
    } as LockUserSummaryResult;
  }

  async lockPositions(
    params: ChainAndAddressParams,
  ): Promise<LockPositionsResult> {
    const data = await this.safeGet<any>(
      '/locks',
      { address: params.address, is_unlocked: 0, page: 1, size: 1000 },
      { list: [] },
    );

    return {
      list: (data.list ?? [])
        .filter((item: any) => !item.is_unlocked)
        .map((item: any) => mapLockPosition(item)),
    } as LockPositionsResult;
  }

  async lockRewardsHistory(
    params: LockHistoryParams,
  ): Promise<LockRewardsHistoryResult> {
    return {
      list: [],
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      total: 0,
    } as LockRewardsHistoryResult;
  }

  async lockUnlockHistory(
    params: LockHistoryParams,
  ): Promise<LockUnlockHistoryResult> {
    const data = await this.safeGet<any>(
      '/unlockedlocks',
      {
        address: params.address,
        page: params.pageNum,
        size: params.pageSize,
      },
      { list: [], total: 0 },
    );

    return {
      list: (data.list ?? []).map((item: any) => ({
        unlockHistoryId: item.unlock_tx_hash || item.tx_hash,
        lockId: item.tx_hash,
        lockToken: createLockToken(item.lock_amount, item.asset_type),
        rewardToken: createLockToken('0', item.asset_type),
        period: LOCK_PERIOD,
        startedAt: normalizeTimestampMs(item.lock_time),
        unlockedAt: normalizeTimestampMs(item.unlock_time),
        unlockTxHash: item.unlock_tx_hash || '',
      })),
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      total: Number(data.total ?? 0),
    } as LockUnlockHistoryResult;
  }

  async governanceData(params: GovernancePageParams): Promise<GovernancePageResult> {
    const hasAccount = isChainAddress(params.address);
    const [proposals, locks, votes] = await Promise.all([
      this.governanceProposals({ ...params, pageNum: 1, pageSize: 50 }),
      hasAccount
        ? this.safeGet<any>(
            '/locks',
            {
              address: params.address,
              is_unlocked: 0,
              page: 1,
              size: 1000,
            },
            { list: [] },
          )
        : Promise.resolve({ list: [] }),
      hasAccount
        ? this.safeGet<any>(
            '/votes',
            { address: params.address, page: 1, size: 1000 },
            { list: [], total: 0 },
          )
        : Promise.resolve({ list: [], total: 0 }),
    ]);
    const activeLocks = (locks.list ?? []).filter(
      (item: any) => !item.is_unlocked,
    );
    const votingPower = sumRawAmounts(activeLocks, 'lock_amount');

    return { summary: { votingPower, votingPowerSymbol: 'OHI', votedProposalCount: Number(votes.total ?? votes.list?.length ?? 0),
      activeProposalCount: proposals.proposals.filter((p) => p.status === 'active').length,
      passedProposalCount: proposals.proposals.filter((p) => p.status === 'passed').length,
      rejectedProposalCount: proposals.proposals.filter((p) => p.status === 'canceled').length,
      canCreateProposal: BigInt(votingPower) > 0n, proposalThreshold: '0' }, recentProposals: [] };
  }

  async governanceProposals(
    params: GovernanceProposalsParams,
  ): Promise<GovernanceProposalsResult> {
    // Proposals are chain-wide governance data, not account-scoped records.
    const data = await this.safeGet<any>('/proposals', { page: params.pageNum, size: params.pageSize }, { list: [] });
    const proposals = await Promise.all((data.list ?? []).map(async (item: any) => {
      let info: any = {}; try { info = typeof item.tx_info === 'string' ? JSON.parse(item.tx_info) : (item.tx_info ?? {}); } catch {}
      const voteAsset = item.asset === 'OHI' ? '0xOHI' : item.asset;
      const votes = await this.safeGet<any>('/votes', { proposal_hash: voteAsset, page: 1, size: 500 }, { list: [] });
      // A separate account-filtered lookup also finds votes beyond the totals page.
      const accountVotes = isChainAddress(params.address)
        ? await this.safeGet<any>('/votes', { proposal_hash: voteAsset, address: params.address, page: 1, size: 1 }, { list: null })
        : { list: [] };
      const userVote = accountVotes.list?.find((vote: any) =>
        String(vote.address).replace(/^0x/i, '').toLowerCase() === params.address?.replace(/^0x/i, '').toLowerCase());
      const yes = (votes.list ?? []).filter((v: any) => Number(v.vote_type) === 1).reduce((n: number, v: any) => n + Number(v.vote_number ?? 0), 0);
      const no = (votes.list ?? []).filter((v: any) => Number(v.vote_type) !== 1).reduce((n: number, v: any) => n + Number(v.vote_number ?? 0), 0);
      const total = yes + no;
      const nowMs = Date.now();
      const beginTimeMs = normalizeTimestampMs(info.beginTime);
      const endTimeMs = normalizeTimestampMs(info.endTime);
      const active = !item.is_revoked &&
        (!beginTimeMs || beginTimeMs <= nowMs) &&
        (!endTimeMs || endTimeMs > nowMs);
      const minVoteNum = Number(info.minVoteNum ?? 0);
      // OHI is the chain's initial proposal.  Its later revoke marker is a
      // lifecycle operation, not a failed vote; it remains a passed proposal.
      const passed = item.asset === 'OHI' ||
        (!item.is_revoked && !active && yes >= minVoteNum && yes > no);
      const proposalName = decodeBase64(info.name) || item.asset;
      const decodedTitle = decodeBase64(info.title);
      const title = decodedTitle && !/^\d+$/.test(decodedTitle) ? decodedTitle : proposalName;
      return { id: item.tx_hash, proposalHash: item.asset, title,
        tokenName: decodeBase64(info.name), assetType: item.asset,
        tokenContractAddress: String(info.tokenContractAddr ?? ''), proposalTransactionHash: item.tx_hash,
        name: proposalName, type: String(info.crossChainTxType ?? 'proposal'), isRevoke: Boolean(item.is_revoked),
        proposerAddress: item.address, revokerAddress: null, originalProposalHash: null, totalVotes: total, yesVotes: yes, noVotes: no,
        yesPercentage: total ? yes * 100 / total : 0, noPercentage: total ? no * 100 / total : 0,
        endTime: endTimeMs ? new Date(endTimeMs).toISOString().slice(0, 10) : '', status: active ? 'active' : passed ? 'passed' : 'canceled',
        revokeBeginTime: null, isEnded: !active, isVoted: Boolean(userVote),
        voteStatusKnown: Array.isArray(accountVotes.list),
        votedType: userVote ? (Number(userVote.vote_type) === 1 ? 'for' : 'against') : null };
    }));
    return { proposals: proposals.filter((proposal) => !params.status || params.status === 'all' || proposal.status === params.status) };
  }

  governanceProposalDetail(
    proposalId: string,
    params: GovernanceProposalDetailParams,
  ): Promise<GovernanceProposalDetailResult> {
    return this.governanceProposals({ ...params, pageNum: 1, pageSize: 500 }).then((data) => {
      const proposal = data.proposals.find((item) => item.id === proposalId || item.proposalHash === proposalId);
      if (!proposal) throw new Error('Proposal not found');
      return { proposalId: proposal.id, hash: proposal.proposalHash, type: proposal.type, title: proposal.title,
        tokenName: proposal.tokenName, assetType: proposal.assetType,
        tokenContractAddress: proposal.tokenContractAddress, proposalTransactionHash: proposal.proposalTransactionHash,
        status: proposal.status, proposerAddress: proposal.proposerAddress, totalVotes: proposal.totalVotes,
        yesVotes: proposal.yesVotes, noVotes: proposal.noVotes, startTime: 0, endTime: proposal.endTime ? Date.parse(proposal.endTime) : 0,
        isVoted: proposal.isVoted, votedType: proposal.votedType, voteStatusKnown: proposal.voteStatusKnown,
        createdAt: 0 } as GovernanceProposalDetailResult;
    });
  }

  governanceProposalVotes(
    proposalId: string,
    params: GovernanceProposalVotesParams,
  ): Promise<GovernanceProposalVotesResult> {
    const voteHash = proposalId === 'OHI' ? '0xOHI' : proposalId;
    return this.safeGet<any>('/votes', { proposal_hash: voteHash, page: params.pageNum, size: params.pageSize }, { list: [], total: 0 })
      .then((data) => ({ list: (data.list ?? []).map((item: any) => ({ voteId: item.tx_hash, voterAddress: item.address,
        voteType: Number(item.vote_type) === 1 ? 'for' : 'against', voteAmount: String(item.vote_number ?? 0),
        votedAt: 0, txHash: item.tx_hash })), pageNum: params.pageNum, pageSize: params.pageSize,
        total: Number(data.total ?? 0) } as GovernanceProposalVotesResult));
  }

  async flowData(params: ChainIdParams): Promise<FlowPageResult> {
    const [contracts, catalog] = await Promise.all([
      this.safeGet<any>('/contracts', { page: 1, size: 500 }, { list: [] }),
      this.safeGet<any>('/assets/catalog', {}, { list: [] }),
    ]);
    const flowIn = (contracts.list ?? []).filter((i: any) => i.is_flow_in);
    const flowOut = (contracts.list ?? []).filter((i: any) => i.is_flow_out);
    const activeAssets = (catalog.list ?? []).filter(
      (item: any) => item.kind === 'proposal' &&
        item.asset_type !== 'OHI' && item.is_native_flow_active,
    );
    return { stats: { totalFlowIn: flowIn.reduce((n: bigint, i: any) => n + BigInt(String(i.flow_in_amount ?? 0).split('.')[0]), 0n).toString(),
      totalFlowOut: flowOut.reduce((n: bigint, i: any) => n + BigInt(String(i.flow_out_amount ?? 0).split('.')[0]), 0n).toString(),
      netFlow: '0', flowableAssetCount: activeAssets.length }, assets: [] };
  }

  async flowAssets(params: FlowAssetsParams): Promise<FlowAssetsResult> {
    const [catalog, erc20Balances, nativeBalances] =
      await Promise.all([
        this.safeGet<any>(
          '/assets/catalog',
          { address: params.address },
          { list: [] },
        ),
        this.safeGet<any>(
          `/accounts/${params.address}/indexed-erc20-balances`,
          {},
          { balances: [] },
        ),
        this.safeGet<any>(
          `/balances/${params.address}`,
          {},
          { balances: [] },
        ),
      ]);

    const catalogRows = catalog.list ?? [];
    const proposalByContract = new Map<string, any>();
    for (const row of catalogRows) {
      const contractAddress = String(row.contract_address ?? '').toLowerCase();
      if (
        row.kind === 'proposal' &&
        row.asset_type !== 'OHI' &&
        row.is_native_flow_active === true &&
        isChainAddress(contractAddress)
      ) {
        proposalByContract.set(contractAddress, row);
      }
    }

    const erc20CatalogByContract = new Map<string, any>();
    for (const row of catalogRows) {
      if (row.kind !== 'erc20') continue;
      const contractAddress = String(row.contract_address ?? '').toLowerCase();
      if (isChainAddress(contractAddress)) {
        erc20CatalogByContract.set(contractAddress, row);
      }
    }

    const erc20BalanceByContract = new Map<string, string>(
      (erc20Balances.balances ?? []).map((item: any) => [
        String(item.contract_address ?? '').toLowerCase(),
        String(item.balance ?? '0'),
      ]),
    );
    const nativeBalanceByAsset = new Map<string, string>(
      (nativeBalances.balances ?? []).map((item: any) => [
        String(item.asset_type ?? '').toLowerCase(),
        String(item.balance ?? '0'),
      ]),
    );

    // hubsql mirrors the chain's Native Flow registry while parsing blocks.
    // ERC20 association and historical calls must not bypass governance state.
    const contractAddresses = new Set<string>(proposalByContract.keys());

    const list = [...contractAddresses].map((contractAddress) => {
      const proposal = proposalByContract.get(contractAddress);
      const erc20 = erc20CatalogByContract.get(contractAddress);
      const assetType = String(proposal.asset_type);
      const name =
        decodeBase64(proposal?.name) ||
        decodeBase64(erc20?.name) ||
        assetType;
      const symbol =
        decodeBase64(proposal?.symbol) ||
        decodeBase64(erc20?.symbol) ||
        name;
      return {
        assetId: assetType,
        name,
        assetName: name,
        symbol,
        logoUrl: '',
        contractAddress,
        assetType,
        decimals: Number(proposal?.decimals ?? erc20?.decimals ?? 18),
        assetDecimals: OPENHIVE_ASSET_DECIMALS,
        isEnabled: true,
        exchangeRate: '1',
        erc20Balance: erc20BalanceByContract.get(contractAddress) ?? '0',
        flowBalance:
          nativeBalanceByAsset.get(assetType.toLowerCase()) ?? '0',
        canFlowIn: true,
        canFlowOut: true,
      };
    });
    return { list, defaultAssetId: list[0]?.assetId ?? '' };
  }

  async flowHistory(params: FlowHistoryParams): Promise<FlowHistoryResult> {
    const data = await this.safeGet<any>('/contracts', { address: params.address, page: params.pageNum, size: params.pageSize }, { list: [], total: 0 });
    const catalog = await this.safeGet<any>('/assets/catalog', {}, { list: [] });
    const proposals = new Map<string, any>((catalog.list ?? [])
      .filter((item: any) => item.kind === 'proposal')
      .map((item: any) => [String(item.asset_type).toLowerCase(), item]));
    return { list: (data.list ?? []).filter((i: any) => i.is_flow_in || i.is_flow_out).map((i: any) => {
      const proposal = proposals.get(String(i.asset_type).toLowerCase());
      const name = decodeBase64(proposal?.name) || i.asset_type;
      const symbol = decodeBase64(proposal?.symbol) || name;
      // Both amount fields are present; the opposite direction contains "0".
      const amount = String((i.is_flow_in ? i.flow_in_amount : i.flow_out_amount) ?? '0');
      return { flowId: i.tx_hash,
        direction: i.is_flow_in ? 'in' : 'out', method: i.tx_type, status: 'success', asset: { assetId: i.asset_type,
          name, assetName: name, symbol, logoUrl: '', contractAddress: i.recipient,
          assetType: i.asset_type, decimals: Number(proposal?.decimals ?? OPENHIVE_ASSET_DECIMALS), assetDecimals: OPENHIVE_ASSET_DECIMALS, isEnabled: true, exchangeRate: '1' },
        amountInfo: { erc20Amount: amount, flowAmount: amount, displayAmount: amount, displaySymbol: symbol },
        timeline: { submittedAt: normalizeTimestampMs(i.tx_time ?? i.time), completedAt: normalizeTimestampMs(i.tx_time ?? i.time) }, tx: { txHash: i.tx_hash, blockNumber: Number(i.block_height ?? 0) } };
      }),
      pageNum: params.pageNum, pageSize: params.pageSize, total: Number(data.total ?? 0) } as FlowHistoryResult;
  }
}

function decodeBase64(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  try { return decodeURIComponent(Array.from(atob(value), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')); }
  catch { return value; }
}

function validatorIdFromAddress(value: unknown): string {
  const address = String(value ?? '');
  const suffix = address.replace(/^0x/i, '').slice(-12);
  return /^[0-9a-fA-F]{1,12}$/.test(suffix)
    ? String(Number.parseInt(suffix, 16))
    : '0';
}

function normalizeTimestampMs(value: unknown): number {
  const timestamp = Number(value ?? 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  return timestamp > 10_000_000_000_000 ? Math.floor(timestamp / 1000) : timestamp;
}
