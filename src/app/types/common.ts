export interface TokenInfo {
  isNative: boolean;
  balance: string;
  decimals: number;
  symbol: string;
  name: string;
  contractAddress: string;
  assetType: string;
  base64PubStr?: string;
  deployHash: string;
  id?: number;
  isFlow: boolean;
  logo: string;
  ownerAddress: string;
  standard?: string;
}