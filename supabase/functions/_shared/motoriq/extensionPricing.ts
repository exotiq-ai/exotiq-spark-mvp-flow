/**
 * What an extension's added nights cost: each night is the date rate in force that day (from the database function
 * nightly_rates), else the rate the operator entered for the extension. Pure, so the rounding is tested.
 */
import { addDays } from "./facts.ts";

export interface NightRateRow {
  night: string;
  rate: number | string;
  source: string;
}

export interface ExtensionNight {
  date: string;
  rateCents: number;
  /** 'base' (the rate entered for the extension) | 'manual' | 'motoriq' */
  source: string;
}

export interface ExtensionNights {
  nights: ExtensionNight[];
  subtotalCents: number;
  /** subtotal / nights, rounded to a cent (stored as the extension's rate per day) */
  averageRateCents: number;
  /** true when at least one night uses a date rate instead of the entered rate */
  hasDateRates: boolean;
}

/**
 * `rows` come back from nightly_rates for the added nights in order; any night the database did not return (or a failed
 * call) is priced at `enteredRateCents`, so a missing function can never raise or zero a charge.
 */
export function priceExtensionNights(
  rows: readonly NightRateRow[] | null | undefined,
  enteredRateCents: number,
  addedDays: number,
  firstDay: string,
): ExtensionNights {
  const byNight = new Map((rows ?? []).map((r) => [r.night, r]));
  const nights: ExtensionNight[] = Array.from({ length: Math.max(0, addedDays) }, (_, i) => {
    const date = addDays(firstDay, i);
    const r = byNight.get(date);
    const rateCents = r && Number.isFinite(Number(r.rate)) ? Math.round(Number(r.rate) * 100) : enteredRateCents;
    return { date, rateCents, source: r?.source ?? "base" };
  });
  const subtotalCents = nights.reduce((s, n) => s + n.rateCents, 0);
  return {
    nights,
    subtotalCents,
    averageRateCents: nights.length ? Math.round(subtotalCents / nights.length) : 0,
    hasDateRates: nights.some((n) => n.source !== "base"),
  };
}
