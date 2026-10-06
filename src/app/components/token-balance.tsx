import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useBalance, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { ethers } from 'ethers';
import ERC20_ABI from '../apis/evm/abis/erc-20';
import type { TokenInfo } from '../types/common';

interface TokenBalanceProps {
  /** Token metadata including contract address, decimals, symbol, and native flag */
  token: TokenInfo;
  /** Wallet address to query balance for. Falls back to connected wallet if omitted. */
  address?: string;
  /** Called whenever the fetched balance changes */
  onBalanceChange?: (balance: string) => void;
  /** Custom render for the balance display */
  children?: (balance: string, isLoading: boolean) => ReactNode;
  /** CSS class for the default display wrapper */
  className?: string;
  /** Whether to show the symbol next to the balance in default display */
  showSymbol?: boolean;
}

function isValidAddress(value?: string): value is string {
  return Boolean(value && value !== '0x' && ethers.isAddress(value));
}

/**
 * Fetches and displays the on-chain balance for a token (ERC20 or native).
 *
 * The balance is automatically propagated to the parent via `onBalanceChange`.
 * Supports custom rendering via the `children` render prop, or falls back to
 * a simple text display with an optional symbol suffix.
 */
export function TokenBalance({
  token,
  address,
  onBalanceChange,
  children,
  className,
  showSymbol = true,
}: TokenBalanceProps) {
  const queryAddress = isValidAddress(address) ? address : undefined;
  const tokenAddress = token.isNative
    ? undefined
    : (token.contractAddress as `0x${string}` | undefined);
  const isEnabled = Boolean(queryAddress);

  // Native balance
  const {
    data: nativeData,
    isLoading: nativeLoading,
    error: nativeError,
  } = useBalance({
    address: queryAddress as `0x${string}` | undefined,
    query: {
      enabled: isEnabled && token.isNative,
    },
  });

  // ERC20 balance
  const {
    data: erc20Data,
    isLoading: erc20Loading,
    error: erc20Error,
  } = useReadContract({
    abi: ERC20_ABI,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: queryAddress ? [queryAddress as `0x${string}`] : undefined,
    query: {
      enabled: isEnabled && !token.isNative && Boolean(tokenAddress),
    },
  });

  const isLoading = token.isNative ? nativeLoading : erc20Loading;
  const error = token.isNative ? nativeError : erc20Error;

  const rawBalance = useMemo(() => {
    if (token.isNative) {
      return nativeData?.value ?? 0n;
    }
    const value =
      typeof erc20Data === 'bigint'
        ? erc20Data
        : typeof erc20Data === 'string'
          ? BigInt(erc20Data)
          : 0n;
    return value;
  }, [token.isNative, nativeData, erc20Data]);

  const formattedBalance = useMemo(() => {
    return rawBalance > 0n ? formatUnits(rawBalance, token.decimals) : '0';
  }, [rawBalance, token.decimals]);

  useEffect(() => {
    if (!isLoading) {
      onBalanceChange?.(formattedBalance);
    }
  }, [formattedBalance, isLoading, onBalanceChange]);

  if (children) {
    return <>{children(formattedBalance, isLoading)}</>;
  }

  if (isLoading) {
    return (
      <span className={className}>
        <LoaderCircle className="inline h-4 w-4 animate-spin" />
      </span>
    );
  }

  if (error || !queryAddress) {
    return <span className={className}>--</span>;
  }

  return (
    <span className={className}>
      {formattedBalance}
      {showSymbol ? ` ${token.symbol}` : ''}
    </span>
  );
}
