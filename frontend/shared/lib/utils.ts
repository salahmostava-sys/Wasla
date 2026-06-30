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
  const opts: Intl.NumberFormatOptions = decimals !== undefined // NOSONAR
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

/**
 * Safely convert any value to a string, guarding against objects being
 * passed from Supabase JOIN relations (which would otherwise produce "[object Object]").
 *
 * This is critical for salary slip fields (employee name, national ID, job title, IBAN)
 * where accidentally writing "[object Object]" to a PDF is a financial compliance issue.
 *
 * @param value    The raw value — may be string, number, object, null, or undefined.
 * @param fallback Returned when value is not a safe primitive (default: '').
 *
 * @example
 *   safeStr('Ahmed')            // → 'Ahmed'
 *   safeStr(12345)              // → '12345'
 *   safeStr(null, '—')          // → '—'
 *   safeStr({ name: 'Ahmed' })  // → ''   (not "[object Object]")
 */
export function safeStr(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value !== '' ? value : fallback; // NOSONAR
  if (typeof value === 'number') return String(value);
  // Intentional guard: objects (e.g. from Supabase embedded JOIN) return fallback
  return fallback;
}
