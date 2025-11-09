import { useMemo } from 'react';
import { Tables } from '@/integrations/supabase/types';

type Booking = Tables<'bookings'>;
type Payment = Tables<'payments'>;

export const useChartData = (bookings: Booking[], payments: Payment[]) => {
  // Generate revenue data from bookings and payments
  const revenueData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Calculate revenue from payments on this date
      const dayPayments = payments.filter(p => {
        const paymentDate = new Date(p.transaction_date || p.created_at);
        return paymentDate.toISOString().split('T')[0] === dateStr;
      });
      
      const dayRevenue = dayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      // Count bookings starting on this date
      const dayBookings = bookings.filter(b => {
        const startDate = new Date(b.start_date);
        return startDate.toISOString().split('T')[0] === dateStr;
      });
      
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
