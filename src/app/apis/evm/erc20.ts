import { Contract, ethers, type ContractTransaction } from 'ethers';
import ERC20_ABI from './abis/erc-20';

const ERC20_TOKENS = 'ERC20_TOKENS';

type ABI = typeof ERC20_ABI;
type ABIFunction = Extract<ABI[number], { type: 'function' }>;
type FunctionNames = ABIFunction['name'];

type InputToType<T> = T extends 'address'
  ? string
  : T extends 'uint256'
    ? bigint
    : T extends 'uint8'
      ? number
      : T extends 'bool'
        ? boolean
        : T extends 'string'
          ? string
          : unknown;

type InputsOf<T extends readonly { type: string }[]> = {
  [K in keyof T]: T[K] extends { type: infer U } ? InputToType<U> : never;
};

type ParamsFor<N extends FunctionNames> = Extract<
  ABIFunction,
  { name: N }
>['inputs'] extends infer I
  ? I extends readonly any[]
    ? InputsOf<I>
    : []
  : [];

export class ERC20 {
  constructor(address: string, rpc?: string) {
    this.address = address;
    this.rpc = rpc;
  }

  rpc?: string;
  address!: string;

  static ABI = ERC20_ABI;
  get rpcProvider() {
    if (!this.rpc) {
      return;
    }
    return new ethers.JsonRpcProvider(this.rpc);
  }

  get contractProvider() {
    return new Contract(this.address, ERC20.ABI, this.rpcProvider);
  }

  static generateTransferData(
    addr: string,
    param: { amount: string; to: string },
  ) {
    const erc20 = new ERC20(addr);

    return erc20.contractProvider
      .getFunction('transfer')
      .populateTransaction(...[param.to, param.amount]);
  }

  getFunction<N extends FunctionNames>(name: N, ...params: ParamsFor<N>) {
    return this.contractProvider
      .getFunction(name)
      .populateTransaction(...params);
  }

  parse(data: string) {
    try {
      const iface = new ethers.Interface(ERC20.ABI);
      const res = iface.parseTransaction({ data });

      return res;
    } catch {
      return null;
    }
  }

  call<N extends FunctionNames>(name: N, ...params: ParamsFor<N>) {
    return this.contractProvider[name]!(...params);
  }

  balanceOf(addr: string) {
    return this.contractProvider!.balanceOf!(addr);
  }

  async sendTransaction(
    provider: ethers.BrowserProvider,
    data: ContractTransaction,
  ) {
    const { sendBrowserTransaction } = await import('@openhive/sdk');
    return sendBrowserTransaction(provider, data);
  }

  async allowanceToTokenSelf(owner: string, spender: string, amount: bigint) {
    const cur = await this.contractProvider?.allowance?.(owner, spender);
    if ((cur || 0n) >= amount) return true;
    return false;
  }

  /**
   *
   * Approve token
   * @param provider
   * @param param
   *    contract: Contract Address
   *    approveAddress Approved address
   *    address Account address
   *    amount Transaction amount
   * @returns boolean
   */
  async approve(
    provider: ethers.BrowserProvider,
    param: {
      approvedAddress: string;
      address: string;
      amount: bigint;
    },
  ): Promise<boolean | ethers.BrowserProvider> {
    const isApprove = await this.allowanceToTokenSelf(
      param.address,
      param.approvedAddress,
      param.amount,
    );
    if (isApprove) {
      return true;
    }
    const txData = await this.getFunction(
      'approve',
      ...[param.approvedAddress, param.amount],
    );
    const res = await this.sendTransaction(provider, txData);

    const { waitForEthTransaction } = await import('../../lib/hivex-eth-client');
    const confirmed = await waitForEthTransaction({
      rpcUrl: '', hashes: [res.hash],
      request: (method, params) => provider.send(method, params),
    });
    if (BigInt(String(confirmed.receipt.status)) !== 1n) throw new Error('Token approval reverted.');
    // waiting
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 2000);
    });

    // const _isApprove = await this.allowanceToTokenSelf(param.address, param.approvedAddress, param.amount);
    // console.log(isApprove);

    // if (!isApprove) {
    //   throw new Error('Allowance exceeded');
    // }

    return true;
  }

  /**
   *
   * @param addr wallet address
   */
  async getTokenInfo(addr?: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    logoUrl: string;
    balance: string;
    address: string;
  }> {
    const localTokensJson = localStorage.getItem(ERC20_TOKENS);
    const localTokens = localTokensJson ? JSON.parse(localTokensJson) : {};
    const localToken = localTokens[this.address] ?? {};

    if (!localToken['symbol']) {
      const keys = ['name', 'symbol', 'decimals', 'logoUrl'] as const;
      const data = await Promise.allSettled(
        keys.map(async (k) => {
          try {
            return await this.contractProvider.getFunction(k)?.staticCall();
          } catch {
            return '';
          }
        }),
      );

      keys.forEach((k, i) => {
        localToken[k] =
          data[i]?.status === 'fulfilled' ? data[i].value || '' : '';
      });

      localToken['decimals'] = Number(localToken['decimals'] || 0);
    }

    if (addr) {
      const balance = await this.contractProvider
        .getFunction('balanceOf')
        .staticCall(addr);

      localToken['balance'] = balance?.toString() || '0';
    }

    localTokens[this.address] = localToken;
    localStorage.setItem(ERC20_TOKENS, JSON.stringify(localTokens));
    return {
      ...localToken,
      address: this.address,
    };
  }
}
