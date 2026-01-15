import { useMemo } from 'react';
import { Tables } from '@/integrations/supabase/types';

type Vehicle = Tables<'vehicles'>;

export type PricingZone = 'increase' | 'sweet_spot' | 'decrease';

interface PricingSuggestion {
  suggestedRate: number;
  reasoning: string;
  expectedImpact: string;
  confidence: number;
  factors: string[];
  zone: PricingZone;
  percentChange: number;
}

export const useAIPricing = (vehicle: Vehicle | null, startDate?: string): PricingSuggestion | null => {
  return useMemo(() => {
    if (!vehicle) return null;

    const currentRate = Number(vehicle.current_rate) || 0;
    const utilization = vehicle.utilization || 0;
    const dbSuggestedRate = vehicle.suggested_rate ? Number(vehicle.suggested_rate) : null;
    
    // If we have a suggested_rate from the database, use it directly
    let suggestedRate = dbSuggestedRate ?? currentRate;
    const factors: string[] = [];
    let confidence = 75;

    // Determine the pricing zone based on suggested vs current rate
    const percentChange = currentRate > 0 
      ? ((suggestedRate - currentRate) / currentRate) * 100 
      : 0;
    
    let zone: PricingZone;
    
    if (percentChange > 5) {
      zone = 'increase';
      factors.push(`High demand (${utilization}% utilization)`);
      confidence += 10;
    } else if (percentChange < -5) {
      zone = 'decrease';
      factors.push(`Low utilization (${utilization}%)`);
      confidence += 5;
    } else {
      zone = 'sweet_spot';
      factors.push('Optimal price-demand balance');
      confidence += 15;
    }

    // Factor: Day of week pricing (if start date provided)
    if (startDate) {
      const date = new Date(startDate);
      const dayOfWeek = date.getDay();
      
      // Weekend pricing boost
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (zone === 'increase') {
          suggestedRate *= 1.10;
          factors.push('Weekend premium');
        }
        confidence += 5;
      }
    }

    // Factor: Seasonal pricing (current month)
    const currentMonth = new Date().getMonth();
    // Peak season: Jan (Phoenix Open), Jun-Aug (summer), Dec (holidays)
    if ([0, 5, 6, 7, 11].includes(currentMonth)) {
      if (zone !== 'decrease') {
        factors.push('Peak season demand');
        confidence += 5;
      }
    }

    // Calculate expected impact
    const dailyDifference = suggestedRate - currentRate;
    const monthlyImpact = dailyDifference * 20; // Assume 20 rental days per month
    
    // Build reasoning based on zone
    let reasoning = '';
    if (zone === 'increase') {
      reasoning = `Strong demand supports a ${Math.abs(percentChange).toFixed(0)}% rate increase. Based on ${factors.length} key factors, this vehicle can command a premium.`;
    } else if (zone === 'decrease') {
      reasoning = `Consider a ${Math.abs(percentChange).toFixed(0)}% strategic price reduction to boost utilization from ${utilization}% and maximize overall revenue.`;
    } else {
      reasoning = `Optimal pricing achieved! Current rate is perfectly balanced with market demand at ${utilization}% utilization.`;
    }

    // Round to nearest $5
    suggestedRate = Math.round(suggestedRate / 5) * 5;

    return {
      suggestedRate,
      reasoning,
      expectedImpact: monthlyImpact >= 0 
        ? `+$${Math.abs(monthlyImpact).toFixed(0)}/month` 
        : `-$${Math.abs(monthlyImpact).toFixed(0)}/month`,
      confidence: Math.min(confidence, 95),
      factors,
      zone,
      percentChange: Math.round(percentChange)
    };
  }, [vehicle, startDate]);
};
