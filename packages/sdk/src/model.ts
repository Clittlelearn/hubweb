import type { MethodType } from './type.js';

export interface GasAsset {
  addr: string;
  asset_type: string;
}

export interface GasAssetInput {
  addr?: string;
  asset_type: string;
}

export interface CustomJsonCommonFields {
  gas_asset?: GasAssetInput;
  is_find_utxo?: boolean;
  sponsor_gas?: boolean;
  encoded_info?: string;
}

export type VoteValue = '1' | '0' | boolean;

export type CustomJsonPayload = {
  type: MethodType;
  is_find_utxo: boolean;
  sponsor_gas: boolean;
  encoded_info: string;
  gas_asset?: GasAsset;
  [key: string]: unknown;
};

function normalizeGasAsset(
  gasAsset: GasAssetInput | undefined,
  fallbackAddr?: string,
): GasAsset | undefined {
  if (!gasAsset) {
    return undefined;
  }

  const addr = gasAsset.addr ?? fallbackAddr;
  if (!addr) {
    return undefined;
  }

  return {
    addr,
    asset_type: gasAsset.asset_type,
  };
}

export function buildCustomJsonPayload(
  type: MethodType,
  fields: Record<string, unknown> = {},
  common: CustomJsonCommonFields = {},
  fallbackGasAddr?: string,
): CustomJsonPayload {
  const payload: CustomJsonPayload = {
    type,
    ...fields,
    is_find_utxo: common.is_find_utxo ?? false,
    sponsor_gas: common.sponsor_gas ?? false,
    encoded_info: common.encoded_info ?? '',
  };

  const gasAsset = normalizeGasAsset(common.gas_asset, fallbackGasAddr);
  if (gasAsset) {
    payload.gas_asset = gasAsset;
  }

  return payload;
}

export function generateTxMessage(
  args: CustomJsonCommonFields & { type: MethodType } & Record<string, unknown>,
): CustomJsonPayload {
  const {
    type,
    gas_asset,
    is_find_utxo,
    sponsor_gas,
    encoded_info,
    ...fields
  } = args;

  return buildCustomJsonPayload(type, fields, {
    gas_asset,
    is_find_utxo,
    sponsor_gas,
    encoded_info,
  });
}

export function generateTransferMessage(args: {
  from: string;
  asset_type: string;
  gas_asset?: string;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'tx',
    {
      asset_type: args.asset_type,
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateStakeTransactionData(args: {
  from: string;
  asset_type: string;
  gas_asset?: string;
  amount: string;
  reward_rank: string | number;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'stake',
    {
      asset_type: args.asset_type,
      amount: args.amount,
      reward_rank: String(args.reward_rank),
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateUnstakeTransactionData(args: {
  from: string;
  asset_type: string;
  gas_asset?: string;
  stake_utxo_hash: string;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'unstake',
    {
      asset_type: args.asset_type,
      stake_utxo_hash: args.stake_utxo_hash,
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateLockTxMessage(args: {
  from: string;
  gas_asset?: string;
  lock_amount: string;
  lock_type: string | number;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'lock',
    {
      lock_amount: args.lock_amount,
      lock_type: String(args.lock_type),
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateUnlockTransactionData(args: {
  from: string;
  gas_asset?: string;
  utxo_hash: string;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'unlock',
    {
      utxo_hash: args.utxo_hash,
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateDelegatingTransactionData(args: {
  from: string;
  asset_type: string;
  gas_asset?: string;
  amount: string;
  delegate_type: string | number;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'delegating',
    {
      asset_type: args.asset_type,
      amount: args.amount,
      delegate_type: String(args.delegate_type),
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateUndelegatingTransactionData(args: {
  from: string;
  asset_type: string;
  gas_asset?: string;
  utxo_hash: string;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'undelegating',
    {
      asset_type: args.asset_type,
      utxo_hash: args.utxo_hash,
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateBonusTransactionData(args: {
  from: string;
  asset_type?: string;
  gas_asset?: string;
  first_choose: boolean;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'bonus',
    args.asset_type ? { asset_type: args.asset_type, first_choose: args.first_choose } : {
      first_choose: args.first_choose,
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateVoteTransactionData(args: {
  from: string;
  gas_asset?: string;
  vote_hash: string;
  vote: VoteValue;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'vote',
    {
      vote_hash: args.vote_hash,
      vote: args.vote,
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateProposalTransactionData(args: {
  from: string;
  gas_asset?: string;
  vote_hash: string;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'proposal',
    {
      vote_hash: args.vote_hash,
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateRevokeProposalTransactionData(args: {
  from: string;
  gas_asset?: string;
  vote_hash: string;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  return buildCustomJsonPayload(
    'revoke_proposal',
    {
      vote_hash: args.vote_hash,
    },
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );
}

export function generateFundTransactionData(args: {
  from: string;
  gas_asset?: string;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  const payload = buildCustomJsonPayload(
    'fund',
    {},
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );

  if (!payload.sponsor_gas) {
    delete (payload as Record<string, unknown>).sponsor_gas;
  }

  return payload;
}

export function generateTreasuryTransactionData(args: {
  from: string;
  gas_asset?: string;
  sponsor_gas?: boolean;
  is_find_utxo?: boolean;
  encoded_info?: string;
}) {
  const payload = buildCustomJsonPayload(
    'treasury',
    {},
    {
      gas_asset: args.gas_asset
        ? { addr: args.from, asset_type: args.gas_asset }
        : undefined,
      sponsor_gas: args.sponsor_gas,
      is_find_utxo: args.is_find_utxo,
      encoded_info: args.encoded_info,
    },
    args.from,
  );

  if (!payload.sponsor_gas) {
    delete (payload as Record<string, unknown>).sponsor_gas;
  }

  return payload;
}

export function generateContractTxMessage(args: {
  from: string;
  to: string;
  gasAsset: string;
  pubkey: string;
  data: string;
  deployer: string;
  deployutxo: string;
  sponsor_gas?: boolean;
}) {
  return {
    addr: args.from,
    args: args.data,
    contract_address: args.to,
    deployer: args.deployer,
    deployutxo: args.deployutxo,
    encoded_info: '',
    gas_asset: {
      addr: args.from,
      asset_type: args.gasAsset,
    },
    is_find_utxo: false,
    istochain: true,
    money: '0',
    pubstr: args.pubkey,
    sponsor_gas: args.sponsor_gas ?? true,
    sleeptime: '6',
  };
}
