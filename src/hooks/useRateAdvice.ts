import { useMemo } from 'react';
import { useMotorIQ } from '@/hooks/useMotorIQ';
import { dayKey } from '@/lib/motoriq/facts';
import type { Confidence, EventRate, PriceAction } from '@/lib/motoriq/types';

export interface RateAdvice {
  action: PriceAction;
  listedRate: number;
  recommendedRate: number;
  confidence: Confidence;
  /** one plain sentence: what MotorIQ would do and why */
  summary: string;
  /** the reasons behind it, from the tenant's own bookings */
  reasons: string[];
  /** why MotorIQ is not recommending a change (or a bigger one) */
  holdReasons: string[];
  /** premiums for confirmed events that fall on the dates being booked */
  eventQuotes: EventRate[];
}

/**
 * What MotorIQ says about this car for the dates being booked: the same engine as the MotorIQ screens and Rari.
 * Advice only; the booking's rate is set in the dialog. Replaces a hook that read the stored `suggested_rate` and
 * `utilization` columns and assumed 20 rental days a month.
 */
export function useRateAdvice(vehicleId: string | null | undefined, startIso?: string, endIso?: string): RateAdvice | null {
  const { snapshot, timeZone } = useMotorIQ();
  return useMemo(() => {
    if (!snapshot || !vehicleId) return null;
    const rec = snapshot.recommendations.find((r) => r.vehicleId === vehicleId);
    if (!rec) return null;
    const startMs = startIso ? Date.parse(startIso) : NaN;
    const endMs = endIso ? Date.parse(endIso) : NaN;
    const from = Number.isFinite(startMs) ? dayKey(startMs, timeZone) : null;
    const to = Number.isFinite(endMs) ? dayKey(endMs, timeZone) : from;
    const eventQuotes = from && to ? rec.eventRates.filter((e) => e.from <= to && e.to >= from) : [];
    return {
      action: rec.action,
      listedRate: rec.currentRate,
      recommendedRate: rec.recommendedRate,
      confidence: rec.confidence,
      summary: rec.speakable,
      reasons: rec.drivers.filter((d) => d.effectPct !== 0).map((d) => d.detail),
      holdReasons: rec.holdReasons,
      eventQuotes,
    };
  }, [snapshot, vehicleId, startIso, endIso, timeZone]);
}
