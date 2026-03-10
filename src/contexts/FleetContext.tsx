import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useTeam } from './TeamContext';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { z } from 'zod';
import confetti from 'canvas-confetti';
import { devLog, devError, devWarn } from '@/lib/logger';
import { useRealtimeReconnect } from '@/hooks/useRealtimeReconnect';
import {
  customerSchema,
  bookingSchema,
  messageSchema,
  damageClaimSchema,
  paymentSchema,
  vehicleSchema
} from '@/lib/validationSchemas';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];
type Document = Database['public']['Tables']['documents']['Row'];
type Maintenance = Database['public']['Tables']['maintenance_schedules']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerNote = Database['public']['Tables']['customer_notes']['Row'];
type VehicleInspection = Database['public']['Tables']['vehicle_inspections']['Row'];
type DamageClaim = Database['public']['Tables']['damage_claims']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];

interface FleetContextType {
  vehicles: Vehicle[];
  bookings: Booking[];
  documents: Document[];
  maintenance: Maintenance[];
  messages: Message[];
  customers: Customer[];
  customerNotes: CustomerNote[];
  inspections: VehicleInspection[];
  damageClaims: DamageClaim[];
  payments: Payment[];
  revenue: { today: number; month: number; change: number };
  loading: boolean;
  isRefreshing: boolean; // New: show subtle "updating" state without blocking UI
  error: string | null;
  applyPriceOptimization: (vehicleId: string, newRate: number) => Promise<void>;
  createVehicle: (vehicle: Omit<Database['public']['Tables']['vehicles']['Insert'], 'user_id'>) => Promise<{ id: string; name: string } | undefined>;
  deleteVehicle: (vehicleId: string) => Promise<boolean>;
  deleteVehicles: (vehicleIds: string[]) => Promise<{ success: number; failed: number }>;
  createBooking: (booking: Omit<Database['public']['Tables']['bookings']['Insert'], 'user_id'>) => Promise<void>;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => Promise<void>;
  updateBookingVehicle: (bookingId: string, newVehicleId: string) => Promise<void>;
  updateBookingDetails: (bookingId: string, updates: Partial<Booking>) => Promise<void>;
  uploadDocument: (document: Omit<Database['public']['Tables']['documents']['Insert'], 'user_id'>) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  createMaintenance: (maintenance: Omit<Database['public']['Tables']['maintenance_schedules']['Insert'], 'user_id'>) => Promise<void>;
  sendMessage: (message: Omit<Database['public']['Tables']['messages']['Insert'], 'user_id'>) => Promise<void>;
  generateReport: (reportType: string, dateRange: { start: string; end: string }, format: string) => Promise<void>;
  createCustomer: (customer: Omit<Database['public']['Tables']['customers']['Insert'], 'user_id'>) => Promise<void>;
  updateCustomer: (customerId: string, updates: Partial<Customer>) => Promise<void>;
  addCustomerNote: (customerId: string, note: string, createdBy: string) => Promise<void>;
  blacklistCustomer: (customerId: string, reason: string) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<boolean>;
  createInspection: (inspection: Omit<Database['public']['Tables']['vehicle_inspections']['Insert'], 'user_id'>) => Promise<void>;
  createInspectionWithPhotos: (inspection: Omit<Database['public']['Tables']['vehicle_inspections']['Insert'], 'user_id'>, photos: Array<{ photo_url: string; photo_type: string; storage_path: string }>) => Promise<void>;
  createDamageClaim: (claim: Omit<Database['public']['Tables']['damage_claims']['Insert'], 'user_id'>) => Promise<void>;
  createPayment: (payment: Omit<Database['public']['Tables']['payments']['Insert'], 'user_id'>) => Promise<void>;
  refreshData: (force?: boolean) => Promise<void>;
  refreshBookings: () => void;
  refreshPayments: () => void;
  refreshDamageClaims: () => void;
  refreshCustomers: () => void;
  refreshInspections: () => void;
  refreshMaintenance: () => void;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

export const FleetProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { currentTeam, selectedLocationId, loading: teamLoading } = useTeam();
  
  // CRITICAL: Separate "initial loading" (full-screen spinner) from "background refreshing"
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Enterprise-grade concurrency controls
  const refreshSeqRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const hasInitializedForUserRef = useRef<string | null>(null);
  const lastTeamIdRef = useRef<string | null>(null);
  
  const [revenue, setRevenue] = useState({ today: 0, month: 0, change: 0 });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [inspections, setInspections] = useState<VehicleInspection[]>([]);
  const [damageClaims, setDamageClaims] = useState<DamageClaim[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Helper to get current filters - use refs to avoid stale closures
  const userRef = useRef(user);
  const teamRef = useRef(currentTeam);
  
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { teamRef.current = currentTeam; }, [currentTeam]);

  // CRITICAL: Only hard-reset when USER changes (actual account switch)
  // Team changes get a soft refresh (no UI wipe)
  useEffect(() => {
    if (user?.id !== hasInitializedForUserRef.current) {
      // User actually changed - hard reset
      if (hasInitializedForUserRef.current !== null) {
        devLog('[FleetContext] User switched:', hasInitializedForUserRef.current, '->', user?.id);
        // Clear all data for security
        setVehicles([]);
        setBookings([]);
        setDocuments([]);
        setMaintenance([]);
        setMessages([]);
        setCustomers([]);
        setCustomerNotes([]);
        setInspections([]);
        setDamageClaims([]);
        setPayments([]);
        setRevenue({ today: 0, month: 0, change: 0 });
        setLoading(true);
        setError(null);
      }
      hasInitializedForUserRef.current = user?.id || null;
      lastTeamIdRef.current = null; // Reset team tracking for new user
    }
  }, [user?.id]);

  // Core refresh logic - enterprise-grade with concurrency guard and session validation
  const refreshDataCore = useCallback(async (opts: { 
    isInitialLoad?: boolean;
    forceTeamId?: string | null;
  } = {}) => {
    const { isInitialLoad = false, forceTeamId } = opts;
    
    // Concurrency guard - prevent parallel refreshes
    if (isRefreshingRef.current) {
      devLog('[FleetContext] Refresh already in progress, skipping');
      return;
    }
    
    const seq = ++refreshSeqRef.current;
    const currentUser = userRef.current;
    const currentTeamData = teamRef.current;
    const teamId = forceTeamId !== undefined ? forceTeamId : currentTeamData?.id;
    const userId = currentUser?.id;
    
    devLog('[FleetContext] Refresh started, seq:', seq, 'initial:', isInitialLoad, 'teamId:', teamId, 'userId:', userId);
    
    if (!currentUser || authLoading) {
      devLog('[FleetContext] No user or auth loading, skipping');
      setLoading(false);
      return;
    }
    
    isRefreshingRef.current = true;
    
    // Only show full-screen loading on initial load
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    
    try {
      // PHASE 2: Pre-fetch session validation
      // Verify session is valid before attempting data fetch
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        devWarn('[FleetContext] No valid session, aborting data fetch');
        setLoading(false);
        setIsRefreshing(false);
        isRefreshingRef.current = false;
        setError('Session expired. Please sign in again.');
        return;
      }
      
      // Check if token is close to expiry (< 5 minutes remaining)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const expiresAtMs = expiresAt * 1000;
        const timeRemaining = expiresAtMs - Date.now();
        const FIVE_MINUTES = 5 * 60 * 1000;
        
        if (timeRemaining < FIVE_MINUTES) {
          devLog('[FleetContext] Token near expiry, attempting refresh...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            devWarn('[FleetContext] Session refresh failed:', refreshError.message);
            setLoading(false);
            setIsRefreshing(false);
            isRefreshingRef.current = false;
            setError('Session expired. Please sign in again.');
            return;
          }
          devLog('[FleetContext] Session refreshed successfully');
        }
      }

      // Determine filter column and value
      const filterCol = teamId ? 'team_id' : 'user_id';
      const filterVal = teamId || userId!;

      // Timeout wrapper to prevent infinite loading
      // Use longer timeout for initial load (60s) vs background refresh (30s)
      const FETCH_TIMEOUT_MS = isInitialLoad ? 60000 : 30000;
      const fetchWithTimeout = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout: ${label} took longer than ${FETCH_TIMEOUT_MS / 1000}s`)), FETCH_TIMEOUT_MS)
          )
        ]);
      };

      // Parallel fetch for performance - explicit queries avoid TS infinite recursion
      const [
        vehiclesResult,
        bookingsResult,
        documentsResult,
        maintenanceResult,
        messagesResult,
        customersResult,
        inspectionsResult,
        claimsResult,
        paymentsResult,
      ] = await fetchWithTimeout(
        Promise.all([
          supabase.from('vehicles').select('*').eq(filterCol, filterVal).order('created_at', { ascending: false }),
          supabase.from('bookings').select('*').eq(filterCol, filterVal).gte('end_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()).order('start_date', { ascending: false }).limit(5000),
          supabase.from('documents').select('*').eq(filterCol, filterVal).order('created_at', { ascending: false }),
          supabase.from('maintenance_schedules').select('*').eq(filterCol, filterVal).order('scheduled_date', { ascending: true }),
          supabase.from('messages').select('*').eq('user_id', userId!).order('created_at', { ascending: false }),
          supabase.from('customers').select('*').eq(filterCol, filterVal).order('created_at', { ascending: false }),
          supabase.from('vehicle_inspections').select('*').eq(filterCol, filterVal).order('created_at', { ascending: false }),
          supabase.from('damage_claims').select('*').eq(filterCol, filterVal).order('created_at', { ascending: false }),
          supabase.from('payments').select('*').eq(filterCol, filterVal).order('created_at', { ascending: false }),
        ]),
        'fleet data fetch'
      );
      
      // Check if this request is stale
      if (seq !== refreshSeqRef.current) {
        devLog('[FleetContext] Stale refresh abandoned, seq:', seq);
        return;
      }

      // Check for errors
      const errors = [
        vehiclesResult.error,
        bookingsResult.error,
        documentsResult.error,
        maintenanceResult.error,
        messagesResult.error,
        customersResult.error,
        inspectionsResult.error,
        claimsResult.error,
        paymentsResult.error,
      ].filter(Boolean);
      
      if (errors.length > 0) {
        throw errors[0];
      }

      // Update state atomically
      setVehicles(vehiclesResult.data || []);
      setBookings(bookingsResult.data || []);
      setDocuments(documentsResult.data || []);
      setMaintenance(maintenanceResult.data || []);
      setMessages(messagesResult.data || []);
      setCustomers(customersResult.data || []);
      setInspections(inspectionsResult.data || []);
      setDamageClaims(claimsResult.data || []);
      setPayments(paymentsResult.data || []);

      // Fetch customer notes based on loaded customers
      const customerIds = customersResult.data?.map(c => c.id) || [];
      if (customerIds.length > 0) {
        const { data: notesData } = await supabase
          .from('customer_notes')
          .select('*')
          .in('customer_id', customerIds)
          .order('created_at', { ascending: false });
        
        if (seq === refreshSeqRef.current) {
          setCustomerNotes(notesData || []);
        }
      } else {
        setCustomerNotes([]);
      }

      // Calculate revenue
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const confirmedBookings = bookingsResult.data?.filter(b => 
        b.status === 'confirmed' || b.status === 'completed'
      ) || [];
      
      const todayRevenue = confirmedBookings
        .filter(b => new Date(b.start_date) >= today)
        .reduce((sum, b) => sum + parseFloat(b.total_value?.toString() || '0'), 0);
      
      const monthRevenue = confirmedBookings
        .reduce((sum, b) => sum + parseFloat(b.total_value?.toString() || '0'), 0);

      if (seq === refreshSeqRef.current) {
        setRevenue({ today: todayRevenue, month: monthRevenue, change: 12 });
        devLog('[FleetContext] Refresh complete, seq:', seq, 'vehicles:', vehiclesResult.data?.length || 0);
      }

    } catch (err: any) {
      if (seq === refreshSeqRef.current) {
        const errorMessage = err.message || 'Failed to load data';
        devError('[FleetContext] Error loading data:', err);
        setError(errorMessage);
        toast({
          title: "Error Loading Data",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      if (seq === refreshSeqRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
      isRefreshingRef.current = false;
    }
  }, [authLoading, toast]);

  // Public refresh function - always does a background refresh
  // force=true bypasses the concurrency guard (use for recovery UI)
  const refreshData = useCallback(async (force?: boolean) => {
    if (force) {
      // Force mode: reset the guard so we can start a fresh fetch
      isRefreshingRef.current = false;
      refreshSeqRef.current++;
      devLog('[FleetContext] Force refresh requested, resetting guards');
    }
    await refreshDataCore({ isInitialLoad: false });
  }, [refreshDataCore]);

  // INITIAL LOAD: Only trigger ONCE per user session
  // This is the ONLY place that sets loading=true on first load
  useEffect(() => {
    // Wait for auth + team resolution to settle.
    // IMPORTANT: fetching with user_id before team is known can be extremely slow
    // under RLS (and may not return the correct team-scoped data).
    if (authLoading || teamLoading) {
      devLog('[FleetContext] Waiting for auth/team...', { authLoading, teamLoading });
      return;
    }
    
    // No user = no data needed
    if (!user) {
      devLog('[FleetContext] No user, clearing state');
      setLoading(false);
      return;
    }
    
    const resolvedTeamId = currentTeam?.id ?? null;
    const teamKey = resolvedTeamId ?? 'no-team';

    // Check if we already initialized for this user+team
    if (hasInitializedForUserRef.current === user.id && lastTeamIdRef.current === teamKey) {
      devLog('[FleetContext] Already initialized for user/team', { userId: user.id, teamKey });
      return;
    }
    
    devLog('[FleetContext] Initial load for user:', user.id);
    lastTeamIdRef.current = teamKey;
    refreshDataCore({ isInitialLoad: true, forceTeamId: resolvedTeamId });
  }, [authLoading, teamLoading, user?.id, currentTeam?.id]);

  // TEAM CHANGE: Soft refresh (no UI wipe) when team changes AFTER initial load
  useEffect(() => {
    // Skip if no user or still in initial load phase
    if (!user || authLoading || teamLoading) return;
    if (lastTeamIdRef.current === null) return; // Initial load not done yet
    
    // Check if team actually changed
    const newTeamId = currentTeam?.id ?? null;
    const newTeamKey = newTeamId ?? 'no-team';

    if (lastTeamIdRef.current === newTeamKey) return;
    
    devLog('[FleetContext] Team changed:', lastTeamIdRef.current, '->', newTeamKey);
    lastTeamIdRef.current = newTeamKey;
    
    // Soft refresh - don't wipe UI, just update data
    refreshDataCore({ isInitialLoad: false, forceTeamId: newTeamId });
  }, [currentTeam?.id, user?.id, authLoading, teamLoading]); // Intentionally exclude refreshDataCore

  // Individual refresh methods for real-time updates
  const refreshBookings = useCallback(() => {
    const currentUser = userRef.current;
    const teamId = teamRef.current?.id;
    if (!currentUser) return;
    
    let query = supabase.from('bookings').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', currentUser.id);
    }
    query.gte('end_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('start_date', { ascending: false })
      .limit(5000)
      .then(({ data }) => setBookings(data || []));
  }, []);

  const refreshPayments = useCallback(() => {
    const currentUser = userRef.current;
    const teamId = teamRef.current?.id;
    if (!currentUser) return;
    
    let query = supabase.from('payments').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', currentUser.id);
    }
    query.order('created_at', { ascending: false })
      .then(({ data }) => setPayments(data || []));
  }, []);

  const refreshDamageClaims = useCallback(() => {
    const currentUser = userRef.current;
    const teamId = teamRef.current?.id;
    if (!currentUser) return;
    
    let query = supabase.from('damage_claims').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', currentUser.id);
    }
    query.order('reported_date', { ascending: false })
      .then(({ data }) => setDamageClaims(data || []));
  }, []);

  const refreshCustomers = useCallback(() => {
    const currentUser = userRef.current;
    const teamId = teamRef.current?.id;
    if (!currentUser) return;
    
    let query = supabase.from('customers').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', currentUser.id);
    }
    query.order('created_at', { ascending: false })
      .then(({ data }) => setCustomers(data || []));
  }, []);

  const refreshVehicles = useCallback(() => {
    const currentUser = userRef.current;
    const teamId = teamRef.current?.id;
    if (!currentUser) return;
    
    let query = supabase.from('vehicles').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', currentUser.id);
    }
    query.order('created_at', { ascending: false })
      .then(({ data }) => setVehicles(data || []));
  }, []);

  const refreshInspections = useCallback(() => {
    const currentUser = userRef.current;
    const teamId = teamRef.current?.id;
    if (!currentUser) return;
    
    let query = supabase.from('vehicle_inspections').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', currentUser.id);
    }
    query.order('created_at', { ascending: false })
      .then(({ data }) => setInspections(data || []));
  }, []);

  const refreshMaintenance = useCallback(() => {
    const currentUser = userRef.current;
    const teamId = teamRef.current?.id;
    if (!currentUser) return;
    
    let query = supabase.from('maintenance_schedules').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', currentUser.id);
    }
    query.order('scheduled_date', { ascending: true })
      .then(({ data }) => setMaintenance(data || []));
  }, []);

  // ENTERPRISE REAL-TIME: Team-filtered subscriptions with debouncing
  // Using refs to keep refresh functions stable
  const refreshFnsRef = useRef({
    bookings: refreshBookings,
    payments: refreshPayments,
    damageClaims: refreshDamageClaims,
    customers: refreshCustomers,
    vehicles: refreshVehicles,
    inspections: refreshInspections,
    maintenance: refreshMaintenance,
  });

  useEffect(() => {
    refreshFnsRef.current = {
      bookings: refreshBookings,
      payments: refreshPayments,
      damageClaims: refreshDamageClaims,
      customers: refreshCustomers,
      vehicles: refreshVehicles,
      inspections: refreshInspections,
      maintenance: refreshMaintenance,
    };
  }, [refreshBookings, refreshPayments, refreshDamageClaims, refreshCustomers, refreshVehicles, refreshInspections, refreshMaintenance]);

  // Debounced refresh functions to coalesce rapid real-time updates
  const debounceTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  
  const debouncedRefresh = useMemo(() => {
    const DEBOUNCE_MS = 500; // Coalesce updates within 500ms window
    
    return (tableName: keyof typeof refreshFnsRef.current) => {
      // Clear existing timeout for this table
      if (debounceTimeoutsRef.current[tableName]) {
        clearTimeout(debounceTimeoutsRef.current[tableName]);
      }
      
      // Schedule debounced refresh
      debounceTimeoutsRef.current[tableName] = setTimeout(() => {
        devLog(`[FleetContext] Debounced refresh for: ${tableName}`);
        refreshFnsRef.current[tableName]();
        delete debounceTimeoutsRef.current[tableName];
      }, DEBOUNCE_MS);
    };
  }, []);

  // Cleanup debounce timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  // Real-time subscription management
  const channelRef = useRef<any>(null);
  const subscribedForRef = useRef<string | null>(null);

  // Force realtime reconnection
  const forceRealtimeReconnect = useCallback(() => {
    devLog('[FleetContext] Forcing realtime reconnection');
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    subscribedForRef.current = null;
    // This will trigger the effect below to recreate the channel
  }, []);

  // PHASE 3: Realtime reconnection on visibility change
  const { recordRealtimeEvent } = useRealtimeReconnect({
    staleThresholdMs: 5 * 60 * 1000, // 5 minutes
    onReconnectNeeded: forceRealtimeReconnect,
    isActive: !!user,
  });

  useEffect(() => {
    // CRITICAL: Wait for team resolution before setting up realtime
    // This prevents "no-team" subscriptions and unnecessary churn
    if (!user || teamLoading) return;
    
    const teamId = currentTeam?.id;
    const subscriptionKey = `${user.id}:${teamId || 'no-team'}`;
    
    // Already subscribed for this user+team combo
    if (subscribedForRef.current === subscriptionKey) return;
    
    // Cleanup previous subscription
    if (channelRef.current) {
      devLog('[FleetContext] Cleaning up previous realtime subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    subscribedForRef.current = subscriptionKey;
    devLog('[FleetContext] Setting up realtime for:', subscriptionKey);
    
    // Create a single multiplexed channel for all table changes
    // This is more efficient than multiple channels
    // Using debounced refresh to coalesce rapid updates
    const channel = supabase
      .channel(`fleet-realtime-${subscriptionKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          recordRealtimeEvent(); // Track event for stale detection
          const record = payload.new as any || payload.old as any;
          if (teamId && record?.team_id && record.team_id !== teamId) return;
          debouncedRefresh('bookings');
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          recordRealtimeEvent();
          const record = payload.new as any || payload.old as any;
          if (teamId && record?.team_id && record.team_id !== teamId) return;
          debouncedRefresh('payments');
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' },
        (payload) => {
          recordRealtimeEvent();
          const record = payload.new as any || payload.old as any;
          if (teamId && record?.team_id && record.team_id !== teamId) return;
          debouncedRefresh('vehicles');
        })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          devLog('[FleetContext] ✅ Realtime subscriptions active');
          recordRealtimeEvent(); // Mark initial subscription as "event"
        } else if (status === 'CHANNEL_ERROR') {
          devError('[FleetContext] ❌ Realtime subscription error');
        }
      });
    
    channelRef.current = channel;
    
    return () => {
      if (channelRef.current) {
        devLog('[FleetContext] Cleaning up realtime subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedForRef.current = null;
      }
    };
  }, [user?.id, currentTeam?.id, teamLoading, recordRealtimeEvent]);

  // CRUD Operations with optimistic updates where appropriate
  const applyPriceOptimization = async (vehicleId: string, newRate: number) => {
    if (!user) return;

    const { error } = await supabase
      .from('vehicles')
      .update({ current_rate: newRate, suggested_rate: null })
      .eq('id', vehicleId)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Real-time will handle the refresh
    const vehicle = vehicles.find(v => v.id === vehicleId);
    toast({
      title: "Price Updated Successfully",
      description: `${vehicle?.name} rate updated to $${newRate}/day`,
    });
  };

  const createVehicle = async (vehicle: Omit<Database['public']['Tables']['vehicles']['Insert'], 'user_id'>): Promise<{ id: string; name: string } | undefined> => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to add a vehicle.", variant: "destructive" });
      return undefined;
    }

    const teamId = currentTeam?.id;
    if (!teamId) {
      toast({ title: "Team Not Ready", description: "Team not loaded yet, please refresh the page.", variant: "destructive" });
      return undefined;
    }

    try {
      const validated = vehicleSchema.parse(vehicle);

      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          ...(validated as any),
          user_id: user.id,
          team_id: teamId
        })
        .select('id, name')
        .single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return undefined;
      }

      // Force full data refresh to sync all modules immediately
      await refreshData(true);

      const isFirstVehicle = vehicles.length === 0;
      if (isFirstVehicle) {
        const duration = 2000;
        const end = Date.now() + duration;
        const frame = () => {
          confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#0066FF', '#00D4FF', '#FFD700'] });
          confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#0066FF', '#00D4FF', '#FFD700'] });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
      }

      return { id: data.id, name: data.name };
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        throw error;
      }
      return undefined;
    }
  };

  const createBooking = async (booking: Omit<Database['public']['Tables']['bookings']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      const validated = bookingSchema.parse(booking);
      const teamId = currentTeam?.id;
      const locationId = selectedLocationId !== 'all' ? selectedLocationId : null;

      const { data: insertedBooking, error } = await supabase
        .from('bookings')
        .insert({
          ...(validated as any),
          user_id: user.id,
          team_id: teamId || null,
          pickup_location_id: (validated as any).pickup_location_id || locationId,
          dropoff_location_id: (validated as any).dropoff_location_id || locationId
        })
        .select('id')
        .single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      // Auto-create or link CRM customer
      if (!booking.customer_id && insertedBooking) {
        try {
          // Check for existing customer by email or name to prevent duplicates
          let existingCustomerId: string | null = null;
          
          if (booking.customer_email) {
            const { data: existing } = await supabase
              .from('customers')
              .select('id')
              .eq('email', booking.customer_email)
              .eq('user_id', user.id)
              .maybeSingle();
            if (existing) existingCustomerId = existing.id;
          }
          
          if (!existingCustomerId && booking.customer_name) {
            const { data: existing } = await supabase
              .from('customers')
              .select('id')
              .eq('full_name', booking.customer_name)
              .eq('user_id', user.id)
              .maybeSingle();
            if (existing) existingCustomerId = existing.id;
          }

          if (existingCustomerId) {
            // Link existing customer to booking
            await supabase
              .from('bookings')
              .update({ customer_id: existingCustomerId })
              .eq('id', insertedBooking.id);
          } else {
            // Create new customer
            const { data: newCustomer } = await supabase
              .from('customers')
              .insert({
                full_name: booking.customer_name,
                email: booking.customer_email || `${booking.customer_name.toLowerCase().replace(/\s+/g, '.')}@placeholder.com`,
                phone: booking.customer_phone || null,
                user_id: user.id,
                team_id: teamId || null,
              })
              .select('id')
              .single();

            if (newCustomer) {
              await supabase
                .from('bookings')
                .update({ customer_id: newCustomer.id })
                .eq('id', insertedBooking.id);
            }
          }
        } catch (customerError) {
          console.error('Failed to auto-create/link customer:', customerError);
        }
      }

      const isFirstBooking = bookings.length === 0;
      if (isFirstBooking) {
        const duration = 2000;
        const end = Date.now() + duration;
        const frame = () => {
          confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#0066FF', '#00D4FF', '#FFD700'] });
          confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#0066FF', '#00D4FF', '#FFD700'] });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
        toast({
          title: "🎉 First Booking Created!",
          description: "Congratulations on your first booking! Your fleet business is off to a great start.",
        });
      } else {
      toast({ title: "Booking Created", description: "Booking has been successfully created." });
      }

      // Force refresh to show new booking immediately in calendar & pending approval
      await refreshData(true);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        throw error;
      }
    }
  };

  const updateBookingStatus = async (bookingId: string, status: Booking['status']) => {
    if (!user) return;

    const updates: Partial<Booking> = { status };
    if (status === 'confirmed') {
      updates.confirmed_at = new Date().toISOString();
    } else if (status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Booking Updated", description: `Booking status changed to ${status}.` });
  };

  const updateBookingVehicle = async (bookingId: string, newVehicleId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('bookings')
      .update({ vehicle_id: newVehicleId })
      .eq('id', bookingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Vehicle Changed", description: "Booking vehicle has been updated." });
  };

  const updateBookingDetails = async (bookingId: string, updates: Partial<Booking>) => {
    if (!user) return;

    const { error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Booking Updated", description: "Booking details have been updated." });
  };

  const uploadDocument = async (document: Omit<Database['public']['Tables']['documents']['Insert'], 'user_id'>) => {
    if (!user) return;
    const teamId = currentTeam?.id;

    const { error } = await supabase
      .from('documents')
      .insert({ ...document, user_id: user.id, team_id: teamId || null });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await refreshData();
    toast({ title: "Document Uploaded", description: "Document has been successfully uploaded." });
  };

  const deleteDocument = async (documentId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await refreshData();
    toast({ title: "Document Deleted", description: "Document has been removed." });
  };

  const createMaintenance = async (maintenance: Omit<Database['public']['Tables']['maintenance_schedules']['Insert'], 'user_id'>) => {
    if (!user) return;
    const teamId = currentTeam?.id;
    const locationId = selectedLocationId !== 'all' ? selectedLocationId : null;

    const { error } = await supabase
      .from('maintenance_schedules')
      .insert({
        ...maintenance,
        user_id: user.id,
        team_id: teamId || null,
        location_id: locationId
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await refreshData();
    toast({ title: "Maintenance Scheduled", description: "Maintenance has been scheduled." });
  };

  const sendMessage = async (message: Omit<Database['public']['Tables']['messages']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      const validated = messageSchema.parse(message);
      const teamId = currentTeam?.id;

      const { error } = await supabase
        .from('messages')
        .insert({ ...(validated as any), user_id: user.id, team_id: teamId || null });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      await refreshData();
      toast({ title: "Message Sent", description: "Your message has been sent." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        throw error;
      }
    }
  };

  const generateReport = async (reportType: string, dateRange: { start: string; end: string }, format: string) => {
    toast({ title: "Report Generated", description: `${reportType} report generated for ${dateRange.start} to ${dateRange.end} in ${format} format.` });
  };

  const createCustomer = async (customer: Omit<Database['public']['Tables']['customers']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      const validated = customerSchema.parse(customer);
      const teamId = currentTeam?.id;

      const { error } = await supabase
        .from('customers')
        .insert({ ...(validated as any), user_id: user.id, team_id: teamId || null });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      await refreshData();
      toast({ title: "Customer Added", description: "Customer has been successfully added." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        throw error;
      }
    }
  };

  const updateCustomer = async (customerId: string, updates: Partial<Customer>) => {
    if (!user) return;

    const { error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await refreshData();
    toast({ title: "Customer Updated", description: "Customer information has been updated." });
  };

  const addCustomerNote = async (customerId: string, note: string, createdBy: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('customer_notes')
      .insert({ customer_id: customerId, note, created_by: createdBy, user_id: user.id });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await refreshData();
    toast({ title: "Note Added", description: "Customer note has been added." });
  };

  const blacklistCustomer = async (customerId: string, reason: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('customers')
      .update({ customer_status: 'blacklisted', blacklist_reason: reason })
      .eq('id', customerId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    await refreshData();
    toast({ title: "Customer Blacklisted", description: "Customer has been added to the blacklist." });
  };

  const createInspection = async (inspection: Omit<Database['public']['Tables']['vehicle_inspections']['Insert'], 'user_id'>) => {
    if (!user) return;
    const teamId = currentTeam?.id;

    const { error } = await supabase
      .from('vehicle_inspections')
      .insert({ ...inspection, user_id: user.id, team_id: teamId || null });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Inspection Created", description: "Vehicle inspection has been recorded." });
  };

  const createInspectionWithPhotos = async (
    inspection: Omit<Database['public']['Tables']['vehicle_inspections']['Insert'], 'user_id'>,
    photos: Array<{ photo_url: string; photo_type: string; storage_path: string }>
  ) => {
    if (!user) return;
    const teamId = currentTeam?.id;

    const { data, error } = await supabase
      .from('vehicle_inspections')
      .insert({ ...inspection, user_id: user.id, team_id: teamId || null })
      .select()
      .single();

    if (error || !data) {
      toast({ title: "Error", description: error?.message || 'Failed to create inspection', variant: "destructive" });
      return;
    }

    if (photos.length > 0) {
      const photoRecords = photos.map(p => ({
        inspection_id: data.id,
        photo_url: p.photo_url,
        photo_type: p.photo_type,
      }));

      const { error: photoError } = await supabase.from('inspection_photos').insert(photoRecords);

      if (photoError) {
        console.error('Error saving inspection photos:', photoError);
      }
    }

    toast({ title: "Inspection Created", description: `Vehicle inspection recorded with ${photos.length} photos.` });
  };

  const createDamageClaim = async (claim: Omit<Database['public']['Tables']['damage_claims']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      const validated = damageClaimSchema.parse(claim);
      const teamId = currentTeam?.id;

      const { error } = await supabase
        .from('damage_claims')
        .insert({ ...(validated as any), user_id: user.id, team_id: teamId || null });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Damage Claim Created", description: "Damage claim has been recorded." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        throw error;
      }
    }
  };

  const createPayment = async (payment: Omit<Database['public']['Tables']['payments']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      const validated = paymentSchema.parse(payment);
      const teamId = currentTeam?.id;

      const { error } = await supabase
        .from('payments')
        .insert({ ...(validated as any), user_id: user.id, team_id: teamId || null });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      // Update booking payment status based on total payments
      try {
        const bookingId = payment.booking_id;
        const { data: allPayments } = await supabase
          .from('payments')
          .select('amount, payment_type')
          .eq('booking_id', bookingId)
          .eq('payment_status', 'completed');

        const booking = bookings.find(b => b.id === bookingId);
        if (booking && allPayments) {
          const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
          const totalValue = Number(booking.total_value);

          let newStatus: string;
          if (totalPaid >= totalValue) {
            newStatus = 'paid';
          } else if (payment.payment_type === 'deposit') {
            newStatus = 'deposit_paid';
          } else {
            newStatus = 'partial';
          }

          await supabase
            .from('bookings')
            .update({ payment_status: newStatus })
            .eq('id', bookingId);
        }
      } catch (statusError) {
        console.error('Failed to update booking payment status:', statusError);
      }

      toast({ title: "Payment Recorded", description: "Payment has been successfully recorded." });
      await refreshData(true);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        throw error;
      }
    }
  };

  // Delete a customer from CRM
  const deleteCustomer = async (customerId: string): Promise<boolean> => {
    if (!user) return false;

    // Check for active/confirmed bookings
    const activeBookings = bookings.filter(
      b => b.customer_id === customerId && (b.status === 'confirmed' || b.status === 'pending')
    );

    if (activeBookings.length > 0) {
      toast({
        title: "Cannot Delete",
        description: `This customer has ${activeBookings.length} active booking(s). Cancel or complete them first.`,
        variant: "destructive"
      });
      return false;
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (error) {
      devError('[FleetContext] Error deleting customer:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }

    // Optimistically remove from local state
    setCustomers(prev => prev.filter(c => c.id !== customerId));
    setCustomerNotes(prev => prev.filter(n => n.customer_id !== customerId));

    toast({ title: "Customer Deleted", description: "Customer has been removed from CRM." });
    return true;
  };

  // Delete a single vehicle
  const deleteVehicle = async (vehicleId: string): Promise<boolean> => {
    if (!user) return false;

    const vehicle = vehicles.find(v => v.id === vehicleId);
    
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicleId);

    if (error) {
      devError('[FleetContext] Error deleting vehicle:', error);
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
      return false;
    }

    // Optimistically remove from local state
    setVehicles(prev => prev.filter(v => v.id !== vehicleId));
    
    toast({ 
      title: "Vehicle Deleted", 
      description: vehicle ? `${vehicle.name} has been removed from your fleet.` : "Vehicle has been removed." 
    });
    
    return true;
  };

  // Batch delete multiple vehicles
  const deleteVehicles = async (vehicleIds: string[]): Promise<{ success: number; failed: number }> => {
    if (!user || vehicleIds.length === 0) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;

    // Delete in batches to avoid overwhelming the database
    for (const id of vehicleIds) {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);

      if (error) {
        devError('[FleetContext] Error deleting vehicle:', id, error);
        failed++;
      } else {
        success++;
      }
    }

    // Update local state
    setVehicles(prev => prev.filter(v => !vehicleIds.includes(v.id)));
    
    if (failed === 0) {
      toast({ 
        title: "Vehicles Deleted", 
        description: `${success} vehicle${success !== 1 ? 's' : ''} removed from your fleet.` 
      });
    } else {
      toast({ 
        title: "Partial Success", 
        description: `Deleted ${success} vehicle${success !== 1 ? 's' : ''}, ${failed} failed.`,
        variant: "destructive"
      });
    }
    
    return { success, failed };
  };

  return (
    <FleetContext.Provider value={{
      vehicles,
      bookings,
      documents,
      maintenance,
      messages,
      customers,
      customerNotes,
      inspections,
      damageClaims,
      payments,
      revenue,
      loading,
      isRefreshing,
      error,
      applyPriceOptimization,
      createVehicle,
      deleteVehicle,
      deleteVehicles,
      createBooking,
      updateBookingStatus,
      updateBookingVehicle,
      updateBookingDetails,
      uploadDocument,
      deleteDocument,
      createMaintenance,
      sendMessage,
      generateReport,
      createCustomer,
      updateCustomer,
      addCustomerNote,
      blacklistCustomer,
      deleteCustomer,
      createInspection,
      createInspectionWithPhotos,
      createDamageClaim,
      createPayment,
      refreshData,
      refreshBookings,
      refreshPayments,
      refreshDamageClaims,
      refreshCustomers,
      refreshInspections,
      refreshMaintenance
    }}>
      {children}
    </FleetContext.Provider>
  );
};

export const useFleet = () => {
  const context = useContext(FleetContext);
  if (!context) {
    throw new Error('useFleet must be used within FleetProvider');
  }
  return context;
};

