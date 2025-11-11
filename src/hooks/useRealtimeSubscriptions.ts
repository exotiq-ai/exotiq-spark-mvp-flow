import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFleet } from '@/contexts/FleetContext';
import { useToast } from '@/hooks/use-toast';

export const useRealtimeSubscriptions = () => {
  const { refreshBookings, refreshPayments, refreshDamageClaims, refreshCustomers } = useFleet();
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔄 Initializing realtime subscriptions...');
    
    // Subscribe to bookings changes
    const bookingsChannel = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          console.log('📅 Booking change detected:', payload);
          refreshBookings();
          
          if (payload.eventType === 'INSERT') {
            const newBooking = payload.new as any;
            toast({
              title: "🎉 New Booking Created",
              description: `${newBooking.customer_name || 'New customer'} has booked a vehicle.`,
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedBooking = payload.new as any;
            toast({
              title: "📝 Booking Updated",
              description: `Booking status changed to ${updatedBooking.status || 'updated'}.`,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to payments changes
    const paymentsChannel = supabase
      .channel('payments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          console.log('💳 Payment change detected:', payload);
          refreshPayments();
          
          if (payload.eventType === 'INSERT') {
            const newPayment = payload.new as any;
            const amount = new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD' 
            }).format(newPayment.amount || 0);
            
            toast({
              title: "💰 Payment Recorded",
              description: `${amount} payment received (${newPayment.payment_type || 'payment'}).`,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to damage claims changes
    const damageClaimsChannel = supabase
      .channel('damage-claims-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'damage_claims' },
        (payload) => {
          console.log('Damage claim change detected:', payload);
          refreshDamageClaims();
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Damage Report Created",
              description: "A new damage report has been filed.",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    // Subscribe to customer changes
    const customersChannel = supabase
      .channel('customers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        (payload) => {
          console.log('👤 Customer change detected:', payload);
          refreshCustomers();
          
          if (payload.eventType === 'INSERT') {
            const newCustomer = payload.new as any;
            toast({
              title: "🤝 New Customer Added",
              description: `${newCustomer.full_name || 'New customer'} has been added to your fleet.`,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to vehicle inspections changes
    const inspectionsChannel = supabase
      .channel('inspections-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_inspections' },
        (payload) => {
          console.log('Inspection change detected:', payload);
          // Refresh bookings as inspections affect booking status
          refreshBookings();
        }
      )
      .subscribe();

    console.log('✅ Realtime subscriptions active');

    // Cleanup function
    return () => {
      console.log('🔴 Cleaning up realtime subscriptions...');
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(damageClaimsChannel);
      supabase.removeChannel(customersChannel);
      supabase.removeChannel(inspectionsChannel);
    };
  }, [refreshBookings, refreshPayments, refreshDamageClaims, refreshCustomers]);
};
