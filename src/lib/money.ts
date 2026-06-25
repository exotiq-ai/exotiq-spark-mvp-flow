// Minor-unit conversion for Stripe.
//
// Stripe wants integer minor units (cents/pence). USD & GBP use 2 decimals,
// JPY uses 0, BHD uses 3. Codify the helper now so adding currencies later is
// config-only.

const ZERO_DECIMAL = new Set([
  'BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF',
  'UGX','VND','VUV','XAF','XOF','XPF',
]);
const THREE_DECIMAL = new Set(['BHD','JOD','KWD','OMR','TND']);

export function currencyDecimals(currency: string): number {
  const c = currency.toUpperCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2;
}

export function toMinorUnits(amount: number, currency: string): number {
  const d = currencyDecimals(currency);
  // Round half-up to avoid Stripe rejecting non-integer values
  return Math.round(amount * Math.pow(10, d));
}

export function fromMinorUnits(minor: number, currency: string): number {
  const d = currencyDecimals(currency);
  return minor / Math.pow(10, d);
}
