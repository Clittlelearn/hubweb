import { LoaderCircle, Minus, Plus, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from 'react';
import { ethers } from 'ethers';
import { useQueryClient } from '@tanstack/react-query';
import { CopyButton } from '../../components/copy-button';
import { TokenIcon } from '../../components/token-icon';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useLockBodyScroll } from '@/app/hooks/use-lock-body-scroll';
import { shortAddress } from '@/app/lib/format';
import { useApiService } from '@/app/hooks/use-app-apis';
import { useFeedback } from '@/app/providers/feedback-provider';
import { useWallet } from '@/app/providers/wallet-provider';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;
const CUSTOM_TOKEN_INFO_DEBOUNCE_MS = 600;

type WalletAddTokenTab = 'list' | 'custom';

type UnknownRecord = Record<string, unknown>;

interface WalletCatalogToken {
  tokenId: string;
  contractAddress: string;
  name: string;
  symbol: string;
  logoUrl: string;
  decimals: number;
  assetType: string;
  standard: string;
  isVerified: boolean;
  isAdded: boolean;
  isNativeAsset: boolean;
  listSource: 'catalog' | 'custom';
}

interface WalletAddTokenModalProps {
  open: boolean;
  onClose: () => void;
  onUpdated?: () => Promise<void> | void;
}

function getContractKey(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numeric) ? numeric : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return fallback;
}

function normalizeTokenCatalogItem(
  raw: unknown,
  activeAddressKey: string,
): WalletCatalogToken | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const contractAddress = asString(
    record.contractAddress || record.address,
  ).trim();

  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    return null;
  }

  const symbol = asString(record.symbol).trim() || '--';
  const name =
    asString(record.name || record.contractName).trim() ||
    symbol ||
    shortAddress(contractAddress);
  const legacyBoundAddressKey = getContractKey(asString(record.address));
  const isAddedFromLegacy =
    Boolean(activeAddressKey) &&
    Boolean(legacyBoundAddressKey) &&
    legacyBoundAddressKey === activeAddressKey;

  return {
    tokenId: asString(record.tokenId, contractAddress),
    contractAddress,
    name,
    symbol,
    logoUrl: asString(record.logoUrl || record.logo),
    decimals: asNumber(record.decimals, 18),
    assetType: asString(record.assetType),
    standard: asString(record.standard || record.contractType, 'ERC20'),
    isVerified: asBoolean(record.isVerified, false),
    isAdded: asBoolean(record.isAdded, isAddedFromLegacy),
    isNativeAsset: asBoolean(record.isNativeAsset, false),
    listSource: record.listSource === 'custom' ? 'custom' : 'catalog',
  };
}

function normalizeTokenMetadata(raw: unknown): WalletCatalogToken | null {
  const record = asRecord(raw);

  if (!record) {
    return null;
  }

  const contractAddress = asString(record.contractAddress).trim();

  if (!contractAddress) {
    return null;
  }

  const symbol = asString(record.symbol).trim() || '--';

  return {
    tokenId: asString(record.tokenId, contractAddress),
    contractAddress,
    name: asString(record.name, symbol) || symbol,
    symbol,
    logoUrl: asString(record.logoUrl),
    decimals: asNumber(record.decimals, 18),
    assetType: asString(record.assetType),
    standard: asString(record.standard, 'ERC20'),
    isVerified: asBoolean(record.isVerified, false),
    isAdded: asBoolean(record.isAdded, false),
    isNativeAsset: asBoolean(record.isNativeAsset, false),
    listSource: record.listSource === 'catalog' ? 'catalog' : 'custom',
  };
}

export function WalletAddTokenModal({
  open,
  onClose,
  onUpdated,
}: WalletAddTokenModalProps) {
  const { address, currentNetwork } = useWallet();
  const queryClient = useQueryClient();
  const apiService = useApiService();
  const { showError, showSuccess } = useFeedback();

  const listRef = useRef<HTMLDivElement>(null);
  // Drop stale async results when the user types quickly or closes the modal mid-request.
  const requestSeqRef = useRef(0);
  const customTokenInfoRequestSeqRef = useRef(0);

  const [activeTab, setActiveTab] = useState<WalletAddTokenTab>('list');
  const [contractAddr, setContractAddr] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchComposing, setIsSearchComposing] = useState(false);
  const [customTokenInfo, setCustomTokenInfo] =
    useState<WalletCatalogToken | null>(null);
  const [customTokenInfoError, setCustomTokenInfoError] = useState('');
  const [isCustomTokenInfoLoading, setIsCustomTokenInfoLoading] =
    useState(false);
  const [tokens, setTokens] = useState<WalletCatalogToken[]>([]);
  const [pageNum, setPageNum] = useState(1);
  const [listError, setListError] = useState('');
  const [metadataWarning, setMetadataWarning] = useState('');
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [metadataSupported, setMetadataSupported] = useState(false);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const tokensRef = useRef<WalletCatalogToken[]>([]);
  const metadataControllerRef = useRef<AbortController | null>(null);
  const [isListLoading, setIsListLoading] = useState(false);
  const [submittingContract, setSubmittingContract] = useState<string | null>(
    null,
  );
  const [isCustomSubmitting, setIsCustomSubmitting] = useState(false);

  const activeAddressKey = useMemo(() => getContractKey(address), [address]);

  const resetState = useCallback(() => {
    requestSeqRef.current += 1;
    customTokenInfoRequestSeqRef.current += 1;
    setActiveTab('list');
    setContractAddr('');
    setSearchValue('');
    setSearchKeyword('');
    setIsSearchComposing(false);
    setCustomTokenInfo(null);
    setCustomTokenInfoError('');
    setIsCustomTokenInfoLoading(false);
    setTokens([]);
    tokensRef.current = [];
    setPageNum(1);
    setMetadataSupported(false);
    setIsMetadataLoading(false);
    metadataControllerRef.current?.abort();
    setListError('');
    setMetadataWarning('');
    setIsListLoading(false);
    setSubmittingContract(null);
    setIsCustomSubmitting(false);
  }, []);

  const handleClose = () => {
    metadataControllerRef.current?.abort();
    requestSeqRef.current += 1;
    customTokenInfoRequestSeqRef.current += 1;
    onClose();
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const loadTokens = useCallback(
    async () => {
      const requestId = requestSeqRef.current + 1;
      requestSeqRef.current = requestId;
      setListError('');

      metadataControllerRef.current?.abort();
      setIsListLoading(true);

      try {
        if (!address) {
          setTokens([]);
          setPageNum(1);
          return;
        }

        const params = {
          chainId: currentNetwork.chainId,
          address,
        };
        const data = await queryClient.fetchQuery({
          queryKey: ['wallet-token-catalog', 'directory-v2', currentNetwork.key, params],
          queryFn: () => apiService.walletTokenCatalogEntries(params), staleTime: 30_000,
        });

        if (requestId !== requestSeqRef.current) {
          return;
        }

        const normalizedList = Array.isArray(data.list)
          ? data.list
              .map((item) => normalizeTokenCatalogItem(item, activeAddressKey))
              .filter((item): item is WalletCatalogToken => Boolean(item))
          : [];

        setMetadataWarning(data.metadataWarning ?? '');
        tokensRef.current = normalizedList;
        setTokens(normalizedList);
        setPageNum(1);
        setMetadataSupported(data.metadataSupported === true);
        setCatalogVersion(version => version + 1);
      } catch (error) {
        if (requestId !== requestSeqRef.current) {
          return;
        }

        setListError(
          error instanceof Error ? error.message : 'Failed to load token list.',
        );

        setTokens([]);
      } finally {
        if (requestId === requestSeqRef.current) {
          setIsListLoading(false);
        }
      }
    },
    [activeAddressKey, address, apiService, currentNetwork.chainId, currentNetwork.key, queryClient],
  );

  const filteredTokens = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return tokens.filter(token => [token.name, token.symbol, token.contractAddress, token.tokenId]
      .some(value => value.toLowerCase().includes(keyword)));
  }, [tokens, searchKeyword]);
  const visibleTokens = filteredTokens.slice(0, pageNum * PAGE_SIZE);
  const hasMore = visibleTokens.length < filteredTokens.length;

  useEffect(() => {
    if (!open || activeTab !== 'list' || !metadataSupported || !catalogVersion) return;
    const controller = new AbortController();
    metadataControllerRef.current = controller;
    const keyword = searchKeyword.trim().toLowerCase();
    const entries = [...tokensRef.current].sort((a, b) => {
      const matches = (token: WalletCatalogToken) => [token.name, token.symbol, token.contractAddress]
        .some(value => value.toLowerCase().includes(keyword));
      return Number(matches(b)) - Number(matches(a));
    });
    let failures = false;
    setIsMetadataLoading(entries.some(entry => !entry.isVerified));
    void apiService.enrichWalletTokenCatalog(entries, controller.signal, (entry, failed) => {
      failures ||= failed;
      if (failed) return;
      setTokens(current => {
        const next = current.map(token => getContractKey(token.contractAddress) === getContractKey(entry.contractAddress)
          ? { ...token, name: entry.name, symbol: entry.symbol, decimals: entry.decimals, isVerified: true } : token);
        tokensRef.current = next;
        return next;
      });
    }).then(result => {
      if (controller.signal.aborted) return;
      setIsMetadataLoading(false);
      if (failures || result.unavailable) setMetadataWarning('Some token names are unavailable. Search results may be incomplete.');
      else setMetadataWarning('');
    });
    return () => controller.abort();
  }, [open, activeTab, catalogVersion, metadataSupported, apiService, searchKeyword]);

  useEffect(() => {
    if (!open || activeTab !== 'list') {
      return;
    }

    // Wait until the user stops typing, and do not search during IME composition.
    if (isSearchComposing) {
      return;
    }

    if (!searchValue.trim()) {
      setSearchKeyword('');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSearchKeyword(searchValue.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, isSearchComposing, open, searchValue]);

  useEffect(() => {
    if (!open || activeTab !== 'list') {
      return;
    }

    listRef.current?.scrollTo({ top: 0 });

    void loadTokens();
    return () => { requestSeqRef.current += 1; metadataControllerRef.current?.abort(); };
  }, [activeTab, loadTokens, open]);

  useEffect(() => {
    setPageNum(1);
    listRef.current?.scrollTo({ top: 0 });
  }, [searchKeyword]);

  useEffect(() => {
    if (!open || activeTab !== 'custom') {
      return;
    }

    const nextContractAddress = contractAddr.trim();

    if (!nextContractAddress) {
      customTokenInfoRequestSeqRef.current += 1;
      setCustomTokenInfo(null);
      setCustomTokenInfoError('');
      setIsCustomTokenInfoLoading(false);
      return;
    }

    if (!ethers.isAddress(nextContractAddress)) {
      customTokenInfoRequestSeqRef.current += 1;
      setCustomTokenInfo(null);
      setCustomTokenInfoError('');
      setIsCustomTokenInfoLoading(false);
      return;
    }

    const requestId = customTokenInfoRequestSeqRef.current + 1;
    customTokenInfoRequestSeqRef.current = requestId;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setIsCustomTokenInfoLoading(true);
        setCustomTokenInfoError('');

        try {
          const data = await apiService.walletTokenMetadata({
            chainId: currentNetwork.chainId,
            address,
            contractAddress: nextContractAddress,
          });

          if (requestId !== customTokenInfoRequestSeqRef.current) {
            return;
          }

          const normalized = normalizeTokenMetadata(data);

          if (!normalized) {
            throw new Error('Invalid token metadata response.');
          }

          setCustomTokenInfo(normalized);
        } catch (error) {
          if (requestId !== customTokenInfoRequestSeqRef.current) {
            return;
          }

          setCustomTokenInfo(null);
          setCustomTokenInfoError(
            error instanceof Error
              ? error.message
              : 'Failed to load token metadata.',
          );
        } finally {
          if (requestId === customTokenInfoRequestSeqRef.current) {
            setIsCustomTokenInfoLoading(false);
          }
        }
      })();
    }, CUSTOM_TOKEN_INFO_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, address, apiService, contractAddr, currentNetwork.chainId, open]);

  const handleListScroll = async (event: UIEvent<HTMLDivElement>) => {
    if (isListLoading || !hasMore) {
      return;
    }

    const target = event.currentTarget;
    const isNearBottom =
      target.scrollTop + target.clientHeight >= target.scrollHeight - 32;

    if (!isNearBottom) {
      return;
    }

    setPageNum(page => page + 1);
  };

  const handleToggleToken = async (token: WalletCatalogToken) => {
    const contractAddress = token.contractAddress.trim();

    if (!address || !contractAddress) {
      showError('Invalid token', 'The selected token has no contract address.');
      return;
    }

    const contractKey = getContractKey(contractAddress);

    if (token.isNativeAsset) {
      showError(
        'Native asset',
        'This token has already flowed in and is managed as a native asset.',
      );
      return;
    }

    setSubmittingContract(contractKey);

    try {
      if (token.isAdded) {
        await apiService.walletRemoveToken(contractAddress, {
          chainId: currentNetwork.chainId,
          address,
          tokenId: token.tokenId || undefined,
        });
      } else {
        await apiService.walletBindToken({
          chainId: currentNetwork.chainId,
          address,
          tokenId: token.tokenId || contractAddress,
          contractAddress,
        });
      }

      setTokens((currentTokens) =>
        currentTokens.map((item) =>
          getContractKey(item.contractAddress) === contractKey
            ? { ...item, isAdded: !token.isAdded }
            : item,
        ),
      );

      await queryClient.invalidateQueries({ queryKey: ['wallet-token-catalog'] });

      if (onUpdated) {
        await onUpdated();
      }

      showSuccess(
        token.isAdded ? 'Token removed' : 'Token added',
        `${token.symbol || token.name || shortAddress(contractAddress)} ${
          token.isAdded ? 'was removed from' : 'was added to'
        } your wallet list.`,
      );
    } catch (error) {
      showError(
        token.isAdded ? 'Remove token failed' : 'Add token failed',
        error instanceof Error
          ? error.message
          : 'Please try again in a moment.',
      );
    } finally {
      setSubmittingContract(null);
    }
  };

  const handleCustomAdd = async () => {
    const contractAddress = contractAddr.trim();

    if (!address || !contractAddress) {
      showError('Missing address', 'Enter a token contract address first.');
      return;
    }

    if (!ethers.isAddress(contractAddress)) {
      showError('Invalid contract', 'Enter a valid token contract address.');
      return;
    }

    if (!customTokenInfo) {
      showError(
        'Token info unavailable',
        'Wait for the token metadata to load before adding this contract.',
      );
      return;
    }

    if (customTokenInfo.isAdded) {
      showError('Token already added', 'This token is already in your wallet.');
      return;
    }

    setIsCustomSubmitting(true);

    try {
      await apiService.walletBindCustomToken({
        chainId: currentNetwork.chainId,
        address,
        contractAddress,
      });
      await queryClient.invalidateQueries({ queryKey: ['wallet-token-catalog'] });

      showSuccess(
        'Token added',
        `${shortAddress(contractAddress)} was added to your wallet list.`,
      );

      if (onUpdated) {
        await onUpdated();
      }

      handleClose();
    } catch (error) {
      showError(
        'Add token failed',
        error instanceof Error
          ? error.message
          : 'Please try again in a moment.',
      );
    } finally {
      setIsCustomSubmitting(false);
    }
  };

  const isSearching =
    Boolean(searchValue.trim()) && searchValue.trim() !== searchKeyword;
  const normalizedCustomContract = contractAddr.trim();
  const isCustomContractValid = ethers.isAddress(normalizedCustomContract);
  const canAddCustomToken =
    Boolean(normalizedCustomContract) &&
    isCustomContractValid &&
    Boolean(customTokenInfo) &&
    !customTokenInfo?.isAdded &&
    !isCustomTokenInfoLoading &&
    !isCustomSubmitting;

  useLockBodyScroll(open);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
          onClick={handleClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className='w-full max-w-2xl'
            onClick={(event) => event.stopPropagation()}>
            <Card className='gap-0 overflow-hidden border-border/50 bg-card p-0'>
              <div className='flex items-center justify-between border-b border-border/30 px-3 py-2 md:px-6 md:py-5'>
                <div className='flex items-center gap-3'>
                  <div className='rounded-lg bg-primary/10 p-2'>
                    <Plus className='h-5 w-5 text-primary' />
                  </div>
                  <div>
                    <h3 className='text-xl font-bold'>Manage Tokens</h3>
                    <p className='text-sm text-muted-foreground'>
                      Add from the list or bind a custom token contract.
                    </p>
                  </div>
                </div>
                <button
                  type='button'
                  onClick={handleClose}
                  aria-label='Close Manage Tokens'
                  className='cursor-pointer p-1 text-muted-foreground hover:text-foreground'>
                  <X className='h-5 w-5' />
                </button>
              </div>

              <div className='space-y-4 p-4'>
                <div className='inline-flex rounded-lg border border-border/40 bg-secondary/30 p-1'>
                  {(['list', 'custom'] as const).map((tab) => (
                    <button
                      key={tab}
                      type='button'
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-md px-4 py-2 text-sm capitalize transition-colors ${
                        activeTab === tab
                          ? 'bg-primary/20 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}>
                      {tab}
                    </button>
                  ))}
                </div>

                {activeTab === 'list' ? (
                  <div className='space-y-4'>
                    <div className='space-y-2'>
                      <div className='relative'>
                        <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                        <Input
                          placeholder='Search by symbol, name, or contract address'
                          value={searchValue}
                          onChange={(event) =>
                            setSearchValue(event.target.value)
                          }
                          onCompositionStart={() => setIsSearchComposing(true)}
                          onCompositionEnd={(event) => {
                            setIsSearchComposing(false);
                            setSearchValue(event.currentTarget.value);
                          }}
                          className='truncate border-border/50 bg-secondary/30 pl-10'
                        />
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        Scroll to the bottom to load more results.
                      </p>
                    </div>

                    {metadataWarning && <p role='status' className='text-sm text-amber-400'>{metadataWarning}</p>}
                    <div
                      ref={listRef}
                      onScroll={(event) => {
                        void handleListScroll(event);
                      }}
                      className='max-h-[24rem] space-y-3 overflow-y-auto pr-1'>
                      {isListLoading && tokens.length === 0 ? (
                        <div className='flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-border/40 bg-secondary/20 text-sm text-muted-foreground'>
                          <LoaderCircle className='h-5 w-5 animate-spin text-primary' />
                          <span>
                            {isSearching
                              ? 'Searching tokens...'
                              : 'Loading token list...'}
                          </span>
                        </div>
                      ) : listError ? (
                        <div className='flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 text-center text-sm text-muted-foreground'>
                          <p>{listError}</p>
                          <Button
                            type='button'
                            variant='outline'
                            onClick={() => {
                              void loadTokens();
                            }}>
                            Retry
                          </Button>
                        </div>
                      ) : visibleTokens.length === 0 ? (
                        <div className='flex min-h-56 items-center justify-center rounded-xl border border-border/40 bg-secondary/20 px-6 text-center text-sm text-muted-foreground'>
                          {isMetadataLoading ? 'Searching token names...' : 'No tokens found.'}
                        </div>
                      ) : (
                        <>
                          {visibleTokens.map((token) => {
                            const contractKey = getContractKey(
                              token.contractAddress,
                            );
                            const isAdded = token.isAdded;
                            const isNativeAsset = token.isNativeAsset;
                            const isSubmitting =
                              submittingContract === contractKey;

                            return (
                              <div
                                key={`${token.contractAddress}-${token.tokenId}`}
                                className='flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-secondary/20 p-4'>
                                <div className='min-w-0 flex items-center gap-3'>
                                  <TokenIcon
                                    src={token.logoUrl}
                                    alt={token.name || token.symbol}
                                    fallback={
                                      token.name ||
                                      token.symbol ||
                                      token.contractAddress
                                    }
                                    className='h-10 w-10'
                                  />
                                  <div className='min-w-0'>
                                    <p className='truncate font-medium'>
                                      <span>{token.name || '-'}</span>
                                      <span className='truncate text-sm text-muted-foreground'>
                                        {' '}
                                        ({token.symbol || '-'})
                                      </span>
                                    </p>
                                    <div className='flex items-center gap-1.5'>
                                      <p className='truncate font-mono text-xs text-muted-foreground'>
                                        {shortAddress(token.contractAddress)}
                                      </p>
                                      <CopyButton
                                        value={token.contractAddress}
                                        label={`${
                                          token.symbol || token.name || 'Token'
                                        } contract address`}
                                        iconClassName='h-3.5 w-3.5'
                                        className='shrink-0'
                                      />
                                      {token.isVerified ? (
                                        <span className='rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary'>
                                          Verified
                                        </span>
                                      ) : null}
                                      {isNativeAsset ? (
                                        <span className='rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400'>
                                          Native asset
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='icon'
                                  onClick={() => {
                                    void handleToggleToken(token);
                                  }}
                                  disabled={isSubmitting || isNativeAsset || (!token.isVerified && !isAdded)}
                                  aria-label={
                                    isNativeAsset
                                      ? `${token.symbol || token.name || 'Token'} is a native asset`
                                      : isAdded
                                      ? `Remove ${token.symbol || token.name || 'token'}`
                                      : `Add ${token.symbol || token.name || 'token'}`
                                  }
                                  title={
                                    isNativeAsset
                                      ? 'Already managed as a native asset'
                                      : isAdded
                                        ? 'Remove token'
                                        : token.isVerified ? 'Add token' : 'Token metadata unavailable'
                                  }
                                  className={
                                    isNativeAsset
                                      ? 'border-blue-400/30 text-blue-400 opacity-70'
                                      : isAdded
                                      ? 'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'
                                      : 'border-primary/40 text-primary hover:bg-primary/10 hover:text-primary'
                                  }>
                                  {isSubmitting ? (
                                    <LoaderCircle className='h-4 w-4 animate-spin' />
                                  ) : isNativeAsset ? (
                                    <span className='text-xs'>—</span>
                                  ) : isAdded ? (
                                    <Minus className='h-4 w-4' />
                                  ) : (
                                    <Plus className='h-4 w-4' />
                                  )}
                                </Button>
                              </div>
                            );
                          })}

                          {isMetadataLoading ? (
                            <div className='flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground'>
                              <LoaderCircle className='h-4 w-4 animate-spin text-primary' />
                              Loading token names...
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className='space-y-5'>
                    <div>
                      <label className='mb-2 block text-sm text-muted-foreground'>
                        Token Contract Address
                      </label>
                      <Input
                        placeholder='0x...'
                        value={contractAddr}
                        onChange={(event) =>
                          setContractAddr(event.target.value)
                        }
                        className='border-border/50 bg-secondary/30 font-mono'
                      />
                    </div>

                    {isCustomTokenInfoLoading ? (
                      <div className='flex items-center gap-2 rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm text-muted-foreground'>
                        <LoaderCircle className='h-4 w-4 animate-spin text-primary' />
                        <span>Loading token info...</span>
                      </div>
                    ) : customTokenInfo ? (
                      <div className='rounded-xl border border-border/40 bg-secondary/20 p-4'>
                        <div className='flex items-center gap-3'>
                          <TokenIcon
                            src={customTokenInfo.logoUrl}
                            alt={customTokenInfo.name || customTokenInfo.symbol}
                            fallback={
                              customTokenInfo.symbol ||
                              customTokenInfo.name ||
                              customTokenInfo.contractAddress
                            }
                            className='h-10 w-10'
                          />
                          <div className='min-w-0'>
                            <p className='truncate font-medium'>
                              {customTokenInfo.name || '-'}
                            </p>
                            <p className='truncate text-sm text-muted-foreground'>
                              {customTokenInfo.symbol || '-'} · Decimals{' '}
                              {customTokenInfo.decimals}
                            </p>
                            <div className='mt-1 flex items-center gap-1.5'>
                              <p className='truncate font-mono text-xs text-muted-foreground'>
                                {shortAddress(customTokenInfo.contractAddress)}
                              </p>
                              <CopyButton
                                value={customTokenInfo.contractAddress}
                                label={`${
                                  customTokenInfo.symbol ||
                                  customTokenInfo.name ||
                                  'Token'
                                } contract address`}
                                iconClassName='h-3.5 w-3.5'
                                className='shrink-0'
                              />
                              {customTokenInfo.isAdded ? (
                                <span className='rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground'>
                                  Added
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : customTokenInfoError ? (
                      <div className='rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-muted-foreground'>
                        {customTokenInfoError}
                      </div>
                    ) : null}

                    <Button
                      type='button'
                      onClick={() => {
                        void handleCustomAdd();
                      }}
                      disabled={!canAddCustomToken}
                      className='h-12 w-full cursor-pointer bg-primary hover:bg-primary/90'>
                      {isCustomSubmitting ? (
                        <LoaderCircle className='mr-2 h-4 w-4 animate-spin' />
                      ) : customTokenInfo?.isAdded ? (
                        <Minus className='mr-2 h-4 w-4' />
                      ) : (
                        <Plus className='mr-2 h-4 w-4' />
                      )}
                      {customTokenInfo?.isAdded ? 'Already Added' : 'Add Token'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
