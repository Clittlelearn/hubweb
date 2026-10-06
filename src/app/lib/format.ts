import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import { ethers } from 'ethers';

dayjs.extend(utc);
dayjs.extend(advancedFormat);

export function shortAddress(address: string, start = 8, end = 6) {
  if (!address || !address.startsWith('0x')) {
    return address;
  }

  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function formatDate(at: number, format = 'YYYY/MM/DD HH:mm:ss') {
  return dayjs(at).format(format);
}

export function formatDateUTC(at: number, format = 'YYYY/MM/DD HH:mm:ss') {
  return dayjs.utc(at).format(format);
}

const COMPACT_AMOUNT_UNITS = [
  { value: new BigNumber(1_000_000_000_000), suffix: 'T' },
  { value: new BigNumber(1_000_000_000), suffix: 'B' },
  { value: new BigNumber(1_000_000), suffix: 'M' },
  { value: new BigNumber(1_000), suffix: 'K' },
] as const;

const COMPACT_AMOUNT_UNIT_MAP = COMPACT_AMOUNT_UNITS.reduce(
  (result, unit) => {
    result[unit.suffix] = unit.value;
    return result;
  },
  {} as Record<string, BigNumber>,
);

// Keep compact values readable: 1.20K -> 1.2K, 1.00M -> 1M.
function trimTrailingZeroes(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

function toSafeBigNumber(value: string | number) {
  try {
    const amount = new BigNumber(value);
    return amount.isFinite() ? amount : null;
  } catch {
    return null;
  }
}

// Format large values with a short suffix so dashboard/card values stay compact.
export function formatCompactAmount(amount: BigNumber, decimal: number) {
  const absAmount = amount.abs();
  let unitIndex = COMPACT_AMOUNT_UNITS.findIndex((unit) =>
    absAmount.gte(unit.value),
  );

  if (unitIndex < 0) {
    return null;
  }

  const compactDecimal = Math.min(Math.max(decimal || 2, 0), 2);
  let unit = COMPACT_AMOUNT_UNITS[unitIndex];
  let scaled = amount.div(unit.value).dp(compactDecimal, BigNumber.ROUND_HALF_UP);

  // Rounding can push 999.99M to 1000M; promote it to the next unit instead.
  if (scaled.abs().gte(1000) && unitIndex > 0) {
    unitIndex -= 1;
    unit = COMPACT_AMOUNT_UNITS[unitIndex];
    scaled = amount.div(unit.value).dp(compactDecimal, BigNumber.ROUND_HALF_UP);
  }

  return `${trimTrailingZeroes(scaled.toFormat())}${unit.suffix}`;
}

// Format tiny values as 0.0{n}x after enough leading zeroes, e.g. 0.0{8}5.
export function formatTinyAmount(amount: BigNumber, decimal: number) {
  const absAmount = amount.abs();
  if (absAmount.isZero() || absAmount.gte(1)) {
    return null;
  }

  const [, fraction = ''] = absAmount.toFixed().split('.');
  const zeroCount = fraction.match(/^0*/)?.[0].length ?? 0;
  const tinyZeroThreshold = 4;

  if (zeroCount < tinyZeroThreshold) {
    return null;
  }

  const significantLength = Math.max(Math.min(decimal || 6, 8), 1);
  const significantDigits =
    fraction.slice(zeroCount, zeroCount + significantLength).replace(/0+$/, '') ||
    '0';
  const sign = amount.isNegative() ? '-' : '';

  return `${sign}0.0{${zeroCount - 1}}${significantDigits}`;
}

// General token/number display formatter with compact large and tiny formats.
export function formatAmount(value: string | number, decimal = 6) {
  const amount = toSafeBigNumber(value);
  if (!amount) {
    return '0';
  }

  if (amount.isZero()) {
    return '0';
  }

  return (
    formatCompactAmount(amount, decimal) ??
    formatTinyAmount(amount, decimal) ??
    amount.dp(decimal, BigNumber.ROUND_HALF_UP).toFormat()
  );
}

// Format the complete value without compact or scientific-style suffixes.
export function formatExpandedAmount(value: string | number, decimal = 6) {
  const amount = toSafeBigNumber(value);
  if (!amount || amount.isZero()) {
    return '0';
  }

  return amount.dp(decimal, BigNumber.ROUND_HALF_UP).toFormat();
}

// Restore formatted display values back to a full numeric string.
export function restoreFormattedAmount(value: string | number) {
  if (typeof value === 'number') {
    return toSafeBigNumber(value)?.toFixed() ?? '0';
  }

  const normalizedValue = value.trim().replace(/,/g, '');
  if (!normalizedValue) {
    return '0';
  }

  // Reverse tiny notation: 0.0{8}5 -> 0.0000000005.
  const tinyMatch = normalizedValue.match(/^([+-]?)0\.0\{(\d+)\}(\d+)$/);
  if (tinyMatch) {
    const [, sign, zeroCountText, significantDigits] = tinyMatch;
    const zeroCount = Number(zeroCountText) + 1;
    const restored = `${sign}0.${'0'.repeat(zeroCount)}${significantDigits}`;
    return toSafeBigNumber(restored)?.toFixed() ?? '0';
  }

  // Reverse compact suffixes: 1.2K -> 1200, 1.25M -> 1250000.
  const compactMatch = normalizedValue.match(
    /^([+-]?(?:\d+\.?\d*|\.\d+))([KMBT])$/i,
  );
  if (compactMatch) {
    const [, amountText, suffix] = compactMatch;
    const unit = COMPACT_AMOUNT_UNIT_MAP[suffix.toUpperCase()];
    const amount = toSafeBigNumber(amountText)?.times(unit);

    return amount?.isFinite() ? amount.toFixed() : '0';
  }

  return toSafeBigNumber(normalizedValue)?.toFixed() ?? '0';
}

export function formatUnitsAmount(value: bigint | string, decimals = 18) {
  try {
    return ethers.formatUnits(value, decimals);
  } catch {
    return value.toString();
  }
}

function normalizeUnitDecimals(decimals: number) {
  return Number.isFinite(decimals) ? Math.max(0, Math.trunc(decimals)) : 18;
}

export function toUnitsAmount(
  value: bigint | string | number | null | undefined,
  decimals = 18,
) {
  const rawValue =
    value === null || value === undefined || value === '' ? '0' : value;
  return formatUnitsAmount(String(rawValue), normalizeUnitDecimals(decimals));
}

export function formatUnitsDisplayAmount(
  value: bigint | string | number | null | undefined,
  decimals = 18,
  displayDecimals = 6,
) {
  return formatAmount(toUnitsAmount(value, decimals), displayDecimals);
}

export function toUnitsNumber(
  value: bigint | string | number | null | undefined,
  decimals = 18,
) {
  return toSafeBigNumber(toUnitsAmount(value, decimals))?.toNumber() ?? 0;
}
