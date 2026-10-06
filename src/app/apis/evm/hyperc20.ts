import { Contract, ethers, type ContractTransaction } from 'ethers';
import HypERC20Coll_ABI from './abis/hyp_erc20_coll';
import { errorHandling } from '@/app/lib/helper';

type ABI = typeof HypERC20Coll_ABI;
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

export class HypERC20Coll {
  constructor(address: string, rpc?: string) {
    this.address = address;
    this.rpc = rpc;
  }

  rpc?: string;
  address!: string;

  static ABI = HypERC20Coll_ABI;
  get rpcProvider() {
    if (!this.rpc) {
      return;
    }
    return new ethers.JsonRpcProvider(this.rpc);
  }

  get contractProvider() {
    return new Contract(this.address, HypERC20Coll.ABI, this.rpcProvider);
  }

  getFunction<N extends FunctionNames>(name: N, ...params: ParamsFor<N>) {
    return this.contractProvider
      .getFunction(name)
      .populateTransaction(...params);
  }

  parse(data: string) {
    try {
      const iface = new ethers.Interface(HypERC20Coll.ABI);
      const res = iface.parseTransaction({ data });

      return res;
    } catch {
      return null;
    }
  }

  async sendTransaction(
    provider: ethers.BrowserProvider,
    data: ContractTransaction,
  ) {
    try {
      const { sendBrowserTransaction } = await import('@openhive/sdk');
      return sendBrowserTransaction(provider, data);
    } catch (err) {
      throw errorHandling(err);
    }
  }

  // invested
  invested(param: {
    destination: string; // target chain domain
    recipient: string; //  target chain be invested addr
    beneficiary: string; // target chain owner
    amount: bigint; // amount
  }) {
    console.log([
      param.destination,
      param.recipient,
      param.beneficiary,
      param.amount,
    ]);

    return this.getFunction(
      'transferRemote',
      ...[
        param.destination,
        ethers.zeroPadValue(param.recipient, 32),
        ethers.zeroPadValue(param.beneficiary, 32),
        param.amount,
      ],
    );
  }

  // resolveInvestment
  resolveInvestment(param: {
    destination: string; // target chain domain
    recipient: string; //  target chain be invested addr
    beneficiary: string; // target chain owner
  }) {
    return this.getFunction(
      'resolveInvestment',
      ...[
        param.destination,
        ethers.zeroPadValue(param.recipient, 32),
        ethers.zeroPadValue(param.beneficiary, 32),
      ],
    );
  }

  async getInvestedInfo(address: string, validator: string) {
    const res = await this.contractProvider!.investments!(
      address,
      ethers.zeroPadValue(validator, 32),
    );
    if (!res) return null;
    return {
      investmentId: res[0]?.toString(),
      recipient: res[1]?.toString(),
      beneficiary: res[2]?.toString(),
      localAmount: res[3]?.toString(),
      remoteAmount: res[4]?.toString(),
      timestamp: res[5]?.toString(),
      active: res[6]?.toString(),
    };
  }
}
