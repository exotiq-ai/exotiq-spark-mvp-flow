import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

export interface DailyPrediction {
  date: string;
  predictedBookings: number;
  confidence: number;
  projectedRevenue: number;
  factors: string[];
  demandLevel: 'low' | 'medium' | 'high' | 'peak';
}

export interface PricingAdjustment {
  category: string;
  currentRate: number;
  suggestedRate: number;
  changePercent: number;
  reason: string;
}

export interface Opportunity {
  date: string;
  potentialRevenue: number;
  reason: string;
  eventName?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DemandForecast {
  dailyPredictions: DailyPrediction[];
  pricingAdjustments: PricingAdjustment[];
  opportunities: Opportunity[];
  summary: {
    totalPredictedBookings: number;
    averageConfidence: number;
    projectedRevenue: number;
    comparedToLastPeriod: number;
    demandTrend: 'increasing' | 'stable' | 'decreasing';
  };
}

interface FleetData {
  totalVehicles: number;
  categories: Array<{
    name: string;
    count: number;
    avgRate: number;
  }>;
  currentUtilization: number;
}

interface HistoricalBooking {
  date: string;
  count: number;
  revenue: number;
}

interface EventData {
  name: string;
  date: string;
  attendance: number;
  impactScore: number;
  category: string;
}

interface UseAIDemandForecastReturn {
  forecast: DemandForecast | null;
  loading: boolean;
  error: string | null;
  generateForecast: (
    location: string,
    dateRange: { from: Date; to: Date },
    fleetData?: FleetData,
    historicalBookings?: HistoricalBooking[],
    events?: EventData[]
  ) => Promise<void>;
  refresh: () => void;
}

export const useAIDemandForecast = (): UseAIDemandForecastReturn => {
  const [forecast, setForecast] = useState<DemandForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    location: string;
    dateRange: { from: Date; to: Date };
    fleetData?: FleetData;
    historicalBookings?: HistoricalBooking[];
    events?: EventData[];
  } | null>(null);

  const generateForecast = useCallback(async (
    location: string,
    dateRange: { from: Date; to: Date },
    fleetData?: FleetData,
    historicalBookings?: HistoricalBooking[],
    events?: EventData[]
  ) => {
    setLoading(true);
    setError(null);
    setLastRequest({ location, dateRange, fleetData, historicalBookings, events });

    try {
      const response = await supabase.functions.invoke('ai-demand-forecast', {
        body: {
          location,
          dateRange: {
            from: dateRange.from.toISOString().split('T')[0],
            to: dateRange.to.toISOString().split('T')[0],
          },
          fleetData,
          historicalBookings,
          events,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate forecast');
      }

      // Check for API-level errors
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setForecast(response.data);
      
      toast("Forecast Generated", { description: `Predicted ${response.data.summary?.totalPredictedBookings || 0} bookings with ${response.data.summary?.averageConfidence || 0}% average confidence` });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate forecast';
      setError(message);
      
      toast.error("Forecast Failed", { description: message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const refresh = useCallback(() => {
    if (lastRequest) {
      generateForecast(
        lastRequest.location,
        lastRequest.dateRange,
        lastRequest.fleetData,
        lastRequest.historicalBookings,
        lastRequest.events
      );
    }
  }, [lastRequest, generateForecast]);

  return {
    forecast,
    loading,
    error,
    generateForecast,
    refresh,
  };
};
