import BigNumber from 'bignumber.js';

function amount(balance: string | null | undefined, decimals: number) {
  if (balance == null || balance.trim() === '' ||
      !Number.isInteger(decimals) || decimals < 0 || decimals > 255) return null;
  try {
    const value = new BigNumber(balance);
    return value.isFinite() && !value.isNegative() ? value.shiftedBy(-decimals) : null;
  } catch {
    return null;
  }
}

// Compare exact balances, not rounded K/M labels or raw integers of different scales.
// Unknown balances follow known zero balances; equal values keep their input order.
export function compareBalancesDescending(
  a: string | null | undefined, b: string | null | undefined,
  aDecimals = 0, bDecimals = 0,
) {
  const left = amount(a, aDecimals), right = amount(b, bDecimals);
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return right.comparedTo(left) ?? 0;
}

export function compareRawTokenBalances(
  a: { balance?: string; decimals?: number },
  b: { balance?: string; decimals?: number },
) {
  return compareBalancesDescending(a.balance, b.balance, a.decimals ?? 0, b.decimals ?? 0);
}
