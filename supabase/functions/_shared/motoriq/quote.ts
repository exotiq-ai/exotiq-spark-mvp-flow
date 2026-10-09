/** JS mirror of the SQL `quote_nightly` (see dateRates.ts). Nights are counted on the local wall clock. */
import { addDays, dayKey, safeTimeZone, tzOffsetMs } from "./facts.ts";
import { rateForDay, type DayRate, type RateOverride } from "./dateRates.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface NightlyQuote {
  nights: number;
  total: number;
  /** total / nights (not rounded), null when there are no nights */
  average: number | null;
  breakdown: Array<{ date: string } & DayRate>;
  baseRate: number;
  timeZone: string;
  hasOverrides: boolean;
}

/** Nights: elapsed local hours / 24, rounded up, at least one, starting on the local start date. */
export function stayNights(startMs: number, endMs: number, tz: string): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  const zone = safeTimeZone(tz);
  const localHours = (endMs + tzOffsetMs(endMs, zone) - (startMs + tzOffsetMs(startMs, zone))) / HOUR;
  return Math.min(366, Math.max(1, Math.ceil(localHours / 24 - 1e-9)));
}

export function quoteNightly(
  overrides: readonly RateOverride[],
  vehicleId: string,
  startIso: string,
  endIso: string,
  tz: string | null | undefined,
  baseRate: number,
  /** a duration-tier rate for days without an override */
  tierRate?: number | null,
): NightlyQuote {
  const zone = safeTimeZone(tz);
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  const nights = stayNights(s, e, zone);
  const fallback = tierRate ?? baseRate;
  const first = nights > 0 ? dayKey(s, zone) : "";
  const breakdown = Array.from({ length: nights }, (_, i) => {
    const date = addDays(first, i);
    return { date, ...rateForDay(overrides, vehicleId, date, fallback) };
  });
  const total = breakdown.reduce((sum, d) => sum + d.rate, 0);
  return {
    nights,
    total,
    average: nights > 0 ? total / nights : null,
    breakdown,
    baseRate,
    timeZone: zone,
    hasOverrides: breakdown.some((d) => d.source !== "base"),
  };
}
