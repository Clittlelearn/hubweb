import { useMemo, useState } from 'react';
import { Globe, LoaderCircle } from 'lucide-react';
import { TokenIcon } from './token-icon';
import { useWallet } from '../providers/wallet-provider';
import { useConnection } from 'wagmi';

export function AddNetworkButton() {
  const { currentNetwork, ensureWalletNetwork } = useWallet();
  const connection = useConnection();
  const connector = connection.connector;

  const [isApplyingNetwork, setIsApplyingNetwork] = useState(false);
  const activeChainId = useMemo(() => {
    return connection.chainId;
  }, [connection]);

  const isCurrentChainId = useMemo(() => {
    return activeChainId === currentNetwork.chainId;
  }, [activeChainId, currentNetwork]);

  const handleAddNetwork = async () => {
    setIsApplyingNetwork(true);

    try {
      await ensureWalletNetwork();
    } finally {
      setIsApplyingNetwork(false);
    }
  };

  return connection.isConnected && !isCurrentChainId ? (
    <button
      onClick={() => {
        void handleAddNetwork();
      }}
      disabled={isApplyingNetwork}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all cursor-pointer ${
        isApplyingNetwork
          ? 'border-primary/30 bg-primary/10'
          : 'border-border/50 bg-secondary/30 hover:border-primary/40 hover:bg-primary/5'
      }`}>
      {isApplyingNetwork ? (
        <>
          <LoaderCircle className='h-3 w-3 animate-spin text-primary' />
          <span className='text-primary'>{currentNetwork.chainName}</span>
        </>
      ) : (
        <>
          {connector?.icon ? (
            <TokenIcon
              src={connector.icon}
              alt={connector.name ?? 'Wallet'}
              fallback={connector.name ?? 'Wallet'}
              className='h-4 w-4 border-white/10 bg-background/60 shadow-none'
              fallbackClassName='text-[8px] font-bold tracking-normal'
            />
          ) : (
            <Globe className='h-3 w-3 text-muted-foreground' />
          )}
          <span className='text-muted-foreground'>
            {currentNetwork.chainName}
          </span>
        </>
      )}
    </button>
  ) : null;
}
