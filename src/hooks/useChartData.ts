import { useMemo } from 'react';
import { Tables } from '@/integrations/supabase/types';

type Booking = Tables<'bookings'>;
type Payment = Tables<'payments'>;

const toLocalDateStr = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const useChartData = (bookings: Booking[], payments: Payment[]) => {
  const revenueData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = toLocalDateStr(date);
      
      // Revenue from confirmed/completed bookings starting on this date
      const dayBookings = bookings.filter(b => {
        const startDate = new Date(b.start_date);
        return toLocalDateStr(startDate) === dateStr && 
          (b.status === 'confirmed' || b.status === 'completed');
      });
      
      const dayRevenue = dayBookings.reduce((sum, b) => sum + (b.total_value || 0), 0);
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: dateStr,
        revenue: dayRevenue,
        bookingsCount: dayBookings.length,
        bookings: dayBookings
      });
    }
    
    return data;
  }, [bookings, payments]);

  return { revenueData };
};
