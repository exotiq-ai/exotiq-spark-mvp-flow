// Currency-aware money formatting.
//
// `formatMoney` uses Intl.NumberFormat for proper symbol + grouping per locale.
// US output (`en-US` / `USD`) is byte-identical to the legacy `formatCurrency`
// shim in `src/lib/utils.ts` for whole numbers (e.g. "$1,234").
//
// Decimals default to 0 (matching legacy `formatCurrency`) but currencies with
// non-2 minor units (JPY=0, BHD=3) should pass `decimals` explicitly.

export interface MoneyFormatOptions {
  currency?: string;       // ISO 4217 (USD, GBP, EUR)
  locale?: string;         // BCP 47 (en-US, en-GB)
  decimals?: number;       // 0 = no fractional digits (default)
  showCode?: boolean;      // append ISO code, e.g. "£1,234 GBP"
}

const DEFAULTS = {
  currency: 'USD',
  locale: 'en-US',
  decimals: 0,
} as const;

export function formatMoney(
  value: number | string | null | undefined,
  options: MoneyFormatOptions = {},
): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(num)) {
    return formatMoney(0, options);
  }

  const currency = (options.currency || DEFAULTS.currency).toUpperCase();
  const locale = options.locale || DEFAULTS.locale;
  const decimals = options.decimals ?? DEFAULTS.decimals;

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch {
    // Bad currency / locale → fall back to a USD-shaped string so we never
    // throw inside a render.
    formatted = '$' + num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return options.showCode ? `${formatted} ${currency}` : formatted;
}
