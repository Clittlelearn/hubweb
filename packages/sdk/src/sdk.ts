import { ethers, type TransactionRequest } from 'ethers';
import { sendBrowserTransaction, type WalletContext } from './wallet-session.js';
import {
  buildTransaction,
  buildStakeTransaction,
  buildUnstakeTransaction,
  buildLockTransaction,
  buildUnlockTransaction,
  buildFundTransaction,
  buildDelegatingTransaction,
  buildUndelegatingTransaction,
  buildBonusTransaction,
  buildVoteTransaction,
  buildProposalTransaction,
  buildRevokeProposalTransaction,
} from './message.js';
import type {
  BonusTransactionData,
  DelegatingTransactionData,
  FundTransactionData,
  LockTransactionData,
  ProposalTransactionData,
  RevokeProposalTransactionData,
  StakeTransactionData,
  TransactionData,
  UndelegatingTransactionData,
  UnlockTransactionData,
  UnstakeTransactionData,
  VoteTransactionData,
} from './message.js';

type SdkReturn<HasProvider extends boolean> = HasProvider extends true
  ? { hash: string }
  : TransactionRequest;

/**
 * 用于与 OpenHive 链交互的高级 SDK 类。
 *
 * 传入钱包 provider 时，方法会对交易进行签名并广播；
 * 未传入 provider 时，方法仅返回构建好的交易数据对象。
 *
 * 推荐使用 {@link OpenHiveSdk.create} 以获得正确的编译期返回类型。
 */
export class OpenHiveSdk<HasProvider extends boolean = boolean> {
  static create(options: {
    provider: ethers.BrowserProvider;
    rpcUrl: string;
    expectedWallet?: WalletContext;
  }): OpenHiveSdk<true>;
  static create(options?: {
    provider?: ethers.BrowserProvider;
    rpcUrl?: string;
    expectedWallet?: WalletContext;
  }): OpenHiveSdk<false>;
  static create(options: {
    provider: ethers.BrowserProvider;
    rpcUrl: string;
    expectedWallet?: WalletContext;
  }): OpenHiveSdk<boolean> {
    return new OpenHiveSdk(options);
  }

  constructor(options?: {
    provider?: ethers.BrowserProvider;
    rpcUrl?: string;
    expectedWallet?: WalletContext;
  }) {
    this.provider = options?.provider;
    this.expectedWallet = options?.expectedWallet;
  }

  private provider?: ethers.BrowserProvider;
  private expectedWallet?: WalletContext;

  private async send(tx: TransactionRequest): Promise<SdkReturn<HasProvider>> {
    if (!this.provider) {
      return tx as SdkReturn<HasProvider>;
    }

    return await sendBrowserTransaction(this.provider, tx, this.expectedWallet) as SdkReturn<HasProvider>;
  }

  /** 发送普通转账 tx/transaction（金额使用 raw ETH tx 的 value 字段）。 */
  async transaction(
    data: TransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildTransaction(data, to, from);
    return this.send(tx);
  }

  /** 发送普通转账 tx/transaction，transaction 的别名。 */
  async transfer(
    data: TransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildTransaction(data, to, from);
    return this.send(tx);
  }

  /** 发送 stake 交易（未传入 provider 时返回交易数据对象）。 */
  async stake(
    data: StakeTransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildStakeTransaction(data, { stake: to }, from);
    return this.send(tx);
  }

  /** 发送 unstake 交易（未传入 provider 时返回交易数据对象）。 */
  async unstake(
    data: UnstakeTransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildUnstakeTransaction(data, { unstake: to }, from);
    return this.send(tx);
  }

  /** 发送 lock 交易（未传入 provider 时返回交易数据对象）。 */
  async lock(
    data: LockTransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildLockTransaction(data, { lock: to }, from);
    return this.send(tx);
  }

  /** 发送 unlock 交易（未传入 provider 时返回交易数据对象）。 */
  async unlock(
    data: UnlockTransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildUnlockTransaction(data, { unlock: to }, from);
    return this.send(tx);
  }

  /** 发送 fund 国库奖励交易（未传入 provider 时返回交易数据对象）。 */
  async fund(
    data: FundTransactionData = {},
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildFundTransaction(data, { fund: to }, from);
    return this.send(tx);
  }

  /** 发送 treasury 国库奖励交易，fund 的别名 JSON type。 */
  async treasury(
    data: FundTransactionData = {},
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildFundTransaction(
      {
        ...data,
        type: 'treasury',
      },
      { treasury: to },
      from,
    );
    return this.send(tx);
  }

  /** 发送 delegating 交易（未传入 provider 时返回交易数据对象）。 */
  async delegate(
    data: DelegatingTransactionData & { to_addr: string },
    from: string,
  ): Promise<SdkReturn<HasProvider>>;
  async delegate(
    data: DelegatingTransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>>;
  async delegate(
    data: DelegatingTransactionData,
    toOrFrom: string,
    maybeFrom?: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = maybeFrom
      ? buildDelegatingTransaction(data, toOrFrom, maybeFrom)
      : buildDelegatingTransaction(
          data as DelegatingTransactionData & { to_addr: string },
          toOrFrom,
        );
    return this.send(tx);
  }

  /** 发送 undelegating 交易（未传入 provider 时返回交易数据对象）。 */
  async undelegate(
    data: UndelegatingTransactionData & { to_addr: string },
    from: string,
  ): Promise<SdkReturn<HasProvider>>;
  async undelegate(
    data: UndelegatingTransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>>;
  async undelegate(
    data: UndelegatingTransactionData,
    toOrFrom: string,
    maybeFrom?: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = maybeFrom
      ? buildUndelegatingTransaction(data, toOrFrom, maybeFrom)
      : buildUndelegatingTransaction(
          data as UndelegatingTransactionData & { to_addr: string },
          toOrFrom,
        );
    return this.send(tx);
  }

  /** 发送 bonus 领取交易（未传入 provider 时返回交易数据对象）。 */
  async bonus(
    data: BonusTransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildBonusTransaction(data, { bonus: to }, from);
    return this.send(tx);
  }

  /** 发送 vote 交易（未传入 provider 时返回交易数据对象）。 */
  async vote(
    data: VoteTransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildVoteTransaction(data, { vote: to }, from);
    return this.send(tx);
  }

  /** 发送 proposal 交易（未传入 provider 时返回交易数据对象）。 */
  async proposal(
    data: ProposalTransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildProposalTransaction(data, { proposal: to }, from);
    return this.send(tx);
  }

  /** 发送 revoke_proposal 交易（未传入 provider 时返回交易数据对象）。 */
  async revokeProposal(
    data: RevokeProposalTransactionData,
    to: string,
    from: string,
  ): Promise<SdkReturn<HasProvider>> {
    const tx = buildRevokeProposalTransaction(
      data,
      { revoke_proposal: to },
      from,
    );
    return this.send(tx);
  }
}
