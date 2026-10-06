import type { NetworkKey } from "../lib/wallet";

export interface WalletToken {
  symbol: string;
  name: string;
  address: string;
  fullAddress: string;
  balance: string;
  iconLetter: string;
  isNative: boolean;
}

export interface WalletTransaction {
  type: "send" | "receive";
  token: string;
  amount: string;
  peer: string;
  timestamp: string;
  status: string;
}

export interface WalletSnapshot {
  nativeBalance: string;
  tokenPriceUsd: string;
  tokenPriceChange: string;
  balance: string;
  tokens: WalletToken[];
  transactions: WalletTransaction[];
}

const walletDataByNetwork: Record<NetworkKey, WalletSnapshot> = {
  devnet: {
    nativeBalance: "0",
    tokenPriceUsd: "$0",
    tokenPriceChange: "0%",
    balance:'0',
    tokens: [
      {
        symbol: "OHI",
        name: "OHI",
        address: "",
        fullAddress: "",
        balance: "125,430.50",
        iconLetter: "O",
        isNative: true,
      },
      {
        symbol: "MMV",
        name: "MMV (a)",
        address: "0xac035608...279a88a0",
        fullAddress: "0xac035608279a88a0",
        balance: "12,500.00",
        iconLetter: "M",
        isNative: false,
      },
      {
        symbol: "TES002",
        name: "tes002 (--)",
        address: "0x99d34cf2...3870fa77",
        fullAddress: "0x99d34cf23870fa77",
        balance: "5,200.00",
        iconLetter: "t",
        isNative: false,
      },
      {
        symbol: "TEST003",
        name: "test003 (--)",
        address: "0x186fefc0...f64954d9",
        fullAddress: "0x186fefc0f64954d9",
        balance: "0",
        iconLetter: "t",
        isNative: false,
      },
    ],
    transactions: [
      {
        type: "send",
        token: "OHI",
        amount: "500.00",
        peer: "0x9a3f...d2e1",
        timestamp: "2026-03-17 10:45",
        status: "completed",
      },
      {
        type: "receive",
        token: "MMV",
        amount: "1,200.00",
        peer: "0x742d...5e8f",
        timestamp: "2026-03-16 18:32",
        status: "completed",
      },
      {
        type: "send",
        token: "OHI",
        amount: "2,000.00",
        peer: "0x5b7c...a4f3",
        timestamp: "2026-03-16 14:20",
        status: "completed",
      },
      {
        type: "receive",
        token: "tes002",
        amount: "3,000.00",
        peer: "0x742d...5e8f",
        timestamp: "2026-03-15 09:15",
        status: "completed",
      },
      {
        type: "send",
        token: "MMV",
        amount: "800.00",
        peer: "0x1e4d...c7a9",
        timestamp: "2026-03-14 16:50",
        status: "completed",
      },
    ],
  },
  testnet: {
    nativeBalance: "12.88214",
    tokenPriceUsd: "$0.0194",
    tokenPriceChange: "+1.12%",
    balance: '0',
    tokens: [
      {
        symbol: "OHI",
        name: "OHI",
        address: "",
        fullAddress: "",
        balance: "248,900.75",
        iconLetter: "O",
        isNative: true,
      },
      {
        symbol: "MMT",
        name: "HiveX Test USD",
        address: "0x4f4f5a10...ae4832c1",
        fullAddress: "0x4f4f5a10ae4832c1",
        balance: "42,100.00",
        iconLetter: "M",
        isNative: false,
      },
      {
        symbol: "GOVT",
        name: "Governance Test",
        address: "0x77a91de2...1827ab52",
        fullAddress: "0x77a91de21827ab52",
        balance: "9,400.00",
        iconLetter: "G",
        isNative: false,
      },
    ],
    transactions: [
      {
        type: "receive",
        token: "OHI",
        amount: "15,000.00",
        peer: "0x12af...88c2",
        timestamp: "2026-03-18 08:12",
        status: "completed",
      },
      {
        type: "send",
        token: "MMT",
        amount: "2,500.00",
        peer: "0x7e4a...d190",
        timestamp: "2026-03-17 17:26",
        status: "completed",
      },
    ],
  },
  mainnet: {
    nativeBalance: "1.28412",
    tokenPriceUsd: "$0.0286",
    balance: '0',
    tokenPriceChange: "-0.34%",
    tokens: [
      {
        symbol: "OHI",
        name: "OHI",
        address: "",
        fullAddress: "",
        balance: "32,845.12",
        iconLetter: "O",
        isNative: true,
      },
      {
        symbol: "USDM",
        name: "USDM",
        address: "0x1ad2039f...6ab27ed4",
        fullAddress: "0x1ad2039f6ab27ed4",
        balance: "8,250.00",
        iconLetter: "U",
        isNative: false,
      },
    ],
    transactions: [
      {
        type: "send",
        token: "OHI",
        amount: "120.00",
        peer: "0x8fce...2814",
        timestamp: "2026-03-19 11:08",
        status: "completed",
      },
      {
        type: "receive",
        token: "USDM",
        amount: "750.00",
        peer: "0x64cd...f912",
        timestamp: "2026-03-18 13:40",
        status: "completed",
      },
    ],
  },
};

export function getWalletData(network: NetworkKey) {
  return walletDataByNetwork[network];
}
