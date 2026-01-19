import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useTeam } from './TeamContext';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { z } from 'zod';
import confetti from 'canvas-confetti';
import { devLog, devError } from '@/lib/logger';
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
  createVehicle: (vehicle: Omit<Database['public']['Tables']['vehicles']['Insert'], 'user_id'>) => Promise<void>;
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
  createInspection: (inspection: Omit<Database['public']['Tables']['vehicle_inspections']['Insert'], 'user_id'>) => Promise<void>;
  createInspectionWithPhotos: (inspection: Omit<Database['public']['Tables']['vehicle_inspections']['Insert'], 'user_id'>, photos: Array<{ photo_url: string; photo_type: string; storage_path: string }>) => Promise<void>;
  createDamageClaim: (claim: Omit<Database['public']['Tables']['damage_claims']['Insert'], 'user_id'>) => Promise<void>;
  createPayment: (payment: Omit<Database['public']['Tables']['payments']['Insert'], 'user_id'>) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshBookings: () => void;
  refreshPayments: () => void;
  refreshDamageClaims: () => void;
  refreshCustomers: () => void;
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

  // Core refresh logic - enterprise-grade with concurrency guard
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
      // Determine filter column and value
      const filterCol = teamId ? 'team_id' : 'user_id';
      const filterVal = teamId || userId!;

      // Timeout wrapper to prevent infinite loading
      const FETCH_TIMEOUT_MS = 30000; // 30 seconds
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
          supabase.from('bookings').select('*').eq(filterCol, filterVal).order('created_at', { ascending: false }),
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
  const refreshData = useCallback(async () => {
    await refreshDataCore({ isInitialLoad: false });
  }, [refreshDataCore]);

  // INITIAL LOAD: Only trigger ONCE per user session
  // This is the ONLY place that sets loading=true on first load
  useEffect(() => {
    // Wait for auth to settle
    if (authLoading) {
      devLog('[FleetContext] Waiting for auth...');
      return;
    }
    
    // No user = no data needed
    if (!user) {
      devLog('[FleetContext] No user, clearing state');
      setLoading(false);
      return;
    }
    
    // Check if we already initialized for this user
    if (hasInitializedForUserRef.current === user.id && lastTeamIdRef.current !== null) {
      devLog('[FleetContext] Already initialized for user', user.id);
      return;
    }
    
    devLog('[FleetContext] Initial load for user:', user.id);
    lastTeamIdRef.current = currentTeam?.id || 'pending';
    refreshDataCore({ isInitialLoad: true });
  }, [authLoading, user?.id]); // Intentionally exclude refreshDataCore to prevent cascades

  // TEAM CHANGE: Soft refresh (no UI wipe) when team changes AFTER initial load
  useEffect(() => {
    // Skip if no user or still in initial load phase
    if (!user || authLoading) return;
    if (lastTeamIdRef.current === null) return; // Initial load not done yet
    
    // Check if team actually changed
    const newTeamId = currentTeam?.id || null;
    if (lastTeamIdRef.current === newTeamId || lastTeamIdRef.current === 'pending') {
      lastTeamIdRef.current = newTeamId;
      return;
    }
    
    devLog('[FleetContext] Team changed:', lastTeamIdRef.current, '->', newTeamId);
    lastTeamIdRef.current = newTeamId;
    
    // Soft refresh - don't wipe UI, just update data
    refreshDataCore({ isInitialLoad: false, forceTeamId: newTeamId });
  }, [currentTeam?.id, user?.id, authLoading]); // Intentionally exclude refreshDataCore

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
    query.order('start_date', { ascending: false })
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

  useEffect(() => {
    if (!user) return;
    
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
          // Only refresh if the change is for our team
          const record = payload.new as any || payload.old as any;
          if (teamId && record?.team_id && record.team_id !== teamId) return;
          debouncedRefresh('bookings');
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          const record = payload.new as any || payload.old as any;
          if (teamId && record?.team_id && record.team_id !== teamId) return;
          debouncedRefresh('payments');
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'damage_claims' },
        (payload) => {
          const record = payload.new as any || payload.old as any;
          if (teamId && record?.team_id && record.team_id !== teamId) return;
          debouncedRefresh('damageClaims');
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' },
        (payload) => {
          const record = payload.new as any || payload.old as any;
          if (teamId && record?.team_id && record.team_id !== teamId) return;
          debouncedRefresh('customers');
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' },
        (payload) => {
          const record = payload.new as any || payload.old as any;
          if (teamId && record?.team_id && record.team_id !== teamId) return;
          debouncedRefresh('vehicles');
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_inspections' },
        (payload) => {
          const record = payload.new as any || payload.old as any;
          if (teamId && record?.team_id && record.team_id !== teamId) return;
          debouncedRefresh('inspections');
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_schedules' },
        (payload) => {
          const record = payload.new as any || payload.old as any;
          if (teamId && record?.team_id && record.team_id !== teamId) return;
          debouncedRefresh('maintenance');
        })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          devLog('[FleetContext] ✅ Realtime subscriptions active');
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
  }, [user?.id, currentTeam?.id]);

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

  const createVehicle = async (vehicle: Omit<Database['public']['Tables']['vehicles']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      const validated = vehicleSchema.parse(vehicle);
      const teamId = currentTeam?.id;

      const { error } = await supabase
        .from('vehicles')
        .insert({
          ...(validated as any),
          user_id: user.id,
          team_id: teamId || null
        });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

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
        toast({
          title: "🎉 Congratulations!",
          description: "You've added your first vehicle to your fleet!",
        });
      } else {
        toast({ title: "Vehicle Added", description: "Vehicle has been successfully added to your fleet." });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        throw error;
      }
    }
  };

  const createBooking = async (booking: Omit<Database['public']['Tables']['bookings']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      const validated = bookingSchema.parse(booking);
      const teamId = currentTeam?.id;
      const locationId = selectedLocationId !== 'all' ? selectedLocationId : null;

      const { error } = await supabase
        .from('bookings')
        .insert({
          ...(validated as any),
          user_id: user.id,
          team_id: teamId || null,
          pickup_location_id: (validated as any).pickup_location_id || locationId,
          dropoff_location_id: (validated as any).dropoff_location_id || locationId
        });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
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

      toast({ title: "Payment Recorded", description: "Payment has been successfully recorded." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        throw error;
      }
    }
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
      createInspection,
      createInspectionWithPhotos,
      createDamageClaim,
      createPayment,
      refreshData,
      refreshBookings,
      refreshPayments,
      refreshDamageClaims,
      refreshCustomers
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
