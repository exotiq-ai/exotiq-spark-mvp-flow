import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useTeam } from './TeamContext';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { z } from 'zod';
import confetti from 'canvas-confetti';
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
  error: string | null; // New: expose error state for UI recovery
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // New: track error state
  
  // Use request token pattern instead of boolean guard to handle race conditions
  const refreshSeqRef = useRef(0);
  const lastUserIdRef = useRef<string | null>(null);
  const lastTeamIdRef = useRef<string | null>(null);
  
  const [revenue, setRevenue] = useState({
    today: 0,
    month: 0,
    change: 0
  });

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

  // Helper to get team_id filter - use currentTeam if available, otherwise user_id
  const getTeamId = useCallback(() => currentTeam?.id, [currentTeam]);
  const getUserId = useCallback(() => user?.id, [user]);

  // CRITICAL: Reset state immediately when user or team changes to prevent stale data
  useEffect(() => {
    const userChanged = user?.id !== lastUserIdRef.current;
    const teamChanged = currentTeam?.id !== lastTeamIdRef.current;
    
    if (userChanged || teamChanged) {
      console.log('[FleetContext] User/Team changed:', 
        'user:', lastUserIdRef.current, '->', user?.id,
        'team:', lastTeamIdRef.current, '->', currentTeam?.id
      );
      lastUserIdRef.current = user?.id || null;
      lastTeamIdRef.current = currentTeam?.id || null;
      
      // Immediately reset all data arrays to prevent showing old user's data
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
    }
  }, [user?.id, currentTeam?.id]);

  // Timeout helper to prevent infinite loading states
  const withTimeout = async <T,>(
    queryPromise: PromiseLike<T>, 
    ms: number, 
    label: string
  ): Promise<T> => {
    return Promise.race([
      Promise.resolve(queryPromise),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms)
      )
    ]);
  };

  const QUERY_TIMEOUT = 15000; // 15 seconds per query
  const MAX_RETRIES = 2; // Retry failed queries up to 2 times

  // Retry wrapper for resilient data fetching
  const fetchWithRetry = async <T,>(
    queryFn: () => PromiseLike<T>,
    label: string,
    maxRetries = MAX_RETRIES
  ): Promise<T> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await withTimeout(queryFn(), QUERY_TIMEOUT, label);
      } catch (err) {
        if (attempt === maxRetries) throw err;
        console.log(`[FleetContext] ${label} attempt ${attempt} failed, retrying in 1s...`);
        await new Promise(r => setTimeout(r, 1000)); // 1s delay between retries
      }
    }
    throw new Error(`Failed after ${maxRetries} attempts`);
  };

  const refreshData = useCallback(async () => {
    // Increment sequence to mark this as the "latest" request
    const seq = ++refreshSeqRef.current;
    console.log('[FleetContext] Refresh started, seq:', seq, 'userId:', user?.id, 'teamId:', currentTeam?.id, 'authLoading:', authLoading);
    
    // CRITICAL: Don't fetch if auth is still loading
    if (authLoading) {
      console.log('[FleetContext] Auth still loading, waiting...');
      return;
    }
    
    if (!user) {
      setLoading(false);
      setError(null);
      return;
    }
    
    // If user exists but no team yet, that's okay - we can still fetch user-level data
    // The team may still be loading or user may not have a team
    
    setLoading(true);
    setError(null); // Clear any previous error
    try {
      const teamId = getTeamId();
      const userId = getUserId();
      
      // Build vehicle query - filter by team_id if available, otherwise user_id
      // Use fetchWithRetry for resilience against transient failures
      const vehiclesResult = await fetchWithRetry(async () => {
        let vehicleQuery = supabase.from('vehicles').select('*');
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        } else {
          vehicleQuery = vehicleQuery.eq('user_id', userId!);
        }
        return vehicleQuery.order('created_at', { ascending: false });
      }, 'vehicles');
      
      if (vehiclesResult.error) throw vehiclesResult.error;
      const vehiclesData = vehiclesResult.data;
      
      // Check if this request is still the latest (race condition guard)
      if (seq !== refreshSeqRef.current) {
        console.log('[FleetContext] Stale refresh abandoned after vehicles query');
        return;
      }
      setVehicles(vehiclesData || []);

      // Build bookings query
      let bookingsQuery = supabase.from('bookings').select('*');
      if (teamId) {
        bookingsQuery = bookingsQuery.eq('team_id', teamId);
      } else {
        bookingsQuery = bookingsQuery.eq('user_id', userId!);
      }
      const { data: bookingsData, error: bookingsError } = await withTimeout(
        bookingsQuery.order('created_at', { ascending: false }),
        QUERY_TIMEOUT,
        'bookings'
      );
      if (bookingsError) throw bookingsError;
      if (seq !== refreshSeqRef.current) return;
      setBookings(bookingsData || []);

      // Build documents query
      let documentsQuery = supabase.from('documents').select('*');
      if (teamId) {
        documentsQuery = documentsQuery.eq('team_id', teamId);
      } else {
        documentsQuery = documentsQuery.eq('user_id', userId!);
      }
      const { data: documentsData, error: documentsError } = await withTimeout(
        documentsQuery.order('created_at', { ascending: false }),
        QUERY_TIMEOUT,
        'documents'
      );
      if (documentsError) throw documentsError;
      if (seq !== refreshSeqRef.current) return;
      setDocuments(documentsData || []);

      // Build maintenance query
      let maintenanceQuery = supabase.from('maintenance_schedules').select('*');
      if (teamId) {
        maintenanceQuery = maintenanceQuery.eq('team_id', teamId);
      } else {
        maintenanceQuery = maintenanceQuery.eq('user_id', userId!);
      }
      const { data: maintenanceData, error: maintenanceError } = await withTimeout(
        maintenanceQuery.order('scheduled_date', { ascending: true }),
        QUERY_TIMEOUT,
        'maintenance'
      );
      if (maintenanceError) throw maintenanceError;
      if (seq !== refreshSeqRef.current) return;
      setMaintenance(maintenanceData || []);

      // Build messages query (user-specific, not team-wide)
      const { data: messagesData, error: messagesError } = await withTimeout(
        supabase
          .from('messages')
          .select('*')
          .eq('user_id', userId!)
          .order('created_at', { ascending: false }),
        QUERY_TIMEOUT,
        'messages'
      );
      if (messagesError) throw messagesError;
      if (seq !== refreshSeqRef.current) return;
      setMessages(messagesData || []);

      // Build customers query
      let customersQuery = supabase.from('customers').select('*');
      if (teamId) {
        customersQuery = customersQuery.eq('team_id', teamId);
      } else {
        customersQuery = customersQuery.eq('user_id', userId!);
      }
      const { data: customersData, error: customersError } = await withTimeout(
        customersQuery.order('created_at', { ascending: false }),
        QUERY_TIMEOUT,
        'customers'
      );
      if (customersError) throw customersError;
      if (seq !== refreshSeqRef.current) return;
      setCustomers(customersData || []);

      // Build customer notes query - team-based via customer relationship
      const customerIds = customersData?.map(c => c.id) || [];
      let notesData: CustomerNote[] = [];
      if (customerIds.length > 0) {
        const { data, error: notesError } = await withTimeout(
          supabase
            .from('customer_notes')
            .select('*')
            .in('customer_id', customerIds)
            .order('created_at', { ascending: false }),
          QUERY_TIMEOUT,
          'customer_notes'
        );
        if (notesError) throw notesError;
        notesData = data || [];
      }
      if (seq !== refreshSeqRef.current) return;
      setCustomerNotes(notesData);

      // Build inspections query - team-based
      let inspectionsQuery = supabase.from('vehicle_inspections').select('*');
      if (teamId) {
        inspectionsQuery = inspectionsQuery.eq('team_id', teamId);
      } else {
        inspectionsQuery = inspectionsQuery.eq('user_id', userId!);
      }
      const { data: inspectionsData, error: inspectionsError } = await withTimeout(
        inspectionsQuery.order('created_at', { ascending: false }),
        QUERY_TIMEOUT,
        'inspections'
      );
      if (inspectionsError) throw inspectionsError;
      if (seq !== refreshSeqRef.current) return;
      setInspections(inspectionsData || []);

      // Build damage claims query
      let claimsQuery = supabase.from('damage_claims').select('*');
      if (teamId) {
        claimsQuery = claimsQuery.eq('team_id', teamId);
      } else {
        claimsQuery = claimsQuery.eq('user_id', userId!);
      }
      const { data: claimsData, error: claimsError } = await withTimeout(
        claimsQuery.order('created_at', { ascending: false }),
        QUERY_TIMEOUT,
        'damage_claims'
      );
      if (claimsError) throw claimsError;
      if (seq !== refreshSeqRef.current) return;
      setDamageClaims(claimsData || []);

      // Build payments query
      let paymentsQuery = supabase.from('payments').select('*');
      if (teamId) {
        paymentsQuery = paymentsQuery.eq('team_id', teamId);
      } else {
        paymentsQuery = paymentsQuery.eq('user_id', userId!);
      }
      const { data: paymentsData, error: paymentsError } = await withTimeout(
        paymentsQuery.order('created_at', { ascending: false }),
        QUERY_TIMEOUT,
        'payments'
      );
      if (paymentsError) throw paymentsError;
      if (seq !== refreshSeqRef.current) return;
      setPayments(paymentsData || []);

      // Calculate revenue
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const confirmedBookings = bookingsData?.filter(b => b.status === 'confirmed' || b.status === 'completed') || [];
      const todayRevenue = confirmedBookings
        .filter(b => new Date(b.start_date) >= today)
        .reduce((sum, b) => sum + parseFloat(b.total_value?.toString() || '0'), 0);
      
      const monthRevenue = confirmedBookings
        .reduce((sum, b) => sum + parseFloat(b.total_value?.toString() || '0'), 0);

      // Final staleness check before setting revenue
      if (seq !== refreshSeqRef.current) {
        console.log('[FleetContext] Stale refresh abandoned at revenue step');
        return;
      }

      setRevenue({
        today: todayRevenue,
        month: monthRevenue,
        change: 12
      });
      
      console.log('[FleetContext] Refresh complete, seq:', seq, 'vehicles:', vehiclesData?.length || 0);

    } catch (err: any) {
      // Only set error if this is still the latest request
      if (seq === refreshSeqRef.current) {
        const errorMessage = err.message || 'Failed to load data';
        console.error('[FleetContext] Error loading data:', err);
        setError(errorMessage); // Store error for UI to display
        toast({
          title: "Error Loading Data",
          description: errorMessage,
          variant: "destructive"
        });
        setLoading(false);
      }
      return;
    }
    
    // Only update loading state if this is still the latest request
    if (seq === refreshSeqRef.current) {
      setLoading(false);
    }
  }, [user, currentTeam?.id, getTeamId, getUserId, toast]);

  // Refresh when user or team changes
  // CRITICAL: Only trigger when auth is DONE and we have definitive user state
  useEffect(() => {
    // Wait for auth to be completely done loading
    if (authLoading) {
      console.log('[FleetContext] Waiting for auth to complete...');
      return;
    }
    // Auth is done - if no user, don't fetch
    if (!user) {
      console.log('[FleetContext] No user after auth complete, clearing loading state');
      setLoading(false);
      return;
    }
    // Auth done + user exists = safe to fetch
    console.log('[FleetContext] Auth complete with user, fetching fleet data...');
    refreshData();
  }, [authLoading, user?.id, currentTeam?.id, refreshData]);

  // Auto-recovery: refresh when tab becomes visible or network comes online
  useEffect(() => {
    if (!user || authLoading) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !loading) {
        console.log('[FleetContext] Tab visible, refreshing data...');
        refreshData();
      }
    };
    
    const handleOnline = () => {
      if (!loading) {
        console.log('[FleetContext] Network online, refreshing data...');
        refreshData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, authLoading, loading, refreshData]);

  const applyPriceOptimization = async (vehicleId: string, newRate: number) => {
    if (!user) return;

    const { error } = await supabase
      .from('vehicles')
      .update({ 
        current_rate: newRate,
        suggested_rate: null 
      })
      .eq('id', vehicleId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    const vehicle = vehicles.find(v => v.id === vehicleId);
    toast({
      title: "Price Updated Successfully",
      description: `${vehicle?.name} rate updated to $${newRate}/day`,
    });
  };

  const createVehicle = async (vehicle: Omit<Database['public']['Tables']['vehicles']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      // Validate input
      const validated = vehicleSchema.parse(vehicle);
      const teamId = getTeamId();

      const { error } = await supabase
        .from('vehicles')
        .insert({
          ...(validated as any),
          user_id: user.id,
          team_id: teamId || null
        });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      await refreshData();
      
      // Check if this is the first vehicle
      const isFirstVehicle = vehicles.length === 0;
      
      if (isFirstVehicle) {
        // Fire confetti for first vehicle milestone
        const duration = 2000;
        const animationEnd = Date.now() + duration;
        
        const randomInRange = (min: number, max: number) => {
          return Math.random() * (max - min) + min;
        };

        const colors = ['#0B3D91', '#FF6B35', '#FFD700']; // Gulf Blue, Performance Orange, Gold

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }

          confetti({
            particleCount: 2,
            angle: randomInRange(55, 125),
            spread: randomInRange(50, 70),
            origin: { y: 0.6 },
            colors,
          });
        }, 50);

        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([50, 30, 50]);
        }

        toast({
          title: "🚗 First Vehicle Added!",
          description: "Great start! Your fleet is taking shape. Add more vehicles to maximize your revenue.",
          duration: 5000,
        });
      } else {
        toast({
          title: "Vehicle Added",
          description: "New vehicle has been added to your fleet.",
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive"
        });
      } else {
        throw error;
      }
    }
  };

  const createBooking = async (booking: Omit<Database['public']['Tables']['bookings']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      // Validate input
      const validated = bookingSchema.parse(booking);
      const teamId = getTeamId();

      // Auto-create customer if email is provided and customer doesn't exist
      let customerId: string | null = null;
      if (booking.customer_email && booking.customer_name) {
        // Check if customer already exists by email
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', booking.customer_email)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          // Create new customer from booking details
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              user_id: user.id,
              team_id: teamId || null,
              full_name: booking.customer_name,
              email: booking.customer_email,
              phone: booking.customer_phone || null,
            })
            .select('id')
            .single();

          if (!customerError && newCustomer) {
            customerId = newCustomer.id;
            toast({
              title: "Customer Added",
              description: `${booking.customer_name} has been added to your CRM.`,
            });
          }
        }
      }

      const { error } = await supabase
        .from('bookings')
        .insert({
          ...(validated as any),
          user_id: user.id,
          team_id: teamId || null,
          customer_id: customerId,
        });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      await refreshData();
      
      // Check if this is the first booking
      const isFirstBooking = bookings.length === 0;
      
      if (isFirstBooking) {
        // Fire confetti for first booking milestone
        const duration = 2000;
        const animationEnd = Date.now() + duration;
        
        const randomInRange = (min: number, max: number) => {
          return Math.random() * (max - min) + min;
        };

        const colors = ['#0B3D91', '#FF6B35', '#FFD700']; // Gulf Blue, Performance Orange, Gold

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }

          confetti({
            particleCount: 2,
            angle: randomInRange(55, 125),
            spread: randomInRange(50, 70),
            origin: { y: 0.6 },
            colors,
          });
        }, 50);

        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([50, 30, 50]);
        }

        toast({
          title: "🎉 First Booking Created!",
          description: "Congratulations on your first booking! Your fleet is now generating revenue.",
          duration: 5000,
        });
      } else {
        toast({
          title: "Booking Created",
          description: "New booking has been created successfully.",
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive"
        });
      } else {
        throw error;
      }
    }
  };

  const updateBookingStatus = async (bookingId: string, status: Booking['status']) => {
    if (!user) return;

    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    toast({
      title: "Booking Updated",
      description: `Booking status changed to ${status}.`,
    });
  };

  const updateBookingVehicle = async (bookingId: string, newVehicleId: string) => {
    if (!user) return;

    const vehicle = vehicles.find(v => v.id === newVehicleId);
    const { error } = await supabase
      .from('bookings')
      .update({ vehicle_id: newVehicleId })
      .eq('id', bookingId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    toast({
      title: "Vehicle Changed",
      description: `Booking updated to ${vehicle?.name || 'new vehicle'}.`,
    });
  };

  const updateBookingDetails = async (bookingId: string, updates: Partial<Booking>) => {
    if (!user) return;

    const { error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    toast({
      title: "Booking Updated",
      description: "Booking details have been updated.",
    });
  };

  const uploadDocument = async (document: Omit<Database['public']['Tables']['documents']['Insert'], 'user_id'>) => {
    if (!user) return;

    const { error } = await supabase
      .from('documents')
      .insert({
        ...document,
        user_id: user.id
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    toast({
      title: "Document Uploaded",
      description: `${document.name} has been uploaded successfully.`,
    });
  };

  const deleteDocument = async (documentId: string) => {
    if (!user) return;

    const { error} = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    toast({
      title: "Document Deleted",
      description: "Document has been removed from your vault.",
    });
  };

  const createMaintenance = async (maintenance: Omit<Database['public']['Tables']['maintenance_schedules']['Insert'], 'user_id'>) => {
    if (!user) return;
    const teamId = getTeamId();

    const { error } = await supabase
      .from('maintenance_schedules')
      .insert({
        ...maintenance,
        user_id: user.id,
        team_id: teamId || null
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    toast({
      title: "Maintenance Scheduled",
      description: "Maintenance has been scheduled successfully.",
    });
  };

  const sendMessage = async (message: Omit<Database['public']['Tables']['messages']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      // Validate input
      const validated = messageSchema.parse(message);

      const { error } = await supabase
        .from('messages')
        .insert({
          ...(validated as any),
          user_id: user.id
        });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      await refreshData();
      
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive"
        });
      } else {
        throw error;
      }
    }
  };

  const generateReport = async (reportType: string, dateRange: { start: string; end: string }, format: string) => {
    toast({
      title: "Generating Report",
      description: `Your ${reportType} report is being generated...`,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: "Report Generated",
      description: `Your ${reportType} report (${format}) is ready for download.`,
    });
  };

  const createCustomer = async (customer: Omit<Database['public']['Tables']['customers']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      // Validate input
      const validated = customerSchema.parse(customer);
      const teamId = getTeamId();

      const { error } = await supabase
        .from('customers')
        .insert({
          ...(validated as any),
          user_id: user.id,
          team_id: teamId || null
        });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      await refreshData();
      
      toast({
        title: "Customer Added",
        description: "New customer has been added to your CRM.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive"
        });
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
      .eq('id', customerId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    toast({
      title: "Customer Updated",
      description: "Customer information has been updated.",
    });
  };

  const addCustomerNote = async (customerId: string, note: string, createdBy: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('customer_notes')
      .insert({
        customer_id: customerId,
        user_id: user.id,
        note,
        created_by: createdBy
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    toast({
      title: "Note Added",
      description: "Note has been added to customer profile.",
    });
  };

  const blacklistCustomer = async (customerId: string, reason: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('customers')
      .update({
        customer_status: 'blacklisted',
        blacklist_reason: reason
      })
      .eq('id', customerId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    toast({
      title: "Customer Blacklisted",
      description: "Customer has been blacklisted.",
      variant: "destructive"
    });
  };

  const createInspection = async (inspection: Omit<Database['public']['Tables']['vehicle_inspections']['Insert'], 'user_id'>) => {
    if (!user) return;

    const teamId = getTeamId();
    const { error } = await supabase
      .from('vehicle_inspections')
      .insert({
        ...inspection,
        user_id: user.id,
        team_id: teamId || null
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    await refreshData();
    
    toast({
      title: "Inspection Logged",
      description: "Vehicle inspection has been recorded.",
    });
  };

  const createInspectionWithPhotos = async (
    inspection: Omit<Database['public']['Tables']['vehicle_inspections']['Insert'], 'user_id'>,
    photos: Array<{ photo_url: string; photo_type: string; storage_path: string }>
  ) => {
    if (!user) return;

    // Create inspection first
    const teamId = getTeamId();
    const { data: inspectionData, error: inspectionError } = await supabase
      .from('vehicle_inspections')
      .insert({
        ...inspection,
        user_id: user.id,
        team_id: teamId || null
      })
      .select('id')
      .single();

    if (inspectionError || !inspectionData) {
      toast({
        title: "Error",
        description: inspectionError?.message || "Failed to create inspection",
        variant: "destructive"
      });
      return;
    }

    // Insert photos if any
    if (photos.length > 0) {
      const photoRecords = photos.map(photo => ({
        inspection_id: inspectionData.id,
        photo_url: photo.photo_url,
        photo_type: photo.photo_type,
      }));

      const { error: photoError } = await supabase
        .from('inspection_photos')
        .insert(photoRecords);

      if (photoError) {
        console.error('Failed to save photos:', photoError);
        toast({
          title: "Warning",
          description: "Inspection saved but some photos failed to link.",
          variant: "destructive"
        });
      }
    }

    await refreshData();
    
    toast({
      title: "Inspection Complete",
      description: `Inspection logged with ${photos.length} photo(s).`,
    });
  };

  const createDamageClaim = async (claim: Omit<Database['public']['Tables']['damage_claims']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      // Validate input
      const validated = damageClaimSchema.parse(claim);
      const teamId = getTeamId();

      const { error } = await supabase
        .from('damage_claims')
        .insert({
          ...(validated as any),
          user_id: user.id,
          team_id: teamId || null
        });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      await refreshData();
      
      toast({
        title: "Damage Claim Created",
        description: "Damage claim has been filed.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive"
        });
      } else {
        throw error;
      }
    }
  };

  const createPayment = async (payment: Omit<Database['public']['Tables']['payments']['Insert'], 'user_id'>) => {
    if (!user) return;

    try {
      const validated = paymentSchema.parse(payment);
      const teamId = getTeamId();

      const { error } = await supabase
        .from('payments')
        .insert({
          ...(validated as any),
          user_id: user.id,
          team_id: teamId || null
        });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      await refreshData();
      
      toast({
        title: "Payment Recorded",
        description: "Payment has been successfully recorded.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive"
        });
      } else {
        throw error;
      }
    }
  };

  // Memoized individual refresh methods for real-time updates (prevents infinite loops)
  const refreshBookings = useCallback(() => {
    if (!user) return;
    const teamId = currentTeam?.id;
    
    let query = supabase.from('bookings').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', user.id);
    }
    query.order('start_date', { ascending: false })
      .then(({ data }) => setBookings(data || []));
  }, [user, currentTeam?.id]);

  const refreshPayments = useCallback(() => {
    if (!user) return;
    const teamId = currentTeam?.id;
    
    let query = supabase.from('payments').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', user.id);
    }
    query.order('created_at', { ascending: false })
      .then(({ data }) => setPayments(data || []));
  }, [user, currentTeam?.id]);

  const refreshDamageClaims = useCallback(() => {
    if (!user) return;
    const teamId = currentTeam?.id;
    
    let query = supabase.from('damage_claims').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', user.id);
    }
    query.order('reported_date', { ascending: false })
      .then(({ data }) => setDamageClaims(data || []));
  }, [user]);

  const refreshCustomers = useCallback(() => {
    if (!user) return;
    const teamId = currentTeam?.id;
    
    let query = supabase.from('customers').select('*');
    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', user.id);
    }
    query.order('created_at', { ascending: false })
      .then(({ data }) => setCustomers(data || []));
  }, [user, currentTeam?.id]);

  // Realtime subscriptions - keep a single set of channels per signed-in user.
  // IMPORTANT: Don't tie this effect to callback identities (they can change often and cause
  // repeated subscribe/unsubscribe loops).
  const realtimeInitialized = useRef(false);
  const realtimeUserId = useRef<string | null>(null);

  const bookingsChannelRef = useRef<any>(null);
  const paymentsChannelRef = useRef<any>(null);
  const damageClaimsChannelRef = useRef<any>(null);
  const customersChannelRef = useRef<any>(null);

  const refreshBookingsRef = useRef(refreshBookings);
  const refreshPaymentsRef = useRef(refreshPayments);
  const refreshDamageClaimsRef = useRef(refreshDamageClaims);
  const refreshCustomersRef = useRef(refreshCustomers);

  useEffect(() => {
    refreshBookingsRef.current = refreshBookings;
  }, [refreshBookings]);

  useEffect(() => {
    refreshPaymentsRef.current = refreshPayments;
  }, [refreshPayments]);

  useEffect(() => {
    refreshDamageClaimsRef.current = refreshDamageClaims;
  }, [refreshDamageClaims]);

  useEffect(() => {
    refreshCustomersRef.current = refreshCustomers;
  }, [refreshCustomers]);

  useEffect(() => {
    if (!user) return;

    // If already initialized for this user, do nothing.
    if (realtimeInitialized.current && realtimeUserId.current === user.id) return;

    const isDev = import.meta.env.DEV;

    const cleanup = () => {
      if (bookingsChannelRef.current) supabase.removeChannel(bookingsChannelRef.current);
      if (paymentsChannelRef.current) supabase.removeChannel(paymentsChannelRef.current);
      if (damageClaimsChannelRef.current) supabase.removeChannel(damageClaimsChannelRef.current);
      if (customersChannelRef.current) supabase.removeChannel(customersChannelRef.current);

      bookingsChannelRef.current = null;
      paymentsChannelRef.current = null;
      damageClaimsChannelRef.current = null;
      customersChannelRef.current = null;

      realtimeInitialized.current = false;
      realtimeUserId.current = null;
    };

    // If switching users, cleanup previous channels first.
    if (realtimeUserId.current && realtimeUserId.current !== user.id) {
      cleanup();
    }

    realtimeInitialized.current = true;
    realtimeUserId.current = user.id;

    if (isDev) console.log('🔄 Initializing realtime subscriptions...');

    bookingsChannelRef.current = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => refreshBookingsRef.current())
      .subscribe();

    paymentsChannelRef.current = supabase
      .channel('payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => refreshPaymentsRef.current())
      .subscribe();

    damageClaimsChannelRef.current = supabase
      .channel('damage-claims-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'damage_claims' }, () => refreshDamageClaimsRef.current())
      .subscribe();

    customersChannelRef.current = supabase
      .channel('customers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => refreshCustomersRef.current())
      .subscribe();

    if (isDev) console.log('✅ Realtime subscriptions active');

    // Cleanup only when user changes/unmounts (effect depends on user.id only)
    return () => {
      if (isDev) console.log('🔴 Cleaning up realtime subscriptions...');
      cleanup();
    };
  }, [user?.id]);

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
