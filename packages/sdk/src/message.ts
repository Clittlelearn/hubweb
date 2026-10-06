import { sendBrowserTransaction } from './wallet-session.js';
import { ethers, type TransactionRequest } from 'ethers';
import {
  buildCustomJsonPayload,
  type CustomJsonCommonFields,
  type GasAssetInput,
  type VoteValue,
} from './model.js';
import type { MethodType } from './type.js';
import { jsonToHex } from './utlis.js';

/** 网络配置信息。 */
export interface Network {
  /** 链 ID。 */
  id: number;
  /** RPC 节点地址列表。 */
  rpcs: string[];
}

/** 链上各合约/功能地址。 */
export interface ChainAddresses {
  /** 普通转账目标地址。 */
  transaction?: string;
  /** 兼容旧 fund 名称的普通转账目标地址。 */
  fund?: string;
  /** treasury/fund 目标地址。 */
  treasury?: string;
  /** stake 合约/功能地址。 */
  stake?: string;
  /** unstake 合约/功能地址。 */
  unstake?: string;
  /** lock 合约/功能地址。 */
  lock?: string;
  /** unlock 合约/功能地址。 */
  unlock?: string;
  /** vote 合约/功能地址。 */
  vote?: string;
  /** proposal 合约/功能地址。 */
  proposal?: string;
  /** revoke_proposal 合约/功能地址。 */
  revoke_proposal?: string;
  /** bonus 合约/功能地址。 */
  bonus?: string;
  /** bonus 合约地址（历史拼写保留，已废弃）。 */
  /** @deprecated 请使用 bonus。 */
  bouns?: string;
  /** delegating 目标地址。 */
  delegating?: string;
  /** undelegating 目标地址。 */
  undelegating?: string;
}

export type TransactionValue = TransactionRequest['value'];

export interface CommonTransactionData
  extends Omit<CustomJsonCommonFields, 'gas_asset'> {
  gas_asset?: GasAssetInput;
}

export interface TransactionData extends CommonTransactionData {
  type?: 'tx' | 'transaction';
  asset_type: string;
  value?: TransactionValue;
}

export interface FundTransactionData extends CommonTransactionData {
  type?: 'fund' | 'treasury';
}

export interface StakeTransactionData extends CommonTransactionData {
  asset_type: string;
  amount: string;
  reward_rank: string | number;
}

export interface UnstakeTransactionData extends CommonTransactionData {
  asset_type: string;
  stake_utxo_hash?: string;
  utxo_hash?: string;
}

export interface LockTransactionData extends CommonTransactionData {
  lock_amount: string;
  lock_type: string | number;
}

export interface UnlockTransactionData extends CommonTransactionData {
  /** 兼容旧参数名，等价于 gas_asset。 */
  gas?: GasAssetInput;
  utxo_hash: string;
}

export interface DelegatingTransactionData extends CommonTransactionData {
  type?: 'delegating' | 'delegate';
  asset_type: string;
  amount?: string;
  /** 兼容旧参数名，等价于 amount。 */
  delegatinged_amount?: string;
  delegate_type?: string | number;
  to_addr: string;
}

export interface UndelegatingTransactionData extends CommonTransactionData {
  type?: 'undelegating' | 'undelegate';
  asset_type: string;
  utxo_hash: string;
  to_addr: string;
}

export interface BonusTransactionData extends CommonTransactionData {
  asset_type?: string;
  first_choose: boolean;
}

export interface VoteTransactionData extends CommonTransactionData {
  vote_hash: string;
  vote?: VoteValue;
  /** 兼容旧参数名，1 表示赞成，0 表示反对。 */
  vote_type?: number;
}

export interface ProposalTransactionData extends CommonTransactionData {
  vote_hash?: string;
  /** 文档说明的兼容字段；SDK 会优先编码为 vote_hash。 */
  proposal_hash?: string;
}

export interface RevokeProposalTransactionData
  extends CommonTransactionData {
  type?: 'revoke_proposal' | 'revokeProposal';
  vote_hash: string;
}

type CommonDataWithLegacyGas = CommonTransactionData & {
  gas?: GasAssetInput;
};

/**
 * 发送交易。
 *
 * 自动估算 gas、增加 20% gasLimit 缓冲，并附加当前网络的 fee 数据。
 */
export async function sendTransaction(
  _provider: ethers.BrowserProvider,
  tx: TransactionRequest,
  network: Network,
): Promise<{ hash: string }> {
  return sendBrowserTransaction(_provider, tx, { chainId: network.id });
}

function commonFields(
  data: CommonDataWithLegacyGas,
  from: string,
): CustomJsonCommonFields {
  const gasAsset = data.gas_asset ?? data.gas;

  return {
    gas_asset: gasAsset
      ? {
        addr: gasAsset.addr ?? from,
        asset_type: gasAsset.asset_type,
      }
      : undefined,
    is_find_utxo: data.is_find_utxo ?? false,
    sponsor_gas: data.sponsor_gas ?? false,
    encoded_info: data.encoded_info ?? "",
  };
}

function requireField(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function toStringField(value: string | number): string {
  return String(value);
}

function voteField(data: VoteTransactionData): VoteValue {
  if (data.vote !== undefined) {
    return data.vote;
  }

  if (data.vote_type !== undefined) {
    return data.vote_type ? '1' : '0';
  }

  throw new Error('vote is required.');
}

/**
 * 构建自定义 JSON data 载荷。
 *
 * 返回值已经按 UTF-8 JSON 字符串编码为十六进制，可直接放入 raw ETH tx 的 data 字段。
 */
export function buildPayload(
  type: MethodType,
  fields: Record<string, unknown> = {},
  common: CustomJsonCommonFields = {},
  fallbackGasAddr?: string,
): `0x${string}` {
  const txData = buildCustomJsonPayload(type, fields, common, fallbackGasAddr);
  return jsonToHex(txData);
}

export function buildTransaction(
  data: TransactionData,
  to: string,
  from: string,
): TransactionRequest {
  const payload = buildPayload(
    data.type ?? 'tx',
    {
      asset_type: data.asset_type,
      to,
    },
    commonFields(data, from),
    from,
  );

  return {
    to,
    from,
    data: payload,
    value: data.value ?? 0n,
  };
}

export function buildFundTransaction(
  data: FundTransactionData = {},
  addresses: ChainAddresses,
  from: string,
): TransactionRequest {
  const common = commonFields(data, from);
  const payloadData: Record<string, unknown> = {
    type: data.type ?? 'fund',
    is_find_utxo: common.is_find_utxo,
    encoded_info: common.encoded_info,
  };

  if (common.sponsor_gas) {
    payloadData.sponsor_gas = common.sponsor_gas;
  }

  if (common.gas_asset) {
    payloadData.gas_asset = common.gas_asset;
  }

  const payload = jsonToHex(payloadData);

  return {
    to: (addresses.treasury ?? addresses.fund)!,
    from,
    data: payload,
    value: 0n,
  };
}

export function buildStakeTransaction(
  data: StakeTransactionData,
  addresses: ChainAddresses,
  from: string,
): TransactionRequest {
  const payload = buildPayload(
    'stake',
    {
      asset_type: data.asset_type,
      amount: data.amount,
      reward_rank: toStringField(data.reward_rank),
    },
    commonFields(data, from),
    from,
  );

  return {
    to: addresses.stake!,
    from,
    data: payload,
    value: 0n,
  };
}

export function buildUnstakeTransaction(
  data: UnstakeTransactionData,
  addresses: ChainAddresses,
  from: string,
): TransactionRequest {
  const payload = buildPayload(
    'unstake',
    {
      asset_type: data.asset_type,
      stake_utxo_hash: requireField(
        data.stake_utxo_hash ?? data.utxo_hash,
        'stake_utxo_hash',
      ),
    },
    commonFields(data, from),
    from,
  );

  return {
    to: addresses.unstake!,
    from,
    data: payload,
    value: 0n,
  };
}

export function buildLockTransaction(
  data: LockTransactionData,
  addresses: ChainAddresses,
  from: string,
): TransactionRequest {
  const payload = buildPayload(
    'lock',
    {
      lock_amount: data.lock_amount,
      lock_type: toStringField(data.lock_type),
    },
    commonFields(data, from),
    from,
  );

  return {
    to: addresses.lock!,
    from,
    data: payload,
    value: 0n,
  };
}

export function buildUnlockTransaction(
  data: UnlockTransactionData,
  addresses: ChainAddresses,
  from: string,
): TransactionRequest {
  const payload = buildPayload(
    'unlock',
    {
      utxo_hash: data.utxo_hash,
    },
    commonFields(data, from),
    from,
  );

  return {
    to: addresses.unlock!,
    from,
    data: payload,
    value: 0n,
  };
}

export function buildDelegatingTransaction(
  data: DelegatingTransactionData & { to_addr: string },
  from: string,
): TransactionRequest;
export function buildDelegatingTransaction(
  data: DelegatingTransactionData,
  to: string,
  from: string,
): TransactionRequest;
export function buildDelegatingTransaction(
  data: DelegatingTransactionData,
  toOrFrom: string,
  maybeFrom?: string,
): TransactionRequest {
  const to = maybeFrom ? toOrFrom : data.to_addr;
  const from = maybeFrom ?? toOrFrom;
  const payload = buildPayload(
    data.type ?? 'delegating',
    {
      asset_type: data.asset_type,
      amount: requireField(
        data.amount ?? data.delegatinged_amount,
        'amount',
      ),
      delegate_type: toStringField(data.delegate_type ?? 0),
      to: data.to_addr
    },
    commonFields(data, from),
    from,
  );

  return {
    to: requireField(to, 'to'),
    from,
    data: payload,
    value: 0n,
  };
}

export function buildUndelegatingTransaction(
  data: UndelegatingTransactionData & { to_addr: string },
  from: string,
): TransactionRequest;
export function buildUndelegatingTransaction(
  data: UndelegatingTransactionData,
  to: string,
  from: string,
): TransactionRequest;
export function buildUndelegatingTransaction(
  data: UndelegatingTransactionData,
  toOrFrom: string,
  maybeFrom?: string,
): TransactionRequest {
  const to = maybeFrom ? toOrFrom : data.to_addr;
  const from = maybeFrom ?? toOrFrom;
  const payload = buildPayload(
    data.type ?? 'undelegating',
    {
      asset_type: data.asset_type,
      utxo_hash: data.utxo_hash,
      to: data.to_addr
    },
    commonFields(data, from),
    from,
  );

  return {
    to: requireField(to, 'to'),
    from,
    data: payload,
    value: 0n,
  };
}

export function buildBonusTransaction(
  data: BonusTransactionData,
  addresses: ChainAddresses,
  from: string,
): TransactionRequest {
  const fields: Record<string, unknown> = {
    first_choose: data.first_choose,
  };

  if (data.asset_type) {
    fields.asset_type = data.asset_type;
  }

  const payload = buildPayload('bonus', fields, commonFields(data, from), from);

  return {
    to: (addresses.bonus ?? addresses.bouns)!,
    from,
    data: payload,
    value: 0n,
  };
}

export function buildVoteTransaction(
  data: VoteTransactionData,
  addresses: ChainAddresses,
  from: string,
): TransactionRequest {
  const payload = buildPayload(
    'vote',
    {
      vote_hash: data.vote_hash,
      vote: voteField(data),
    },
    commonFields(data, from),
    from,
  );

  return {
    to: addresses.vote!,
    from,
    data: payload,
    value: 0n,
  };
}

export function buildProposalTransaction(
  data: ProposalTransactionData,
  addresses: ChainAddresses,
  from: string,
): TransactionRequest {
  const payload = buildPayload(
    'proposal',
    {
      vote_hash: requireField(
        data.vote_hash ?? data.proposal_hash,
        'vote_hash',
      ),
    },
    commonFields(data, from),
    from,
  );

  return {
    to: addresses.proposal!,
    from,
    data: payload,
    value: 0n,
  };
}

export function buildRevokeProposalTransaction(
  data: RevokeProposalTransactionData,
  addresses: ChainAddresses,
  from: string,
): TransactionRequest {
  const payload = buildPayload(
    data.type ?? 'revoke_proposal',
    {
      vote_hash: data.vote_hash,
    },
    commonFields(data, from),
    from,
  );

  return {
    to: addresses.revoke_proposal!,
    from,
    data: payload,
    value: 0n,
  };
}
