import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with English (Western-Arabic) numerals regardless of browser locale.
 * Use this everywhere instead of `n.toLocaleString()`.
 * @example fmtNum(12500) → "12,500"
 */
export function fmtNum(value: number | null | undefined, decimals?: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const opts: Intl.NumberFormatOptions = decimals !== undefined
    ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : {};
  return new Intl.NumberFormat('en-US', opts).format(value);
}

/**
 * Format a currency value in SAR with English numerals.
 * @example fmtCurrency(1500) → "1,500"  (caller appends ر.س)
 */
export function fmtCurrency(value: number | null | undefined): string {
  return fmtNum(value, 0);
}
