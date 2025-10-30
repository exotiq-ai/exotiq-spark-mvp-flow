import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];
type Document = Database['public']['Tables']['documents']['Row'];
type Maintenance = Database['public']['Tables']['maintenance_schedules']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

interface FleetContextType {
  vehicles: Vehicle[];
  bookings: Booking[];
  documents: Document[];
  maintenance: Maintenance[];
  messages: Message[];
  revenue: { today: number; month: number; change: number };
  loading: boolean;
  applyPriceOptimization: (vehicleId: string, newRate: number) => Promise<void>;
  createVehicle: (vehicle: Omit<Database['public']['Tables']['vehicles']['Insert'], 'user_id'>) => Promise<void>;
  createBooking: (booking: Omit<Database['public']['Tables']['bookings']['Insert'], 'user_id'>) => Promise<void>;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => Promise<void>;
  uploadDocument: (document: Omit<Database['public']['Tables']['documents']['Insert'], 'user_id'>) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  createMaintenance: (maintenance: Omit<Database['public']['Tables']['maintenance_schedules']['Insert'], 'user_id'>) => Promise<void>;
  sendMessage: (message: Omit<Database['public']['Tables']['messages']['Insert'], 'user_id'>) => Promise<void>;
  generateReport: (reportType: string, dateRange: { start: string; end: string }, format: string) => Promise<void>;
  refreshData: () => Promise<void>;
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

    const { error } = await supabase
      .from('vehicles')
      .insert({
        ...vehicle,
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
      title: "Vehicle Added",
      description: "New vehicle has been added to your fleet.",
    });
  };

  const createBooking = async (booking: Omit<Database['public']['Tables']['bookings']['Insert'], 'user_id'>) => {
    if (!user) return;

    const { error } = await supabase
      .from('bookings')
      .insert({
        ...booking,
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
      title: "Booking Created",
      description: "New booking has been created successfully.",
    });
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

    const { error } = await supabase
      .from('messages')
      .insert({
        ...message,
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
  };

  const generateReport = async (reportType: string, dateRange: { start: string; end: string }, format: string) => {
    // Simulate report generation
    toast({
      title: "Generating Report",
      description: `Your ${reportType} report is being generated...`,
    });

    // In a real app, this would call an edge function or generate the report
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: "Report Generated",
      description: `Your ${reportType} report (${format}) is ready for download.`,
    });
  };

  return (
    <FleetContext.Provider value={{
      vehicles,
      bookings,
      documents,
      maintenance,
      messages,
      revenue,
      loading,
      applyPriceOptimization,
      createVehicle,
      createBooking,
      updateBookingStatus,
      uploadDocument,
      deleteDocument,
      createMaintenance,
      sendMessage,
      generateReport,
      refreshData
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
