import type {
  FlowAssetInfo,
  Validator,
  LockedAssetInfo,
  ProposalInfo,
  VoteTx,
  StakedInfo,
  InvestInfo,
  AddressTx,
  ContractInfo,
} from '@/app/types/backed-api';
import { HttpFetch } from './http-fetch';
import type { TokenInfo } from '@/app/types/common';

export class BackedApi extends HttpFetch {
  constructor(url: string, base: string) {
    super(url);
    this.base = base;
  }

  base = '';

  private async post(path: string, param?: any) {
    const formData = new FormData();
    if (param) {
      for (const k of Object.keys(param)) {
        if (![undefined, null].includes(param[k])) {
          formData.append(k, param[k]);
        }
      }
    }
    const res = await this.httpPost(`${this.base}${path}`, formData);

    await new Promise((re) => {
      setTimeout(() => {
        re(true);
      }, 200);
    });
    if (res.code === 200) {
      return res.result;
    }
    throw new Error(res.message);
  }

  getAddressStake(param: { address: string }): Promise<StakedInfo> {
    return this.post('/getAddressStake', param);
  }

  async checkTodayIsReward(param: {
    address: string;
    type: string;
  }): Promise<boolean> {
    const res = await this.post('/checkTodayIsReward', param);

    return res === '1';
  }

  async getValidatorList(param: {
    address: string;
    searchAddress?: string;
    pageNum: number;
    pageSize: number;
  }): Promise<{
    stakeInfo: null | any;
    award: string;
    count: number;
    investInfo?: null | InvestInfo;
    list: Validator[];
    currentAPR: string;
    validator?: Validator;
  }> {
    const res = await this.post('/validatorList', param);

    return {
      ...res,
      list: (res?.list ?? []).map((item: any) => ({
        ...item,
        investArray: item.investArray ? JSON.parse(item.investArray) : [],
      })),
    };
  }

  async getLockAmount(param: { address: string }): Promise<LockedAssetInfo> {
    const res = await this.post('/getLockAmount', param);

    return res
      ? {
          ...res,
          isValidator: res.isValidator === '1',
        }
      : ({} as any);
  }

  async getFlowInAssetList(): Promise<FlowAssetInfo[]> {
    const res = await this.post('/getFlowInAssetList');
    const list = (res || []).map((item: any) => ({
      ...item,
      decimals: item.decimals.length - 1,
    }));

    return list;
  }

  getProposalList(param: { selectType: string }): Promise<{
    approveVote: number;
    linuxTime: number;
    pendingCount: number;
    totalVote: number;
    againstVote: number;
    list: ProposalInfo[];
    pendingVote: number;
    rejectCount: number;
    passCount: number;
  }> {
    return this.post('/getProposalList', param);
  }

  getVoteTxList(param: {
    voteTxHash: string;
    voteType?: string;
    fromAddress?: string;
    pageNum: number;
    pageSize: number;
  }): Promise<{
    count: number;
    linuxTime: number;
    list: VoteTx[];
    nextDuring: number;
    proposal: ProposalInfo;
  }> {
    return this.post('/getVoteTxList', param);
  }

  async checkIsVote(param: {
    address: string;
    proposalTxHash: string;
  }): Promise<boolean> {
    const res = await this.post('/checkIsVote', param);

    return res === '1';
  }

  async myTokens(address: string): Promise<TokenInfo[]> {
    const res = await this.post('/myTokens', { address });

    const list = (res || []).map((item: any, index: number) => {
      const isFlow = item.isFlow === '1';
      const decimals = isFlow ? 8 : item.decimals.length - 1;

      return {
        ...item,
        isFlow,
        isNative: !item.contractAddress && !item.assetType,
        decimals: Math.max(0, decimals),
      };
    });

    return list;
  }

  addressTxList(params: {
    address: string;
    pageNum: number;
    pageSize: number;
  }): Promise<{
    list: AddressTx[];
    count: number;
  }> {
    return this.post('/addressTxList', params);
  }

  tokenList(params: {
    searchKey?: string;
    address: string;
    pageNum: number;
    pageSize: number;
  }): Promise<ContractInfo[]> {
    return this.post('/tokenList', params);
  }

  addToken(params: { address: string; contractAddress: string }) {
    return this.post('/bindAddressContract', params);
  }

  removeToken(params: { address: string; contractAddress: string }) {
    return this.post('/removeAddressContract', params);
  }
}
