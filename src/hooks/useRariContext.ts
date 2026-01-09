import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface RariCurrentEntity {
  type: 'booking' | 'customer' | 'vehicle' | null;
  id: string | null;
  data: any;
  loadedAt: Date | null;
}

export interface RecentEntity {
  type: 'booking' | 'customer' | 'vehicle';
  id: string;
  name: string;
  viewedAt: Date;
}

export interface RariContextState {
  currentEntity: RariCurrentEntity;
  recentEntities: RecentEntity[];
  conversationContext: string[];
  isLoading: boolean;
}

const MAX_RECENT_ENTITIES = 10;
const MAX_CONVERSATION_CONTEXT = 5;

// UUID validation helper - prevents invalid IDs from being fetched
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export function useRariContext() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<RariContextState>({
    currentEntity: { type: null, id: null, data: null, loadedAt: null },
    recentEntities: [],
    conversationContext: [],
    isLoading: false,
  });

  // Watch for entity IDs in URL params
  const bookingId = searchParams.get('bookingId');
  const customerId = searchParams.get('customerId');
  const vehicleId = searchParams.get('vehicleId');

  // Fetch booking data
  const fetchBooking = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        vehicles(id, name, make, model, year),
        customers(id, full_name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch booking:', error);
      return null;
    }
    return data;
  }, []);

  // Fetch customer data
  const fetchCustomer = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch customer:', error);
      return null;
    }
    return data;
  }, []);

  // Fetch vehicle data
  const fetchVehicle = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch vehicle:', error);
      return null;
    }
    return data;
  }, []);

  // Add to recent entities
  const addToRecentEntities = useCallback((entity: RecentEntity) => {
    setState(prev => {
      const filtered = prev.recentEntities.filter(
        e => !(e.type === entity.type && e.id === entity.id)
      );
      return {
        ...prev,
        recentEntities: [entity, ...filtered].slice(0, MAX_RECENT_ENTITIES),
      };
    });
  }, []);

  // Add conversation topic
  const addConversationTopic = useCallback((topic: string) => {
    setState(prev => ({
      ...prev,
      conversationContext: [topic, ...prev.conversationContext].slice(0, MAX_CONVERSATION_CONTEXT),
    }));
  }, []);

  // Clear current context
  const clearContext = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentEntity: { type: null, id: null, data: null, loadedAt: null },
    }));
  }, []);

  // Get context summary for AI
  const getContextSummary = useCallback((): string => {
    const parts: string[] = [];

    if (state.currentEntity.type && state.currentEntity.data) {
      const { type, data } = state.currentEntity;
      
      if (type === 'booking') {
        const vehicleName = data.vehicles ? `${data.vehicles.year} ${data.vehicles.make} ${data.vehicles.model}` : 'Unknown Vehicle';
        const customerName = data.customers?.full_name || data.customer_name;
        parts.push(`Currently viewing booking for ${vehicleName} by ${customerName} from ${data.start_date} to ${data.end_date}. Daily rate: $${data.daily_rate}. Status: ${data.status}.`);
      } else if (type === 'customer') {
        parts.push(`Currently viewing customer: ${data.full_name}, Email: ${data.email}, Phone: ${data.phone || 'N/A'}. Total bookings: ${data.total_bookings || 0}.`);
      } else if (type === 'vehicle') {
        parts.push(`Currently viewing vehicle: ${data.year} ${data.make} ${data.model}. License: ${data.license_plate || 'N/A'}. Status: ${data.status}. Rate: $${data.current_rate}/day.`);
      }
    }

    if (state.recentEntities.length > 0) {
      const recent = state.recentEntities.slice(0, 3).map(e => `${e.type}: ${e.name}`).join(', ');
      parts.push(`Recently viewed: ${recent}`);
    }

    if (state.conversationContext.length > 0) {
      parts.push(`Recent topics: ${state.conversationContext.join(', ')}`);
    }

    return parts.join(' ');
  }, [state]);

  // Get display label for current entity
  const getContextLabel = useCallback((): string | null => {
    if (!state.currentEntity.type || !state.currentEntity.data) return null;

    const { type, data } = state.currentEntity;

    if (type === 'booking') {
      const vehicleName = data.vehicles 
        ? `${data.vehicles.make} ${data.vehicles.model}` 
        : 'Booking';
      return `${vehicleName} #${data.id.slice(0, 8)}`;
    } else if (type === 'customer') {
      return data.full_name;
    } else if (type === 'vehicle') {
      return `${data.year} ${data.make} ${data.model}`;
    }

    return null;
  }, [state.currentEntity]);

  // Watch URL params and fetch entity data
  useEffect(() => {
    const loadEntity = async () => {
      let type: 'booking' | 'customer' | 'vehicle' | null = null;
      let id: string | null = null;
      let fetchFn: ((id: string) => Promise<any>) | null = null;

      // Only process valid UUIDs - skip invalid ones like "linking"
      if (bookingId && isValidUUID(bookingId)) {
        type = 'booking';
        id = bookingId;
        fetchFn = fetchBooking;
      } else if (customerId && isValidUUID(customerId)) {
        type = 'customer';
        id = customerId;
        fetchFn = fetchCustomer;
      } else if (vehicleId && isValidUUID(vehicleId)) {
        type = 'vehicle';
        id = vehicleId;
        fetchFn = fetchVehicle;
      }

      // Clear if no valid entity in URL
      if (!type || !id) {
        setState(prev => ({
          ...prev,
          currentEntity: { type: null, id: null, data: null, loadedAt: null },
        }));
        return;
      }

      // Skip if already loaded
      if (state.currentEntity.type === type && state.currentEntity.id === id) {
        return;
      }

      setState(prev => ({ ...prev, isLoading: true }));

      const data = await fetchFn!(id);

      if (data) {
        const entityName = type === 'booking' 
          ? `${data.vehicles?.make || ''} ${data.vehicles?.model || ''} Booking`.trim()
          : type === 'customer'
          ? data.full_name
          : `${data.year} ${data.make} ${data.model}`;

        setState(prev => ({
          ...prev,
          currentEntity: { type, id, data, loadedAt: new Date() },
          isLoading: false,
        }));

        addToRecentEntities({
          type,
          id,
          name: entityName,
          viewedAt: new Date(),
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadEntity();
  }, [bookingId, customerId, vehicleId, fetchBooking, fetchCustomer, fetchVehicle, addToRecentEntities, state.currentEntity.type, state.currentEntity.id]);

  return {
    ...state,
    clearContext,
    addConversationTopic,
    getContextSummary,
    getContextLabel,
  };
}
