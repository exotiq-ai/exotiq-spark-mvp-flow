import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatMoney } from "@/lib/format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Active money context for the current tenant.
 *
 * Populated by TeamProvider whenever `currentTeam` changes. Read by
 * `formatCurrency()` so every existing call site automatically renders in
 * the tenant's currency + locale without any call-site changes.
 *
 * Defaults stay 'USD'/'en-US' so:
 *   - SSR, tests, pre-auth screens render identically to the legacy behavior
 *   - US tenants (currency='USD', locale='en-US') are byte-identical to today
 */
let activeMoneyContext: { currency: string; locale: string } = {
  currency: 'USD',
  locale: 'en-US',
};

export function setActiveMoneyContext(ctx: { currency?: string | null; locale?: string | null }) {
  activeMoneyContext = {
    currency: ctx.currency || 'USD',
    locale: ctx.locale || 'en-US',
  };
}

export function getActiveMoneyContext() {
  return activeMoneyContext;
}

/**
 * Tenant-aware currency formatter.
 *
 * Same signature as the previous USD-only version, but now consults the
 * active money context populated by TeamProvider. US tenants see identical
 * output; non-US tenants (e.g. Orion / GBP) see proper localized symbols.
 */
export function formatCurrency(value: number | string, decimals = 0): string {
  return formatMoney(value, {
    currency: activeMoneyContext.currency,
    locale: activeMoneyContext.locale,
    decimals,
  });
}

export function formatNumber(value: number | string, decimals = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
