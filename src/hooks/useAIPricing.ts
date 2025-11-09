import { useMemo } from 'react';
import { Tables } from '@/integrations/supabase/types';

type Vehicle = Tables<'vehicles'>;

interface PricingSuggestion {
  suggestedRate: number;
  reasoning: string;
  expectedImpact: string;
  confidence: number;
  factors: string[];
}

export const useAIPricing = (vehicle: Vehicle | null, startDate?: string): PricingSuggestion | null => {
  return useMemo(() => {
    if (!vehicle) return null;

    const currentRate = Number(vehicle.current_rate);
    const utilization = vehicle.utilization || 0;
    let suggestedRate = currentRate;
    const factors: string[] = [];
    let confidence = 75;

    // Factor 1: Utilization-based pricing
    if (utilization > 80) {
      suggestedRate *= 1.15;
      factors.push('High demand (80%+ utilization)');
      confidence += 5;
    } else if (utilization < 50) {
      suggestedRate *= 0.95;
      factors.push('Low demand (<50% utilization)');
      confidence -= 5;
    }

    // Factor 2: Day of week pricing (if start date provided)
    if (startDate) {
      const date = new Date(startDate);
      const dayOfWeek = date.getDay();
      
      // Weekend pricing boost
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        suggestedRate *= 1.20;
        factors.push('Weekend premium pricing');
        confidence += 10;
      }
    }

    // Factor 3: Seasonal pricing (current month)
    const currentMonth = new Date().getMonth();
    // Summer months (June-August) and holiday season (December)
    if ([5, 6, 7, 11].includes(currentMonth)) {
      suggestedRate *= 1.15;
      factors.push('Peak season demand');
      confidence += 5;
    }

    // Factor 4: Vehicle performance
    if (vehicle.suggested_rate && Number(vehicle.suggested_rate) > currentRate) {
      suggestedRate = Math.max(suggestedRate, Number(vehicle.suggested_rate));
      factors.push('Historical performance data');
      confidence += 10;
    }

    // Calculate expected impact
    const dailyDifference = suggestedRate - currentRate;
    const monthlyImpact = dailyDifference * 20; // Assume 20 rental days per month
    
    // Build reasoning
    let reasoning = '';
    if (suggestedRate > currentRate * 1.05) {
      reasoning = `Market conditions favor a rate increase. Based on ${factors.length} key factors, this vehicle can command a premium.`;
    } else if (suggestedRate < currentRate * 0.95) {
      reasoning = `Consider a strategic price reduction to boost utilization and overall revenue.`;
    } else {
      reasoning = `Current pricing is well-aligned with market conditions. Minor adjustment recommended.`;
    }

    // Round to nearest $5
    suggestedRate = Math.round(suggestedRate / 5) * 5;

    return {
      suggestedRate,
      reasoning,
      expectedImpact: monthlyImpact > 0 
        ? `+$${Math.abs(monthlyImpact).toFixed(0)}/month` 
        : `-$${Math.abs(monthlyImpact).toFixed(0)}/month`,
      confidence: Math.min(confidence, 95),
      factors
    };
  }, [vehicle, startDate]);
};
