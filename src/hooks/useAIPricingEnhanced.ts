import { useState, useCallback } from 'react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Vehicle = Tables<'vehicles'>;
type Booking = Tables<'bookings'>;

interface PricingFactor {
  name: string;
  impact: number;
  description: string;
}

interface EventData {
  id: string;
  name: string;
  date: string;
  category: string;
  attendance: number;
  impactScore: number;
}

interface AIPricingResult {
  suggestedRate: number;
  confidence: number;
  reasoning: string;
  factors: PricingFactor[];
  expectedRevenue: {
    daily: number;
    monthly: number;
    improvement: number;
  };
  events?: EventData[];
  demandMultiplier?: number;
}

interface UseAIPricingEnhancedReturn {
  loading: boolean;
  error: string | null;
  pricingResult: AIPricingResult | null;
  events: EventData[];
  analyzePricing: (vehicle: Vehicle, bookings?: Booking[], startDate?: string) => Promise<void>;
  fetchEvents: (city?: string) => Promise<void>;
}

export const useAIPricingEnhanced = (): UseAIPricingEnhancedReturn => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricingResult, setPricingResult] = useState<AIPricingResult | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);

  const fetchEvents = useCallback(async (city?: string) => {
    try {
      const response = await supabase.functions.invoke('predicthq-events', {
        body: { city: city || 'miami' },
      });

      if (response.error) {
        console.error('Events fetch error:', response.error);
        return;
      }

      const data = response.data;
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  }, []);

  const analyzePricing = useCallback(async (
    vehicle: Vehicle, 
    bookings?: Booking[], 
    startDate?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      // First, fetch event data
      const eventsResponse = await supabase.functions.invoke('predicthq-events', {
        body: { city: 'miami' }, // Could be dynamic based on user location
      });

      let eventData = null;
      if (!eventsResponse.error && eventsResponse.data) {
        eventData = {
          upcomingEvents: eventsResponse.data.events.slice(0, 5),
          demandMultiplier: eventsResponse.data.demandMultiplier,
        };
        setEvents(eventsResponse.data.events);
      }

      // Calculate booking history if available
      const vehicleBookings = bookings?.filter(b => b.vehicle_id === vehicle.id) || [];
      const bookingHistory = vehicleBookings.length > 0 ? {
        totalBookings: vehicleBookings.length,
        averageRate: vehicleBookings.reduce((sum, b) => sum + Number(b.daily_rate), 0) / vehicleBookings.length,
        peakDays: getPeakDays(vehicleBookings),
      } : undefined;

      // Call AI pricing endpoint
      const response = await supabase.functions.invoke('ai-pricing', {
        body: {
          vehicle: {
            id: vehicle.id,
            name: vehicle.name,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            currentRate: Number(vehicle.current_rate),
            utilization: vehicle.utilization || 0,
            revenue: Number(vehicle.revenue) || 0,
          },
          bookingHistory,
          eventData,
          startDate,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to analyze pricing');
      }

      const result: AIPricingResult = {
        ...response.data,
        events: eventData?.upcomingEvents,
        demandMultiplier: eventData?.demandMultiplier,
      };

      setPricingResult(result);

      toast({
        title: "Pricing Analysis Complete",
        description: `Suggested rate: $${result.suggestedRate}/day (${result.confidence}% confidence)`,
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze pricing';
      setError(message);
      
      toast({
        title: "Pricing Analysis Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    error,
    pricingResult,
    events,
    analyzePricing,
    fetchEvents,
  };
};

function getPeakDays(bookings: Booking[]): string[] {
  const dayCounts: Record<string, number> = {};
  
  bookings.forEach(booking => {
    const startDate = new Date(booking.start_date);
    const dayName = startDate.toLocaleDateString('en-US', { weekday: 'long' });
    dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
  });

  return Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => day);
}
