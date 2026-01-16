import { useMemo } from 'react';
import { Tables } from '@/integrations/supabase/types';

type Vehicle = Tables<'vehicles'>;
type Booking = Tables<'bookings'>;

interface FleetAIInsight {
  vehicleId: string;
  vehicleName: string;
  suggestedIncreasePercent: number;
  potentialMonthlyRevenue: number;
  reason: string;
  confidence: number;
}

/**
 * Analyzes the fleet to find the best vehicle for a rate optimization suggestion
 * Uses real data: booking frequency, current utilization, and suggested_rate from DB
 */
export const useFleetAIInsight = (
  vehicles: Vehicle[],
  bookings: Booking[]
): FleetAIInsight | null => {
  return useMemo(() => {
    if (!vehicles.length) return null;

    // Calculate booking metrics for each vehicle
    const vehicleMetrics = vehicles.map((vehicle) => {
      const vehicleBookings = bookings.filter((b) => b.vehicle_id === vehicle.id);
      const completedBookings = vehicleBookings.filter((b) => b.status === 'completed');
      const confirmedBookings = vehicleBookings.filter((b) => b.status === 'confirmed');
      
      // Calculate booking frequency (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const recentBookings = vehicleBookings.filter((b) => 
        new Date(b.created_at || b.start_date) > ninetyDaysAgo
      );
      
      // Calculate total revenue
      const totalRevenue = completedBookings.reduce(
        (sum, b) => sum + (b.total_value || 0),
        0
      );
      
      // Calculate average daily rate from bookings
      const avgBookingRate = completedBookings.length > 0
        ? completedBookings.reduce((sum, b) => sum + (b.daily_rate || 0), 0) / completedBookings.length
        : vehicle.current_rate || 0;
      
      // Current rate vs suggested rate from DB
      const currentRate = Number(vehicle.current_rate) || 0;
      const suggestedRate = vehicle.suggested_rate ? Number(vehicle.suggested_rate) : null;
      
      // Calculate potential increase
      let percentIncrease = 0;
      let potentialMonthlyGain = 0;
      let reason = '';
      let confidence = 60;
      
      if (suggestedRate && suggestedRate > currentRate) {
        // DB has a suggestion for increase
        percentIncrease = ((suggestedRate - currentRate) / currentRate) * 100;
        potentialMonthlyGain = (suggestedRate - currentRate) * 20; // 20 rental days/month
        reason = 'AI pricing model suggests higher rate based on market analysis';
        confidence = 85;
      } else if (recentBookings.length >= 3 && vehicle.utilization && vehicle.utilization >= 70) {
        // High demand vehicle - suggest 10-15% increase
        percentIncrease = Math.min(15, Math.max(10, vehicle.utilization - 65));
        potentialMonthlyGain = (currentRate * percentIncrease / 100) * 20;
        reason = `High demand (${vehicle.utilization}% utilization) supports premium pricing`;
        confidence = 75;
      } else if (recentBookings.length >= 2 && avgBookingRate > currentRate * 1.05) {
        // Bookings going through at higher rates
        percentIncrease = ((avgBookingRate - currentRate) / currentRate) * 100;
        potentialMonthlyGain = (avgBookingRate - currentRate) * 20;
        reason = 'Recent bookings averaging above current listed rate';
        confidence = 70;
      } else if (confirmedBookings.length >= 2) {
        // Has upcoming bookings - moderate confidence in current pricing
        percentIncrease = 8;
        potentialMonthlyGain = (currentRate * 0.08) * 20;
        reason = 'Strong booking pipeline supports rate optimization';
        confidence = 65;
      }
      
      return {
        vehicle,
        vehicleBookings: vehicleBookings.length,
        recentBookings: recentBookings.length,
        totalRevenue,
        avgBookingRate,
        percentIncrease,
        potentialMonthlyGain,
        reason,
        confidence,
      };
    });

    // Find the best opportunity: highest potential monthly gain with good confidence
    const opportunities = vehicleMetrics
      .filter((m) => m.percentIncrease > 0 && m.potentialMonthlyGain > 0)
      .sort((a, b) => {
        // Weight by potential gain AND confidence
        const scoreA = a.potentialMonthlyGain * (a.confidence / 100);
        const scoreB = b.potentialMonthlyGain * (b.confidence / 100);
        return scoreB - scoreA;
      });

    if (opportunities.length === 0) {
      // No clear opportunities, return null (banner won't show)
      return null;
    }

    const best = opportunities[0];
    
    return {
      vehicleId: best.vehicle.id,
      vehicleName: best.vehicle.name || `${best.vehicle.year} ${best.vehicle.make} ${best.vehicle.model}`,
      suggestedIncreasePercent: Math.round(best.percentIncrease),
      potentialMonthlyRevenue: Math.round(best.potentialMonthlyGain),
      reason: best.reason,
      confidence: best.confidence,
    };
  }, [vehicles, bookings]);
};
