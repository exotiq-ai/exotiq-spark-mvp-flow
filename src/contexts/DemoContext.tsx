
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface DemoUser {
  id: string;
  name: string;
  role: string;
  avatar: string;
  fleetSize: number;
  location: string;
}

export interface DemoState {
  isDemo: boolean;
  user: DemoUser;
  persona: string;
  mockData: any;
}

interface DemoContextType {
  demoState: DemoState;
  setPersona: (persona: string) => void;
  resetDemoData: () => void;
  generateMockData: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const demoPersonas = {
  'fleet-owner': {
    id: 'demo-owner-1',
    name: 'Marcus Rodriguez',
    role: 'Fleet Owner',
    avatar: 'MR',
    fleetSize: 12,
    location: 'Miami, FL'
  },
  'operations-manager': {
    id: 'demo-ops-1',
    name: 'Sarah Chen',
    role: 'Operations Manager',
    avatar: 'SC',
    fleetSize: 25,
    location: 'Los Angeles, CA'
  },
  'business-owner': {
    id: 'demo-biz-1',
    name: 'James Mitchell',
    role: 'Business Owner',
    avatar: 'JM',
    fleetSize: 8,
    location: 'Dallas, TX'
  }
};

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [demoState, setDemoState] = useState<DemoState>({
    isDemo: true,
    user: demoPersonas['fleet-owner'],
    persona: 'fleet-owner',
    mockData: {}
  });

  const setPersona = (persona: string) => {
    const user = demoPersonas[persona as keyof typeof demoPersonas] || demoPersonas['fleet-owner'];
    setDemoState(prev => ({
      ...prev,
      user,
      persona
    }));
    generateMockData();
  };

  const generateMockData = () => {
    const mockData = {
      revenue: {
        daily: Math.floor(Math.random() * 2000) + 1000,
        weekly: Math.floor(Math.random() * 10000) + 8000,
        monthly: Math.floor(Math.random() * 40000) + 30000
      },
      bookings: {
        active: Math.floor(Math.random() * 20) + 5,
        pending: Math.floor(Math.random() * 8) + 2,
        completed: Math.floor(Math.random() * 50) + 20
      },
      fleet: {
        utilization: Math.floor(Math.random() * 30) + 65,
        available: Math.floor(Math.random() * 8) + 3,
        maintenance: Math.floor(Math.random() * 3) + 1
      },
      lastUpdated: new Date().toISOString()
    };

    setDemoState(prev => ({
      ...prev,
      mockData
    }));
  };

  const resetDemoData = () => {
    generateMockData();
  };

  useEffect(() => {
    generateMockData();
  }, []);

  return (
    <DemoContext.Provider value={{
      demoState,
      setPersona,
      resetDemoData,
      generateMockData
    }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};
