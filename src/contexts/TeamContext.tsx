import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/hooks/useUserRole';

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  slug: string | null;
  logo_url: string | null;
  timezone: string | null;
}

export interface Location {
  id: string;
  team_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  timezone: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface TeamContextType {
  // Current data
  currentTeam: Team | null;
  currentLocation: Location | null;
  locations: Location[];
  assignedLocationIds: string[];
  
  // Selected location (can be 'all' for owners/admins)
  selectedLocationId: string | 'all';
  
  // Role helpers
  userRole: AppRole | null;
  isOwner: boolean;
  isAdmin: boolean;
  canAccessAllLocations: boolean;
  canAccessLocation: (locationId: string) => boolean;
  
  // Actions
  switchLocation: (locationId: string | 'all') => void;
  refreshTeam: () => Promise<void>;
  
  // Loading state
  loading: boolean;
  error: string | null;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

const LOCATION_STORAGE_KEY = 'exotiq_selected_location';

export const TeamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assignedLocationIds, setAssignedLocationIds] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derived values
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const canAccessAllLocations = isOwner || isAdmin;

  // Get current location based on selection
  const currentLocation = useMemo(() => {
    if (selectedLocationId === 'all') {
      // Return default location when "All Locations" is selected
      return locations.find(l => l.is_default) || locations[0] || null;
    }
    return locations.find(l => l.id === selectedLocationId) || null;
  }, [selectedLocationId, locations]);

  // Check if user can access a specific location
  const canAccessLocation = useCallback((locationId: string): boolean => {
    if (canAccessAllLocations) return true;
    return assignedLocationIds.includes(locationId);
  }, [canAccessAllLocations, assignedLocationIds]);

  // Switch location
  const switchLocation = useCallback((locationId: string | 'all') => {
    setSelectedLocationId(locationId);
    localStorage.setItem(LOCATION_STORAGE_KEY, locationId);
  }, []);

  // Fetch team data
  const fetchTeamData = useCallback(async () => {
    if (!user?.id) {
      setCurrentTeam(null);
      setLocations([]);
      setAssignedLocationIds([]);
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch user's team membership
      const { data: teamMember, error: teamMemberError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (teamMemberError) {
        // User might not have a team yet
        console.log('No team membership found:', teamMemberError.message);
        setLoading(false);
        return;
      }

      setUserRole(teamMember.role as AppRole);

      // Fetch team details
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamMember.team_id)
        .eq('is_deleted', false)
        .single();

      if (teamError) throw teamError;
      setCurrentTeam(team);

      // Fetch all locations for this team
      const { data: teamLocations, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .eq('team_id', teamMember.team_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');

      if (locationsError) throw locationsError;
      setLocations(teamLocations || []);

      // Fetch user's assigned locations (for non-admin/owner users)
      const { data: staffLocations, error: staffError } = await supabase
        .from('location_staff')
        .select('location_id')
        .eq('user_id', user.id);

      if (staffError) throw staffError;
      setAssignedLocationIds((staffLocations || []).map(s => s.location_id));

      // Restore selected location from localStorage
      const storedLocation = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (storedLocation) {
        const isValidLocation = storedLocation === 'all' || 
          teamLocations?.some(l => l.id === storedLocation);
        if (isValidLocation) {
          setSelectedLocationId(storedLocation);
        } else {
          // Default to 'all' for owners/admins, or first assigned location
          const defaultSelection = teamMember.role === 'owner' || teamMember.role === 'admin' 
            ? 'all' 
            : (staffLocations?.[0]?.location_id || 'all');
          setSelectedLocationId(defaultSelection);
        }
      } else {
        // Default to 'all' for owners/admins
        if (teamMember.role === 'owner' || teamMember.role === 'admin') {
          setSelectedLocationId('all');
        }
      }

    } catch (err) {
      console.error('Error fetching team data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch team data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Refresh team data
  const refreshTeam = useCallback(async () => {
    await fetchTeamData();
  }, [fetchTeamData]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const value: TeamContextType = {
    currentTeam,
    currentLocation,
    locations,
    assignedLocationIds,
    selectedLocationId,
    userRole,
    isOwner,
    isAdmin,
    canAccessAllLocations,
    canAccessLocation,
    switchLocation,
    refreshTeam,
    loading,
    error,
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};
