import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
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

  const refreshData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (vehiclesError) throw vehiclesError;
      setVehicles(vehiclesData || []);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);

      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false});

      if (documentsError) throw documentsError;
      setDocuments(documentsData || []);

      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from('maintenance_schedules')
        .select('*')
        .eq('user_id', user.id)
        .order('scheduled_date', { ascending: true });

      if (maintenanceError) throw maintenanceError;
      setMaintenance(maintenanceData || []);

      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;
      setMessages(messagesData || []);

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (customersError) throw customersError;
      setCustomers(customersData || []);

      const { data: notesData, error: notesError } = await supabase
        .from('customer_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;
      setCustomerNotes(notesData || []);

      const { data: inspectionsData, error: inspectionsError } = await supabase
        .from('vehicle_inspections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (inspectionsError) throw inspectionsError;
      setInspections(inspectionsData || []);

      const { data: claimsData, error: claimsError } = await supabase
        .from('damage_claims')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (claimsError) throw claimsError;
      setDamageClaims(claimsData || []);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;
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

      setRevenue({
        today: todayRevenue,
        month: monthRevenue,
        change: 12
      });

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Error Loading Data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [user]);

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

      const { error } = await supabase
        .from('vehicles')
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

      const { error } = await supabase
        .from('bookings')
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

    const { error } = await supabase
      .from('maintenance_schedules')
      .insert({
        ...maintenance,
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

      const { error } = await supabase
        .from('customers')
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

    const { error } = await supabase
      .from('vehicle_inspections')
      .insert({
        ...inspection,
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
    const { data: inspectionData, error: inspectionError } = await supabase
      .from('vehicle_inspections')
      .insert({
        ...inspection,
        user_id: user.id
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

      const { error } = await supabase
        .from('damage_claims')
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

      const { error } = await supabase
        .from('payments')
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
    supabase
      .from('bookings')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
      .then(({ data }) => setBookings(data || []));
  }, [user]);

  const refreshPayments = useCallback(() => {
    if (!user) return;
    supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPayments(data || []));
  }, [user]);

  const refreshDamageClaims = useCallback(() => {
    if (!user) return;
    supabase
      .from('damage_claims')
      .select('*')
      .eq('user_id', user.id)
      .order('reported_date', { ascending: false })
      .then(({ data }) => setDamageClaims(data || []));
  }, [user]);

  const refreshCustomers = useCallback(() => {
    if (!user) return;
    supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setCustomers(data || []));
  }, [user]);

  // Realtime subscriptions - initialized once per user session
  const realtimeInitialized = useRef(false);
  
  useEffect(() => {
    if (!user || realtimeInitialized.current) return;
    
    realtimeInitialized.current = true;
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Initializing realtime subscriptions...');
    }
    
    const bookingsChannel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => refreshBookings())
      .subscribe();

    const paymentsChannel = supabase
      .channel('payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => refreshPayments())
      .subscribe();

    const damageClaimsChannel = supabase
      .channel('damage-claims-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'damage_claims' }, () => refreshDamageClaims())
      .subscribe();

    const customersChannel = supabase
      .channel('customers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => refreshCustomers())
      .subscribe();

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Realtime subscriptions active');
    }

    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 Cleaning up realtime subscriptions...');
      }
      realtimeInitialized.current = false;
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(damageClaimsChannel);
      supabase.removeChannel(customersChannel);
    };
  }, [user, refreshBookings, refreshPayments, refreshDamageClaims, refreshCustomers]);

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
