import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { DetectedEntity } from './useEntityDetection';

export interface CustomerPreview {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  total_bookings: number;
  lifetime_value: number;
  customer_status: string;
}

export interface BookingPreview {
  id: string;
  customer_name: string;
  vehicle_id: string;
  vehicle_make?: string;
  vehicle_model?: string;
  start_date: string;
  end_date: string;
  status: string;
  total_value: number;
}

export interface VehiclePreview {
  id: string;
  make: string;
  model: string;
  year: number;
  status: string;
  current_rate: number;
  utilization: number;
}

export interface EnrichedEntity extends DetectedEntity {
  enrichedData?: {
    customer?: CustomerPreview;
    booking?: BookingPreview;
    vehicle?: VehiclePreview;
  };
  isLoading?: boolean;
  error?: string;
}

export function useEntityEnrichment(entities: DetectedEntity[]): EnrichedEntity[] {
  const { user } = useAuth();
  const [enrichedEntities, setEnrichedEntities] = useState<EnrichedEntity[]>(
    entities.map(e => ({ ...e, isLoading: true }))
  );

  useEffect(() => {
    if (!user || entities.length === 0) {
      setEnrichedEntities(entities.map(e => ({ ...e, isLoading: false })));
      return;
    }

    const enrichEntities = async () => {
      const enriched = await Promise.all(
        entities.map(async (entity): Promise<EnrichedEntity> => {
          try {
            switch (entity.type) {
              case 'booking': {
                // Try to find booking by ID (UUID)
                const { data: booking, error } = await supabase
                  .from('bookings')
                  .select(`
                    id,
                    customer_name,
                    vehicle_id,
                    start_date,
                    end_date,
                    status,
                    total_value,
                    vehicles (
                      make,
                      model
                    )
                  `)
                  .eq('user_id', user.id)
                  .eq('id', entity.value)
                  .single();

                if (!error && booking) {
                  return {
                    ...entity,
                    enrichedData: {
                      booking: {
                        id: booking.id,
                        customer_name: booking.customer_name,
                        vehicle_id: booking.vehicle_id,
                        vehicle_make: booking.vehicles?.make,
                        vehicle_model: booking.vehicles?.model,
                        start_date: booking.start_date,
                        end_date: booking.end_date,
                        status: booking.status,
                        total_value: booking.total_value,
                      },
                    },
                    isLoading: false,
                  };
                }
                break;
              }

              case 'customer': {
                // Search customer by name or ID
                const { data: customers, error } = await supabase
                  .from('customers')
                  .select('*')
                  .eq('user_id', user.id)
                  .or(`id.eq.${entity.value},full_name.ilike.%${entity.value}%`)
                  .limit(1);

                if (!error && customers && customers.length > 0) {
                  const customer = customers[0];
                  return {
                    ...entity,
                    enrichedData: {
                      customer: {
                        id: customer.id,
                        full_name: customer.full_name,
                        email: customer.email,
                        phone: customer.phone,
                        total_bookings: customer.total_bookings || 0,
                        lifetime_value: customer.lifetime_value || 0,
                        customer_status: customer.customer_status,
                      },
                    },
                    isLoading: false,
                  };
                }
                break;
              }

              case 'vehicle': {
                // Search vehicle by ID
                const { data: vehicle, error } = await supabase
                  .from('vehicles')
                  .select('*')
                  .eq('user_id', user.id)
                  .eq('id', entity.value)
                  .single();

                if (!error && vehicle) {
                  return {
                    ...entity,
                    enrichedData: {
                      vehicle: {
                        id: vehicle.id,
                        make: vehicle.make,
                        model: vehicle.model,
                        year: vehicle.year,
                        status: vehicle.status,
                        current_rate: vehicle.current_rate,
                        utilization: vehicle.utilization || 0,
                      },
                    },
                    isLoading: false,
                  };
                }
                break;
              }

              default:
                // Phone and email don't need enrichment
                return { ...entity, isLoading: false };
            }

            // If no data found, return entity without enrichment
            return { ...entity, isLoading: false };
          } catch (err) {
            console.error('[Entity Enrichment] Error enriching entity:', err);
            return {
              ...entity,
              isLoading: false,
              error: 'Failed to load details',
            };
          }
        })
      );

      setEnrichedEntities(enriched);
    };

    // Debounce enrichment
    const timeoutId = setTimeout(enrichEntities, 300);
    return () => clearTimeout(timeoutId);
  }, [entities, user]);

  return enrichedEntities;
}
