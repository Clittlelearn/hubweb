import {
  Wallet as WalletIcon,
  Copy,
  Check,
  Send,
  ArrowLeftRight,
  Plus,
  ExternalLink,
  QrCode,
  Coins,
  Layers,
  Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../../providers/wallet-provider';
import { AddNetworkButton } from '../../components/add-network-button';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ConnectWalletPrompt } from '../../components/connect-wallet-prompt';
import { useApiService } from '@/app/hooks/use-app-apis';
import { useFetchData } from '@/app/hooks/use-fetch-data';
import {
  formatAmount,
  restoreFormattedAmount,
  shortAddress,
} from '@/app/lib/format';
import { useCopyFeedback } from '@/app/hooks/use-copy-feedback';
import { WalletAddTokenModal } from './wallet-add-token-modal';
import { WalletQrModal } from './wallet-qr-modal';
import { WalletSendModal } from './wallet-send-modal';
import { WalletTokensTab } from './wallet-tokens-tab';
import {
  WalletTransactionsTab,
  type WalletTransactionRow,
} from './wallet-transactions-tab';
import { TokenInfo } from '@/app/types/common';
import { compareRawTokenBalances } from '@/app/lib/token-balance-sort';
import {
  asNumber,
  normalizeWalletOverview,
  normalizeWalletToken,
  normalizeWalletTransaction,
} from './utils';
import {
  WalletTokensReuslt,
  WalletTransactionsResult,
} from '@/app/types/api-service/wallet';

/* ====== Not Connected State ====== */
export default function WalletPage() {
  const { connected, walletConnected, address, currentNetwork, explorerUrl } = useWallet();
  const apiService = useApiService();

  const [activeTab, setActiveTab] = useState<'tokens' | 'transactions'>(
    'tokens',
  );
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [addTokenModalOpen, setAddTokenModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const { copiedValue, copy } = useCopyFeedback();

  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const targetChainId = currentNetwork.chainId;
  useEffect(() => {
    setAddTokenModalOpen(false);
    setSendModalOpen(false);
    setSelectedToken(null);
  }, [address, targetChainId]);
  const userQueryEnabled = connected && Boolean(address) && address !== '0x';

  const {
    rawData: walletTokensData,
    refetch: refetchWalletTokens,
    isLoading: isWalletTokensLoading,
    error: walletTokensError,
  } = useFetchData<WalletTokensReuslt, { chainId: number; address: string }>({
    queryKey: ['wallet-tokens', currentNetwork.key, targetChainId, address],
    includeParamsInQueryKey: false,
    autoRefresh: 15_000,
    queryFn: (params) => apiService.walletTokens(params),
    params: {
      chainId: targetChainId,
      address,
    },
    enabled: userQueryEnabled,
  });

  const {
    rawData: walletTransactionsData,
    refetch: refetchWalletTransactions,
    isLoading: isWalletTransactionsLoading,
    error: walletTransactionsError,
  } = useFetchData<
    WalletTransactionsResult,
    { chainId: number; address: string; pageNum: number; pageSize: number }
  >({
    queryKey: [
      'wallet-transactions',
      currentNetwork.key,
      targetChainId,
      address,
    ],
    queryFn: (params) => apiService.walletTransactions(params),
    params: {
      chainId: targetChainId,
      address,
      pageNum: 1,
      pageSize: 20,
    },
    enabled: userQueryEnabled,
  });

  const walletOverview = useMemo(() => {
    return normalizeWalletOverview(
      walletTokensData ? {
        totalBalance: walletTokensData.list.find(token => token.assetType === 'OHI')?.balance ?? '0',
        balanceSymbol: 'OHI', tokenCount: walletTokensData.list.length, txsCount: 0,
      } : undefined,
      currentNetwork.nativeCurrency.decimals,
    );
  }, [currentNetwork.nativeCurrency.decimals, walletTokensData]);

  const tokens = useMemo(() => {
    const rawList = walletTokensData?.list;
    if (!rawList || !Array.isArray(rawList)) {
      return [] as TokenInfo[];
    }

    return [...rawList]
      .sort(compareRawTokenBalances)
      .map((item) =>
        normalizeWalletToken(
          item,
          address,
          currentNetwork.nativeCurrency.decimals,
        ),
      )
      .filter((item): item is TokenInfo => Boolean(item));
  }, [address, currentNetwork.nativeCurrency.decimals, walletTokensData]);

  const totalBalance = useMemo(() => {
    if (walletOverview?.totalBalance) {
      return formatAmount(
        asNumber(walletOverview.totalBalance, 0),
        currentNetwork.nativeCurrency.decimals,
      );
    }

    return tokens.reduce(
      (s, t) => s + asNumber(restoreFormattedAmount(t.balance), 0),
      0,
    );
  }, [currentNetwork.nativeCurrency.decimals, tokens, walletOverview]);

  const transactions = useMemo(() => {
    const rawList = walletTransactionsData?.list;
    if (!rawList || !Array.isArray(rawList)) {
      return [] as WalletTransactionRow[];
    }

    return rawList
      .map((item) =>
        normalizeWalletTransaction(
          item,
          currentNetwork.nativeCurrency.decimals,
        ),
      )
      .filter((item): item is WalletTransactionRow => Boolean(item));
  }, [currentNetwork.nativeCurrency.decimals, walletTransactionsData]);

  const assetData = useMemo(() => {
    return [
      {
        label: 'Total Balance',
        value: walletTokensData ? totalBalance.toLocaleString() : '--',
        rawValue: walletOverview?.totalBalance,
        unit: walletOverview?.balanceSymbol || 'OHI',
        gradient: 'from-primary/15 via-primary/5 to-purple-500/15',
        border: 'border-primary/30',
        valueColor: 'text-primary',
        icon: <Coins className='w-5 h-5' />,
        iconBg: 'bg-primary/15 text-primary',
        glowColor: 'bg-primary/20',
      },
      {
        label: 'Tokens',
        value: String(walletOverview?.tokenCount ?? tokens.length),
        unit: 'Assets',
        gradient: 'from-purple-500/15 via-purple-500/5 to-blue-500/15',
        border: 'border-purple-500/30',
        valueColor: 'text-purple-400',
        icon: <Layers className='w-5 h-5' />,
        iconBg: 'bg-purple-500/15 text-purple-400',
        glowColor: 'bg-purple-500/20',
      },
      {
        label: 'Network',
        value: currentNetwork?.label ?? '--',
        unit: 'HiveX',
        gradient: 'from-green-500/15 via-green-500/5 to-emerald-500/15',
        border: 'border-green-500/30',
        valueColor: 'text-green-500',
        icon: <Globe className='w-5 h-5' />,
        iconBg: 'bg-green-500/15 text-green-500',
        glowColor: 'bg-green-500/20',
      },
    ];
  }, [currentNetwork?.label, tokens.length, totalBalance, walletOverview, walletTokensData]);

  const handleCopy = (value: string, label: string) => {
    void copy(value, {
      key: value,
      successMessage: `${label} copied.`,
      errorTitle: `${label} copy failed`,
      errorMessage: `Unable to copy the ${label.toLowerCase()}. Check browser permissions and try again.`,
    });
  };

  const refreshWalletData = async () => {
    await Promise.all([
      refetchWalletTokens(),
      refetchWalletTransactions(),
    ]);
  };

  if (!connected) {
    return (
      <ConnectWalletPrompt message='Connect your wallet to view assets, manage tokens, and send transactions.' />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='space-y-8'>
      {/* Page Header */}
      <div className='space-y-2'>
        <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-primary bg-clip-text text-transparent'>
          Wallet
        </h1>
        <p className='text-muted-foreground text-sm sm:text-base md:text-lg'>
          Manage your assets and send tokens
        </p>
      </div>

      {/* Wallet Address + Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}>
        <Card className='p-4 sm:p-6 bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/30'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
            <div className='flex items-center gap-4'>
              <div className='p-3 rounded-lg bg-primary/20'>
                <WalletIcon className='w-6 h-6 text-primary' />
              </div>
              <div>
                <div className='flex items-center gap-3'>
                  <p className='text-sm text-muted-foreground'>
                    Connected Wallet
                  </p>
                  <AddNetworkButton />
                </div>
                <div className='flex items-center gap-2 mt-1'>
                  <p className='font-mono font-medium'>
                    <span className=' lg:inline-block hidden'>{address}</span>
                    <span className=' lg:hidden inline-block '>
                      {shortAddress(address)}
                    </span>
                  </p>
                  <button
                    onClick={() => handleCopy(address, 'Wallet address')}
                    className='text-muted-foreground hover:text-foreground cursor-pointer'>
                    {copiedValue === address ? (
                      <Check className='w-4 h-4 text-green-500' />
                    ) : (
                      <Copy className='w-4 h-4' />
                    )}
                  </button>
                  <a
                    href={explorerUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-muted-foreground hover:text-foreground cursor-pointer'>
                    <ExternalLink className='w-4 h-4' />
                  </a>
                  <button
                    onClick={() => setQrModalOpen(true)}
                    className='text-muted-foreground hover:text-foreground cursor-pointer'>
                    <QrCode className='w-4 h-4' />
                  </button>
                </div>
              </div>
            </div>
            <div className='flex items-center gap-3'>
              <Button
                disabled={!walletConnected}
                onClick={() => setSendModalOpen(true)}
                className='bg-primary hover:bg-primary/90 cursor-pointer'>
                <Send className='w-4 h-4 mr-2' />
                Send
              </Button>
              <Button
                variant='outline'
                className='border-primary/30 text-primary hover:bg-primary/10 cursor-pointer'>
                <ArrowLeftRight className='w-4 h-4 mr-2' />
                Bridge
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Overview Cards */}
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6'>
        {assetData.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}>
            <Card
              className={`relative overflow-hidden p-3 sm:p-6 bg-gradient-to-br ${card.gradient} ${card.border} hover:border-opacity-60 transition-all duration-300 group`}>
              {/* Decorative glow */}
              <div
                className={`absolute -top-8 -right-8 w-24 h-24 ${card.glowColor} rounded-full blur-2xl opacity-60 group-hover:opacity-80 transition-opacity`}
              />
              {/* Corner grid pattern */}
              <div
                className='absolute bottom-0 right-0 w-20 h-20 opacity-[0.04]'
                style={{
                  backgroundImage:
                    'radial-gradient(circle, currentColor 1px, transparent 1px)',
                  backgroundSize: '8px 8px',
                }}
              />
              <div className='relative'>
                <div className='flex items-center justify-between mb-2 sm:mb-4'>
                  <p className='text-xs sm:text-sm text-muted-foreground'>
                    {card.label}
                  </p>
                  <div className={`p-1.5 sm:p-2 rounded-lg ${card.iconBg}`}>
                    {card.icon}
                  </div>
                </div>
                <p
                  className={`text-xl sm:text-3xl font-bold ${card.valueColor}`}
                  title={card.rawValue}>
                  {card.value}
                </p>
                <div className='flex items-center gap-2 mt-1 sm:mt-2'>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${card.valueColor.replace('text-', 'bg-')} animate-pulse`}
                  />
                  <p className='text-xs text-muted-foreground'>{card.unit}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-1 p-1 rounded-lg bg-secondary/30 border border-border/30'>
          {(['tokens', 'transactions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-md text-sm transition-all cursor-pointer capitalize ${
                activeTab === tab
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 'tokens' && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => setAddTokenModalOpen(true)}
            className='border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 cursor-pointer'>
            <Plus className='w-4 h-4 mr-1' />
            <span className=' md:inline-block hidden'>Add Token</span>
          </Button>
        )}
      </div>

      {/* Tab Content */}
      {walletTokensError && <div role='alert' className='flex items-center justify-between gap-3 text-sm text-destructive'>
        <span>{walletTokensData ? 'Balance refresh failed. Showing the last successful balance.' : 'Unable to load balances.'}</span>
        <Button variant='outline' size='sm' onClick={() => void refetchWalletTokens()}>Retry</Button>
      </div>}
      <AnimatePresence mode='wait'>
        {activeTab === 'tokens' ? (
          isWalletTokensLoading ? (
            <Card className='border-border/50 bg-card p-4 sm:p-6'>
              <div className='space-y-3'>
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className='h-[76px] animate-pulse rounded-lg border border-border/30 bg-secondary/20'
                  />
                ))}
              </div>
            </Card>
          ) : (
            <WalletTokensTab
              tokens={tokens}
              onSelectToken={(value) => {
                setSelectedToken(value);
                setSendModalOpen(true);
              }}
              copiedValue={copiedValue}
              onCopy={handleCopy}
            />
          )
        ) : (
          <WalletTransactionsTab
            transactions={transactions}
            isLoading={isWalletTransactionsLoading}
            error={walletTransactionsError}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <WalletSendModal
        open={sendModalOpen}
        tokens={tokens}
        token={selectedToken}
        onClose={() => setSendModalOpen(false)}
      />
      <WalletAddTokenModal
        open={addTokenModalOpen}
        onUpdated={refreshWalletData}
        onClose={() => setAddTokenModalOpen(false)}
      />
      <WalletQrModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        address={address}
      />
    </motion.div>
  );
}
