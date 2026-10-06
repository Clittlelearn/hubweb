import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useWallet } from './wallet-provider';
import { getWalletData } from '../data/wallet';
import { TokenInfo } from '../types/common';

interface AccountAssetContextType {
  address: string;
  myTokens: TokenInfo[];
  fetchTokenListByAddr(): Promise<TokenInfo[]>;
}

const AccountAssetContext = createContext<AccountAssetContextType | null>(null);

function AccountAssetContextProvider({ children }: { children: ReactNode }) {
  const { address, currentNetwork } = useWallet();

  const [myTokens, setMyTokens] = useState<TokenInfo[]>([]);

  const nativeToken = useMemo(() => {
    const nativeCurrency = currentNetwork.nativeCurrency;
    const native = {
      assetType: nativeCurrency.symbol,
      decimals: nativeCurrency.decimals,
      isNative: true,
      logo: nativeCurrency.icon,
      name: nativeCurrency.name,
      symbol: nativeCurrency.symbol,
      balance: '0',
    };
    return native;
  }, [currentNetwork]);

  async function fetchTokenListByAddr() {
    if (!address) {
      setMyTokens([]);
      return [];
    }

    const snapshot = getWalletData(currentNetwork.key);
    const tokens: TokenInfo[] = snapshot.tokens.map((item, index) => {
      if (item.isNative) {
        return {
          isNative: true,
          balance: item.balance,
          decimals: nativeToken.decimals,
          symbol: nativeToken.symbol,
          name: nativeToken.name,
          contractAddress: '',
          assetType: nativeToken.assetType,
          deployHash: '',
          isFlow: false,
          logo: nativeToken.logo,
          ownerAddress: address,
          standard: 'NATIVE',
        };
      }

      return {
        isNative: false,
        balance: item.balance,
        decimals: 18,
        symbol: item.symbol,
        name: item.name,
        contractAddress: item.fullAddress || item.address || '',
        assetType: `asset-${item.symbol.toLowerCase()}-${index}`,
        deployHash: '',
        isFlow: false,
        logo: '',
        ownerAddress: address,
        standard: 'ERC20',
      };
    });

    setMyTokens(tokens);
    return tokens;
  }

  useEffect(() => {
    fetchTokenListByAddr();
    return;
  }, [currentNetwork, address]);

  return (
    <AccountAssetContext.Provider
      value={{
        address,
        myTokens,
        fetchTokenListByAddr,
      }}>
      {children}
    </AccountAssetContext.Provider>
  );
}

export function AccountAssetProvider({ children }: { children: ReactNode }) {
  return <AccountAssetContextProvider>{children}</AccountAssetContextProvider>;
}

export function useAccountAsset() {
  const context = useContext(AccountAssetContext);
  if (!context) {
    throw new Error(
      'useAccountAsset must be used within a AccountAssetProvider',
    );
  }

  return context;
}
