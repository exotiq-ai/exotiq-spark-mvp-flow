// Country → tenant currency/locale/tax defaults.
//
// Used by the Business Profile onboarding step to pre-fill currency, locale,
// tax label/rate, and the tax-inclusive flag when a country is selected.
// Each value remains individually overridable in Settings → Business Profile.

export interface CountryDefaults {
  country_code: string;          // ISO 3166-1 alpha-2
  country_name: string;
  currency: string;              // ISO 4217
  locale: string;                // BCP 47
  tax_label: string;             // "Tax" | "VAT" | "GST" | ...
  tax_rate_percent: number;
  tax_inclusive: boolean;        // true = rate quoted includes tax (UK pattern)
  tax_id_label?: string;         // "VAT number" | "GST number" | ...
}

export const COUNTRY_DEFAULTS: Record<string, CountryDefaults> = {
  US: {
    country_code: 'US',
    country_name: 'United States',
    currency: 'USD',
    locale: 'en-US',
    tax_label: 'Tax',
    tax_rate_percent: 0,
    tax_inclusive: false,
  },
  GB: {
    country_code: 'GB',
    country_name: 'United Kingdom',
    currency: 'GBP',
    locale: 'en-GB',
    tax_label: 'VAT',
    tax_rate_percent: 20,
    tax_inclusive: true,
    tax_id_label: 'VAT number',
  },
  CA: {
    country_code: 'CA',
    country_name: 'Canada',
    currency: 'CAD',
    locale: 'en-CA',
    tax_label: 'GST/HST',
    tax_rate_percent: 5,
    tax_inclusive: false,
    tax_id_label: 'GST/HST number',
  },
  AU: {
    country_code: 'AU',
    country_name: 'Australia',
    currency: 'AUD',
    locale: 'en-AU',
    tax_label: 'GST',
    tax_rate_percent: 10,
    tax_inclusive: true,
    tax_id_label: 'ABN',
  },
  IE: {
    country_code: 'IE',
    country_name: 'Ireland',
    currency: 'EUR',
    locale: 'en-IE',
    tax_label: 'VAT',
    tax_rate_percent: 23,
    tax_inclusive: true,
    tax_id_label: 'VAT number',
  },
};

export const SUPPORTED_COUNTRIES = Object.values(COUNTRY_DEFAULTS);

export function getCountryDefaults(country_code: string): CountryDefaults {
  return COUNTRY_DEFAULTS[country_code.toUpperCase()] ?? COUNTRY_DEFAULTS.US;
}

/**
 * Best-effort country guess from `navigator.language` (e.g. "en-GB" → "GB").
 * Falls back to "US".
 */
export function detectCountryFromBrowser(): string {
  try {
    const lang = typeof navigator !== 'undefined' ? navigator.language : '';
    const match = lang.match(/-([A-Z]{2})$/i);
    const code = match?.[1]?.toUpperCase();
    if (code && COUNTRY_DEFAULTS[code]) return code;
  } catch {
    /* noop */
  }
  return 'US';
}
