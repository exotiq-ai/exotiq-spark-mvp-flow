import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];
type Document = Database['public']['Tables']['documents']['Row'];

interface FleetContextType {
  vehicles: Vehicle[];
  bookings: Booking[];
  documents: Document[];
  revenue: { today: number; month: number; change: number };
  loading: boolean;
  applyPriceOptimization: (vehicleId: string, newRate: number) => Promise<void>;
  createBooking: (booking: Database['public']['Tables']['bookings']['Insert']) => Promise<void>;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => Promise<void>;
  uploadDocument: (document: Database['public']['Tables']['documents']['Insert']) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
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

  const createBooking = async (booking: Database['public']['Tables']['bookings']['Insert']) => {
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

  const uploadDocument = async (document: Database['public']['Tables']['documents']['Insert']) => {
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

  return (
    <FleetContext.Provider value={{
      vehicles,
      bookings,
      documents,
      revenue,
      loading,
      applyPriceOptimization,
      createBooking,
      updateBookingStatus,
      uploadDocument,
      deleteDocument,
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
