import { Contract } from 'ethers';
import ERC721_ABI from './abis/erc-721';

type ABI = typeof ERC721_ABI;
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
  [K in keyof T]: T[K] extends { type: infer U } ? InputToType<U> : never
};

type ParamsFor<N extends FunctionNames> = Extract<
  ABIFunction,
  { name: N }
>['inputs'] extends infer I
  ? I extends readonly any[]
    ? InputsOf<I>
    : []
  : [];

export class ERC721 {
  constructor(address: string) {
    this.address = address;
  }

  address!: string;

  get contractProvider() {
    return new Contract(this.address, ERC721_ABI);
  }

  getFunction<N extends FunctionNames>(name: N, ...params: ParamsFor<N>) {
    return this.contractProvider.getFunction(name).populateTransaction(...params);
  }
}
