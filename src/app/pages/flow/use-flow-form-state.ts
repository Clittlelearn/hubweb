import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ethers } from 'ethers';
import { formatExpandedAmount } from '../../lib/format';
import {
  buildFlowTransactionDebugInfo,
  useFlowTransaction,
} from '@/app/hooks/use-flow-transaction';
import { useFeedback } from '@/app/providers/feedback-provider';
import { useWallet } from '@/app/providers/wallet-provider';
import type { FlowAssetOption } from './utils';
import { compareBalancesDescending } from '../../lib/token-balance-sort';

export type FlowDirection = 'in' | 'out';

// Show the exact spendable amount, without K/M suffixes or lost small units.
export function formatBalance(value: string) {
  return formatExpandedAmount(value || '0', value.split('.')[1]?.length ?? 0);
}

// Read the cached balance field that belongs to the current flow direction.
export function getRequestedBalance(
  asset: FlowAssetOption,
  direction: FlowDirection,
) {
  return direction === 'in' ? asset.erc20Balance : asset.flowBalance;
}

// Always return a printable balance string for validation and form display.
export function getAvailableBalance(
  asset: FlowAssetOption,
  direction: FlowDirection,
) {
  return getRequestedBalance(asset, direction) ?? '0';
}

// Switch the copied/displayed identifier based on the active flow direction.
export function getDisplayedAddress(
  asset: FlowAssetOption,
  direction: FlowDirection,
) {
  return direction === 'in' ? asset.contractAddress : asset.assetType;
}

// Keep the copy feedback label aligned with the displayed identifier.
export function getDisplayedAddressLabel(direction: FlowDirection) {
  return direction === 'in' ? 'Contract address' : 'Asset type hash';
}

export function parseFlowAmount(value: string, decimals: number) {
  try {
    const parsed = ethers.parseUnits(value, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export function canUseDirection(
  asset: FlowAssetOption,
  direction: FlowDirection,
) {
  return direction === 'in' ? asset.canFlowIn : asset.canFlowOut;
}

interface UseFlowFormStateOptions {
  assets: FlowAssetOption[];
  defaultAssetId?: string;
  isAssetsLoading?: boolean;
}

export function useFlowFormState({
  assets: unsortedAssets,
  defaultAssetId,
  isAssetsLoading = false,
}: UseFlowFormStateOptions) {
  const [activeTab, setActiveTab] = useState<FlowDirection>('in');
  const assets = useMemo(() => [...unsortedAssets].sort((a, b) =>
    compareBalancesDescending(getRequestedBalance(a, activeTab), getRequestedBalance(b, activeTab)),
  ), [unsortedAssets, activeTab]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { address, currentNetwork } = useWallet();
  const { showError, showSuccess } = useFeedback();
  const { flowTransactionAsync, isPending: isFlowTransactionPending } =
    useFlowTransaction();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const isBalanceLoading = false;
  const selectedAssetIndex = assets.findIndex(asset => asset.assetId === selectedAssetId);
  const selectedAsset = assets[selectedAssetIndex] ?? null;
  const isAssetPickerDisabled = isAssetsLoading || !selectedAsset;
  const availableBalance = selectedAsset
    ? getAvailableBalance(selectedAsset, activeTab)
    : '0';
  const selectedAssetAddress = selectedAsset
    ? getDisplayedAddress(selectedAsset, activeTab)
    : '';
  const transactionDebugJson = useMemo(() => {
    const amountDecimals =
      activeTab === 'in'
        ? selectedAsset?.decimals
        : selectedAsset?.assetDecimals;

    if (
      !selectedAsset ||
      amountDecimals === undefined ||
      !parseFlowAmount(amount, amountDecimals)
    ) {
      return '';
    }

    try {
      return JSON.stringify(
        buildFlowTransactionDebugInfo({
          amount,
          chainId: currentNetwork.chainId,
          contractAddress: selectedAsset.contractAddress,
          decimals:
            activeTab === 'in'
              ? selectedAsset.decimals
              : selectedAsset.assetDecimals,
          direction: activeTab,
          from: address,
          symbol: selectedAsset.symbol,
        }),
        null,
        2,
      );
    } catch (debugError) {
      return JSON.stringify(
        {
          error:
            debugError instanceof Error
              ? debugError.message
              : 'Unable to encode transaction preview.',
        },
        null,
        2,
      );
    }
  }, [activeTab, address, amount, currentNetwork.chainId, selectedAsset]);

  useEffect(() => {
    // Close the asset dropdown when the user clicks outside the picker.
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!assets.length || assets.some(asset => asset.assetId === selectedAssetId)) return;
    // Refreshes and reordered results must not replace a user's chosen asset.
    const fallback = assets.find(asset => asset.assetId === defaultAssetId) ?? assets[0];
    setSelectedAssetId(fallback.assetId);
    setAmount('');
    setError('');
    setIsFlowModalOpen(false);
  }, [assets, defaultAssetId, selectedAssetId]);

  const handleAmountChange = (value: string) => {
    setAmount(value);

    if (error) {
      setError('');
    }
  };

  const handleTabChange = (direction: FlowDirection) => {
    setActiveTab(direction);
    setAmount('');
    setError('');
    setDropdownOpen(false);
  };

  const handleSelectAsset = (index: number) => {
    if (!assets[index]) return;
    setSelectedAssetId(assets[index].assetId);
    setAmount('');
    setError('');
    setDropdownOpen(false);
  };

  const handleAssetPickerKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (isAssetPickerDisabled) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setDropdownOpen((current) => !current);
    }
  };

  const openFlowModal = () => {
    if (!selectedAsset) {
      setError('No flow asset is available on this network.');
      return;
    }

    if (!canUseDirection(selectedAsset, activeTab)) {
      setError(
        activeTab === 'in'
          ? 'Flow In is not available for this asset.'
          : 'Flow Out is not available for this asset.',
      );
      return;
    }

    if (!selectedAsset.contractAddress) {
      setError('Flow ERC20 contract address is missing for this asset.');
      return;
    }

    const amountDecimals =
      activeTab === 'in'
        ? selectedAsset.decimals
        : selectedAsset.assetDecimals;
    const requestedAmount = parseFlowAmount(amount, amountDecimals);
    const availableAmount = (() => {
      try {
        return ethers.parseUnits(availableBalance || '0', amountDecimals);
      } catch {
        return 0n;
      }
    })();

    if (!requestedAmount) {
      setError('The amount must be greater than 0.');
      return;
    }

    if (requestedAmount > availableAmount) {
      setError('Insufficient balance.');
      return;
    }

    setError('');
    setIsFlowModalOpen(true);
  };

  const confirmFlow = async () => {
    if (!selectedAsset) {
      throw new Error('No flow asset is selected.');
    }

    try {
      const result = await flowTransactionAsync({
        amount,
        contractAddress: selectedAsset.contractAddress,
        decimals:
          activeTab === 'in'
            ? selectedAsset.decimals
            : selectedAsset.assetDecimals,
        direction: activeTab,
        waitForReceipt: true,
      });

      showSuccess(
        `Flow ${activeTab === 'in' ? 'in' : 'out'} confirmed`,
        `${amount} ${selectedAsset.symbol} was confirmed on chain.`,
      );
      setAmount('');

      return result.hash;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to submit Flow ${activeTab === 'in' ? 'In' : 'Out'}.`;

      setError(message);
      showError(`Flow ${activeTab === 'in' ? 'In' : 'Out'} failed`, message);
      throw error;
    }
  };

  return {
    activeTab,
    sortedAssets: assets,
    amount,
    availableBalance,
    closeFlowModal: () => setIsFlowModalOpen(false),
    confirmFlow,
    dropdownOpen,
    dropdownRef,
    error,
    handleAmountChange,
    handleAssetPickerKeyDown,
    handleSelectAsset,
    handleTabChange,
    isAssetPickerDisabled,
    isBalanceLoading,
    isFlowModalOpen,
    isFlowTransactionPending,
    openFlowModal,
    selectedAsset,
    selectedAssetAddress,
    selectedAssetIndex,
    setDropdownOpen,
    transactionDebugJson,
  };
}
