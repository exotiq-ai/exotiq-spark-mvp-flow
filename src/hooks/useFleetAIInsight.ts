import { useMemo } from 'react';
import { useMotorIQ } from '@/hooks/useMotorIQ';
import type { Confidence } from '@/lib/motoriq/types';

export interface FleetAIInsight {
  vehicleId: string;
  vehicleName: string;
  /** whole percent */
  suggestedIncreasePercent: number;
  /** rough extra revenue if the open days in the next week fill as they usually do and guests accept the price */
  estimatedExtraRevenue: number;
  /** how many open days the estimate rests on */
  openDays: number;
  assumption: string;
  reason: string;
  confidence: Confidence;
}

/**
 * The best base-rate raise MotorIQ recommends right now, for the dashboard banner and brief. It is the same engine and
 * the same numbers as the MotorIQ screens and Rari: booking pace against normal, what guests recently paid against the
 * listed rate, and the team's minimum rate. Nothing here reads a stored column or assumes a number of rental days.
 */
export const useFleetAIInsight = (): FleetAIInsight | null => {
  const { snapshot } = useMotorIQ();
  return useMemo(() => {
    if (!snapshot) return null;
    const best = snapshot.recommendations
      .filter((r) => r.action === 'raise' && r.confidence !== 'low' && r.estimate && r.estimate.extraRevenue > 0)
      .sort((a, b) => (b.estimate?.extraRevenue ?? 0) - (a.estimate?.extraRevenue ?? 0))[0];
    if (!best || !best.estimate) return null;
    return {
      vehicleId: best.vehicleId,
      vehicleName: best.name,
      suggestedIncreasePercent: Math.round(best.changePct * 100),
      estimatedExtraRevenue: Math.round(best.estimate.extraRevenue),
      openDays: best.estimate.openDays,
      assumption: best.estimate.assumption,
      reason: best.drivers.find((d) => d.effectPct !== 0)?.detail ?? best.speakable,
      confidence: best.confidence,
    };
  }, [snapshot]);
};
