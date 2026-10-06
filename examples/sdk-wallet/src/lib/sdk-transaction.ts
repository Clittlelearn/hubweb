import { OpenHiveSdk, ethers } from '@openhive/sdk';
import type {
  OpenHiveNetwork,
  SdkFormState,
  SdkResult,
  SdkRunMode,
} from '../types';
import { getEthereum } from './wallet';
import {
  assertNever,
  hasWait,
  requireAddress,
  requireDecimals,
  requireRawAmount,
  requireText,
} from './utils';

interface RunSdkTransactionParams {
  mode: SdkRunMode;
  form: SdkFormState;
  from: string;
  network: OpenHiveNetwork;
}

type CommonTransactionFields = ReturnType<typeof getCommonTransactionFields>;

interface SdkCallContext {
  sdk: OpenHiveSdk<boolean>;
  form: SdkFormState;
  from: string;
  to: string;
  common: CommonTransactionFields;
}

export async function runSdkTransaction({
  mode,
  form,
  from,
  network,
}: RunSdkTransactionParams) {
  const sdk =
    mode === 'send'
      ? OpenHiveSdk.create({
          provider: new ethers.BrowserProvider(getEthereum()),
          rpcUrl: network.rpcUrl,
        })
      : OpenHiveSdk.create();

  const result = await callSelectedSdkMethod(sdk, form, from);
  const receipt =
    mode === 'send' && form.waitForReceipt && hasWait(result)
      ? await result.wait()
      : null;

  return { result, receipt };
}

export async function callSelectedSdkMethod(
  sdk: OpenHiveSdk<boolean>,
  form: SdkFormState,
  from: string,
): Promise<SdkResult> {
  const context: SdkCallContext = {
    sdk,
    form,
    from,
    to: requireAddress(form.targetAddress, 'Target address'),
    common: getCommonTransactionFields(form, from),
  };

  switch (form.method) {
    case 'transfer':
      return callTransfer(context);
    case 'transaction':
      return callTransactionAlias(context);
    case 'delegate':
      return callDelegate(context);
    case 'delegateAlias':
      return callDelegateAlias(context);
    case 'undelegate':
      return callUndelegate(context);
    case 'undelegateAlias':
      return callUndelegateAlias(context);
    case 'stake':
      return callStake(context);
    case 'unstake':
      return callUnstake(context);
    case 'lock':
      return callLock(context);
    case 'unlock':
      return callUnlock(context);
    case 'bonus':
      return callBonus(context);
    case 'vote':
      return callVote(context);
    case 'proposal':
      return callProposal(context);
    case 'revokeProposal':
      return callRevokeProposal(context);
    case 'revokeProposalAlias':
      return callRevokeProposalAlias(context);
    case 'fund':
      return callFund(context);
    case 'treasury':
      return callTreasury(context);
    default:
      return assertNever(form.method);
  }
}

export async function callTransfer({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  const decimals = requireDecimals(form.transferValueDecimals);

  return sdk.transfer(
    {
      ...common,
      asset_type: requireText(form.assetType, 'Asset type'),
      value: ethers.parseUnits(form.transferValue || '0', decimals),
    },
    to,
    from,
  );
}

export async function callTransactionAlias({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  const decimals = requireDecimals(form.transferValueDecimals);

  return sdk.transaction(
    {
      ...common,
      type: 'transaction',
      asset_type: requireText(form.assetType, 'Asset type'),
      value: ethers.parseUnits(form.transferValue || '0', decimals),
    },
    to,
    from,
  );
}

export async function callDelegate({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.delegate(
    {
      ...common,
      asset_type: requireText(form.assetType, 'Asset type'),
      amount: requireRawAmount(form.amountRaw),
      delegate_type: requireText(form.delegateType, 'Delegate type'),
    },
    to,
    from,
  );
}

export async function callDelegateAlias({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.delegate(
    {
      ...common,
      type: 'delegate',
      asset_type: requireText(form.assetType, 'Asset type'),
      amount: requireRawAmount(form.amountRaw),
      delegate_type: requireText(form.delegateType, 'Delegate type'),
    },
    to,
    from,
  );
}

export async function callUndelegate({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.undelegate(
    {
      ...common,
      asset_type: requireText(form.assetType, 'Asset type'),
      utxo_hash: requireText(form.utxoHash, 'UTXO hash'),
    },
    to,
    from,
  );
}

export async function callUndelegateAlias({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.undelegate(
    {
      ...common,
      type: 'undelegate',
      asset_type: requireText(form.assetType, 'Asset type'),
      utxo_hash: requireText(form.utxoHash, 'UTXO hash'),
    },
    to,
    from,
  );
}

export async function callStake({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.stake(
    {
      ...common,
      asset_type: requireText(form.assetType, 'Asset type'),
      amount: requireRawAmount(form.amountRaw),
      reward_rank: requireText(form.rewardRank, 'Reward rank'),
    },
    to,
    from,
  );
}

export async function callUnstake({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.unstake(
    {
      ...common,
      asset_type: requireText(form.assetType, 'Asset type'),
      stake_utxo_hash: requireText(form.utxoHash, 'Stake UTXO hash'),
    },
    to,
    from,
  );
}

export async function callLock({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.lock(
    {
      ...common,
      lock_amount: requireRawAmount(form.amountRaw),
      lock_type: requireText(form.lockType, 'Lock type'),
    },
    to,
    from,
  );
}

export async function callUnlock({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.unlock(
    {
      ...common,
      utxo_hash: requireText(form.utxoHash, 'UTXO hash'),
    },
    to,
    from,
  );
}

export async function callBonus({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.bonus(
    {
      ...common,
      asset_type: requireText(form.assetType, 'Asset type'),
      first_choose: form.firstChoose,
    },
    to,
    from,
  );
}

export async function callVote({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.vote(
    {
      ...common,
      vote_hash: requireText(form.voteHash, 'Vote hash'),
      vote: form.voteValue,
    },
    to,
    from,
  );
}

export async function callProposal({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.proposal(
    {
      ...common,
      vote_hash: requireText(form.voteHash, 'Vote hash'),
    },
    to,
    from,
  );
}

export async function callRevokeProposal({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.revokeProposal(
    {
      ...common,
      vote_hash: requireText(form.voteHash, 'Vote hash'),
    },
    to,
    from,
  );
}

export async function callRevokeProposalAlias({
  sdk,
  form,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.revokeProposal(
    {
      ...common,
      type: 'revokeProposal',
      vote_hash: requireText(form.voteHash, 'Vote hash'),
    },
    to,
    from,
  );
}

export async function callFund({
  sdk,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.fund(
    {
      ...common,
    },
    to,
    from,
  );
}

export async function callTreasury({
  sdk,
  from,
  to,
  common,
}: SdkCallContext): Promise<SdkResult> {
  return sdk.treasury(
    {
      ...common,
    },
    to,
    from,
  );
}

function getCommonTransactionFields(form: SdkFormState, from: string) {
  return {
    gas_asset: form.gasAssetType.trim()
      ? {
          addr: from,
          asset_type: form.gasAssetType.trim(),
        }
      : undefined,
    sponsor_gas: form.sponsorGas || undefined,
    is_find_utxo: form.isFindUtxo,
    encoded_info: form.encodedInfo,
  };
}
