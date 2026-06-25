import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatMoney } from "@/lib/format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Legacy USD-only currency formatter.
 *
 * Signature and output are preserved for byte-identical rendering across the
 * ~99 existing call sites. New code should use `useMoney()` instead, which
 * formats in the current tenant's currency + locale.
 *
 * Output for whole-dollar US amounts matches the legacy implementation
 * exactly (e.g. "$1,234").
 */
export function formatCurrency(value: number | string, decimals = 0): string {
  return formatMoney(value, { currency: 'USD', locale: 'en-US', decimals });
}

export function formatNumber(value: number | string, decimals = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
