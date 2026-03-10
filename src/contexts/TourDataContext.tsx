import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { devLog, devError } from '@/lib/logger';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];

export interface DemoSnapshot {
  vehicles: Vehicle[];
  bookings: Booking[];
  customers: Customer[];
  payments: Payment[];
  revenue: { today: number; month: number; change: number };
  metrics: {
    utilization: number;
    avgDailyRate: number;
    activeBookings: number;
    totalVehicles: number;
  };
}

interface TourDataContextType {
  tourActive: boolean;
  demoSnapshot: DemoSnapshot | null;
  isLoading: boolean;
  activateTour: () => Promise<boolean>;
  deactivateTour: () => void;
  showPostTourModal: boolean;
  setShowPostTourModal: (show: boolean) => void;
}

const TourDataContext = createContext<TourDataContextType | undefined>(undefined);

export const TourDataProvider = ({ children }: { children: ReactNode }) => {
  const [tourActive, setTourActive] = useState(false);
  const [demoSnapshot, setDemoSnapshot] = useState<DemoSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPostTourModal, setShowPostTourModal] = useState(false);

  const activateTour = useCallback(async (): Promise<boolean> => {
    if (demoSnapshot) {
      // Already fetched, just activate
      setTourActive(true);
      return true;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No auth session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-data-snapshot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error(`Snapshot fetch failed: ${response.status}`);

      const snapshot = await response.json();
      devLog('[TourData] Snapshot loaded:', snapshot.vehicles?.length, 'vehicles');
      setDemoSnapshot(snapshot);
      setTourActive(true);
      return true;
    } catch (err) {
      devError('[TourData] Failed to fetch demo snapshot:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [demoSnapshot]);

  const deactivateTour = useCallback(() => {
    setTourActive(false);
    setShowPostTourModal(true);
  }, []);

  return (
    <TourDataContext.Provider
      value={{
        tourActive,
        demoSnapshot,
        isLoading,
        activateTour,
        deactivateTour,
        showPostTourModal,
        setShowPostTourModal,
      }}
    >
      {children}
    </TourDataContext.Provider>
  );
};

export const useTourData = () => {
  const context = useContext(TourDataContext);
  if (!context) {
    throw new Error('useTourData must be used within a TourDataProvider');
  }
  return context;
};
