import type {
  RpcApiParams,
  RpcApiPath,
  RpcApiResult,
} from '../types/rpc-api';
import { HttpFetch } from './http-fetch';
import rpcApiJson from '../data/mmc-rpc-api.json';
import { ERC20 } from './evm';
import { ethers } from 'ethers';

export class RpcApi extends HttpFetch {
  nonce = 1;
  version = '2.0';

  post = async <K extends RpcApiPath>(
    method: K,
    params: {
      params: RpcApiParams<K>;
      id: string;
      jsonrpc: string;
      method: string;
    },
    options?: { outputResult?: boolean },
  ): Promise<RpcApiResult<K>> => {
    const path = `/${method}`;
    try {
      const data = await this.httpPost(path, JSON.stringify(params));
      const result = data.result;

      if (options?.outputResult) {
        return data;
      }

      if (data?.status?.code?.toString() !== '0') {
        const message = data?.status?.errorCallstack?.[0] ?? '';
        const errorMsg = rpcApiJson[method]['error'];
        const code = data?.status?.code as keyof typeof errorMsg;

        const msg = errorMsg[code] ?? message;
        if (code === -300) {
          const msgcode = message?.split('output:')?.[1]?.trim() ?? '';

          const errorByte: string = (
            msgcode.replace(/\(([-\d]+)\)$/, '') ?? ''
          ).substring(136);
          let errMsg = '';
          try {
            const _err = Buffer.from(errorByte, 'hex').toString('utf8');
            if (_err) {
              errMsg = _err;
            }
          } catch {
            errMsg = msg;
          }

          if (!errMsg) {
            throw new Error(msg);
          }
          throw new Error(errMsg);
        } else if (msg) {
          throw new Error(msg);
        } else {
          throw new Error(message);
        }
      }
      return result;
    } catch (err) {
      if (['SendMessage', 'SendContractMessage'].includes(method)) {
        return { txHash: ethers.ZeroHash } as any;
      }
      throw err;
    }
  };

  call = async <K extends RpcApiPath>(
    method: K,
    params: RpcApiParams<K>,
    options?: { outputResult?: boolean },
  ): Promise<RpcApiResult<K>> => {
    const param = {
      params: params,
      id: this.nonce.toString(),
      jsonrpc: this.version,
      method: method,
    };
    this.nonce++;

    return this.post(method, param, options);
  };

  estimatedGas = async <K extends RpcApiPath>(
    method: K,
    params: RpcApiParams<K>,
  ): Promise<string> => {
    const res = (await this.call(method, params, {
      outputResult: false,
    })) as any;

    const txData = res.tx ? JSON.parse(res.tx) || {} : {};
    const val =
      txData?.utxos
        ?.flatMap((u: any) => u.vout || [])
        ?.find((v: any) => v.addr === 'VirtualBurnGas' && v.value)?.value ??
      '0';

    return val;
  };

  getTokenInfo = async (param: {
    token: {
      address: string;
      deployer: string;
      deployutxo: string;
    };
    from: string;
  }) => {
    const contract = param.token.address;
    const erc20 = new ERC20(contract);
    const symbolData = await erc20.getFunction('symbol');
    const params = {
      addr: param.from,
      args: symbolData.data,
      contract_address: contract,
      deployer: param.token.deployer,
      deployutxo: param.token.deployutxo,
      encoded_info: '',
      gas_asset: {
        addr: param.from,
        asset_type: 'OHI',
      },
      is_find_utxo: false,
      istochain: false,
      money: '0',
      pubstr: '',
      sleeptime: '10',
      sponsor_gas: false,
    };

    const symbolTxData = await this.call(
      'CreateCallContractTransaction',
      params,
    );

    const symbolTxJson = JSON.parse(symbolTxData['tx'] || '{}');
    const symbolOut = JSON.parse(symbolTxJson['data'])?.['txinfo']?.['output'];

    const decimalsData = await erc20.getFunction('decimals');

    const decimalsTxData = await this.call('CreateCallContractTransaction', {
      ...params,
      args: decimalsData.data,
    });

    const decimalsTxJson = JSON.parse(decimalsTxData['tx'] || '{}');
    const decimalsOut = JSON.parse(decimalsTxJson['data'])?.['txinfo']?.[
      'output'
    ];

    const abidecode = new ethers.AbiCoder();

    return {
      ...param.token,
      address: contract,
      decimals: Number(
        abidecode.decode(['uint256'], '0x' + decimalsOut).toString(),
      ),
      symbol: abidecode.decode(['string'], '0x' + symbolOut).toString(),
    };
  };

  confirmTx = async (hash: string) => {
    if (hash === ethers.ZeroHash) {
      return true;
    }
    const res = await this.call('GetTransactionByHash', { hash: hash });
    if (res) {
      return true;
    } else {
      throw new Error('Transaction failed');
    }
  };

  getBalance = async (param: RpcApiParams<'GetBalance'>) => {
    const res = await this.call('GetBalance', {
      ...param,
      addr: ethers.getAddress(param.addr),
    });

    return res.balance;
  };

  // balanceOf = async (param: {
  //   from: string;
  //   to: string;
  //   token: {
  //     address: string;
  //     deployer: string;
  //     deployutxo: string;
  //   };
  //   pubkey: string;
  // }) => {
  //   try {
  //     const erc20 = new ERC20(param.token.address);
  //     const data = await erc20.getFunction('balanceOf', param.from);

  //     const txData = await this.createContractTransaction({
  //       ...param,
  //       istochain: true,
  //       pubkey: '',
  //       args: data.data,
  //       amount: '0',
  //       token: param.token,
  //     });
  //     const txJson = JSON.parse(txData['tx'] || '{}');
  //     const output = JSON.parse(txJson['data'])?.['txinfo']?.['output'];

  //     return BigInt(
  //       output.startsWith('0x') ? output : `0x${output}`,
  //     ).toString();
  //   } catch {
  //     return '0';
  //   }
  // };

  createTransaction = async (param: {
    from: string;
    to: string;
    amount: bigint | string;
    token: {
      address: string;
      deployer: string;
      deployutxo: string;
    };
    gasToken: {
      assetType: string;
      deployer: string;
      deployutxo: string;
    };
  }) => {
    const { from, to, amount, token, gasToken } = param;
    const gasAsset = gasToken.assetType;
    const tokenAsset = token.address;

    const _from = from;
    const _to = to;
    const txData = await this.call('CreateTransaction', {
      encoded_info: '',
      gas_asset: {
        addr: _from,
        asset_type: gasAsset,
      },
      is_find_utxo: false,
      sponsor_gas: gasAsset !== tokenAsset,
      tx_table: [
        {
          asset_type: tokenAsset,
          from_addr: from,
          to_addrs: [
            {
              addr: _to,
              amount: amount.toString(),
            },
          ],
        },
      ],
    });

    return txData;
  };

  createContractTransaction = async (param: {
    from: string;
    amount: bigint | string;
    token: {
      address: string;
      deployer: string;
      deployutxo: string;
    };
    gasToken?: {
      assetType: string;
      deployer: string;
      deployutxo: string;
    };
    pubkey: string;
    istochain: boolean;
    args: string; // contract data
    to?: string;
  }) => {
    const { from, token, gasToken, pubkey, istochain } = param;
    const gasAsset = gasToken?.assetType;

    const tokenAsset = token?.address;

    const _from = from;
    const deployer = token?.deployer;
    const txData = await this.call('CreateCallContractTransaction', {
      addr: _from,
      args: param.args,
      contract_address: tokenAsset,
      deployer: deployer || '',
      deployutxo: token?.deployutxo || '',
      gas_asset: {
        addr: _from,
        asset_type: gasAsset ?? 'OHI',
      },
      is_find_utxo: false,
      sponsor_gas: gasAsset !== tokenAsset,
      istochain: istochain,
      money: '0',
      pubstr: pubkey,
      sleeptime: '10',
      encoded_info: '',
    });

    return txData;
  };

  async isApprove(param: {
    token: {
      address: string;
      deployer: string;
      deployutxo: string;
    };
    owner: string;
    spender: string;
    amount: bigint;
    pubkey: string;
  }) {
    const erc20 = new ERC20(param.token.address);
    const data = await erc20.getFunction(
      'allowance',
      ...[param.owner, param.spender],
    );

    const txData = await this.createContractTransaction({
      ...param,
      from: param.owner,
      istochain: false,
      pubkey: param.pubkey,
      args: data!.data!,
      amount: '0',
    });

    const txJson = JSON.parse(txData['tx'] || '{}');
    const output = JSON.parse(txJson['data'])?.['txinfo']?.['output'];
    const available = BigInt(output.startsWith('0x') ? output : `0x${output}`);

    return param.amount <= available;
  }

  getAddrType(addr: string) {
    return this.call('GetAddrType', { addr });
  }
  getBonusClaimableAmount(addr: string) {
    return this.call('GetBonusClaimableAmount', { addr });
  }
  getFundClaimableAmount(addr: string) {
    return this.call('GetFundClaimableAmount', { addr });
  }
}
