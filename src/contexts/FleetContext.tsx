import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Vehicle {
  id: string;
  name: string;
  currentRate: number;
  suggestedRate?: number;
  utilization: number;
  revenue: number;
  status: 'available' | 'booked' | 'maintenance';
}

interface Booking {
  id: string;
  vehicle: string;
  customer: string;
  time: string;
  location: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  value: string;
  date?: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  uploaded: string;
  expires: string;
  status: 'active' | 'expiring' | 'expired';
}

interface FleetContextType {
  vehicles: Vehicle[];
  bookings: Booking[];
  documents: Document[];
  revenue: { today: number; month: number; change: number };
  applyPriceOptimization: (vehicleId: string, newRate: number) => void;
  createBooking: (booking: Omit<Booking, 'id'>) => void;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => void;
  uploadDocument: (document: Omit<Document, 'id' | 'uploaded'>) => void;
  deleteDocument: (documentId: string) => void;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

export const FleetProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  
  const [revenue, setRevenue] = useState({
    today: 3240,
    month: 24680,
    change: 12
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: 'v1',
      name: 'McLaren 720S',
      currentRate: 450,
      suggestedRate: 520,
      utilization: 82,
      revenue: 8400,
      status: 'booked'
    },
    {
      id: 'v2',
      name: 'Ferrari 488',
      currentRate: 520,
      suggestedRate: 595,
      utilization: 76,
      revenue: 7280,
      status: 'available'
    },
    {
      id: 'v3',
      name: 'Lamborghini Huracán',
      currentRate: 480,
      utilization: 89,
      revenue: 9120,
      status: 'booked'
    },
    {
      id: 'v4',
      name: 'Porsche 911 GT3',
      currentRate: 380,
      utilization: 71,
      revenue: 5320,
      status: 'available'
    }
  ]);

  const [bookings, setBookings] = useState<Booking[]>([
    {
      id: 'BK001',
      vehicle: 'McLaren 720S',
      customer: 'John Smith',
      time: '2:00 PM - 5:00 PM',
      location: 'Downtown',
      status: 'confirmed',
      value: '$450',
      date: 'Today'
    },
    {
      id: 'BK002',
      vehicle: 'Lamborghini Huracán',
      customer: 'Sarah Johnson',
      time: '6:00 PM - 11:59 PM',
      location: 'Airport',
      status: 'pending',
      value: '$520',
      date: 'Today'
    },
    {
      id: 'BK003',
      vehicle: 'Ferrari 488',
      customer: 'Mike Chen',
      time: '10:00 AM - 2:00 PM',
      location: 'Hotel Pickup',
      status: 'confirmed',
      value: '$680',
      date: 'Tomorrow'
    }
  ]);

  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 'DOC001',
      name: 'McLaren 720S Insurance Policy',
      type: 'Insurance',
      uploaded: '2 days ago',
      expires: 'Mar 15, 2025',
      status: 'active'
    },
    {
      id: 'DOC002',
      name: 'Driver License - John Smith',
      type: 'License',
      uploaded: '1 week ago',
      expires: 'Dec 22, 2024',
      status: 'expiring'
    },
    {
      id: 'DOC003',
      name: 'Vehicle Registration - Ferrari 488',
      type: 'Registration',
      uploaded: '3 weeks ago',
      expires: 'Jan 30, 2025',
      status: 'active'
    }
  ]);

  const applyPriceOptimization = (vehicleId: string, newRate: number) => {
    setVehicles(prev => prev.map(v => 
      v.id === vehicleId ? { ...v, currentRate: newRate, suggestedRate: undefined } : v
    ));
    
    const vehicle = vehicles.find(v => v.id === vehicleId);
    const increase = newRate - (vehicle?.currentRate || 0);
    const weeklyIncrease = increase * 7;
    
    setRevenue(prev => ({
      ...prev,
      month: prev.month + weeklyIncrease * 4,
      change: prev.change + 2
    }));

    toast({
      title: "Price Updated Successfully",
      description: `${vehicle?.name} rate increased to $${newRate}/day. Projected weekly revenue: +$${weeklyIncrease.toFixed(0)}`,
    });
  };

  const createBooking = (booking: Omit<Booking, 'id'>) => {
    const newBooking: Booking = {
      ...booking,
      id: `BK${String(bookings.length + 1).padStart(3, '0')}`,
    };
    
    setBookings(prev => [newBooking, ...prev]);
    
    toast({
      title: "Booking Created",
      description: `New booking for ${booking.vehicle} has been created successfully.`,
    });
  };

  const updateBookingStatus = (bookingId: string, status: Booking['status']) => {
    setBookings(prev => prev.map(b => 
      b.id === bookingId ? { ...b, status } : b
    ));
    
    const booking = bookings.find(b => b.id === bookingId);
    
    toast({
      title: "Booking Updated",
      description: `Booking ${bookingId} status changed to ${status}.`,
    });
  };

  const uploadDocument = (document: Omit<Document, 'id' | 'uploaded'>) => {
    const newDocument: Document = {
      ...document,
      id: `DOC${String(documents.length + 1).padStart(3, '0')}`,
      uploaded: 'Just now'
    };
    
    setDocuments(prev => [newDocument, ...prev]);
    
    toast({
      title: "Document Uploaded",
      description: `${document.name} has been uploaded successfully.`,
    });
  };

  const deleteDocument = (documentId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== documentId));
    
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
      applyPriceOptimization,
      createBooking,
      updateBookingStatus,
      uploadDocument,
      deleteDocument
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
