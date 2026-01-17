import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const { user, loading: authLoading } = useAuth();
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assignedLocationIds, setAssignedLocationIds] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use request token pattern instead of boolean guard to handle race conditions
  const fetchSeqRef = useRef(0);
  const lastUserIdRef = useRef<string | null>(null);

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

  // CRITICAL: Reset state immediately when user changes to prevent stale data
  useEffect(() => {
    if (user?.id !== lastUserIdRef.current) {
      console.log('[TeamContext] User changed:', lastUserIdRef.current, '->', user?.id);
      lastUserIdRef.current = user?.id || null;
      
      // Clear demo-specific localStorage when switching users
      localStorage.removeItem(LOCATION_STORAGE_KEY);
      
      // Immediately reset all state to prevent showing old user's data
      setCurrentTeam(null);
      setLocations([]);
      setAssignedLocationIds([]);
      setUserRole(null);
      setSelectedLocationId('all');
      setLoading(true);
      setError(null);
    }
  }, [user?.id]);

  // Fetch team data with request token pattern
  const fetchTeamData = useCallback(async () => {
    // Increment sequence to mark this as the "latest" request
    const seq = ++fetchSeqRef.current;
    console.log('[TeamContext] Fetch started, seq:', seq, 'userId:', user?.id, 'authLoading:', authLoading);
    
    // CRITICAL: Don't fetch if auth is still loading - wait for it to settle
    if (authLoading) {
      console.log('[TeamContext] Auth still loading, waiting...');
      return;
    }
    
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

      // Check if this request is still the latest (race condition guard)
      if (seq !== fetchSeqRef.current) {
        console.log('[TeamContext] Stale fetch abandoned, seq:', seq, 'current:', fetchSeqRef.current);
        return;
      }

      if (teamMemberError) {
        // User might not have a team yet
        console.log('[TeamContext] No team membership found:', teamMemberError.message);
        setLoading(false);
        return;
      }

      setUserRole(teamMember.role as AppRole);

      // Fetch team details
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamMember.team_id)
        .single();

      // Check if still latest request
      if (seq !== fetchSeqRef.current) {
        console.log('[TeamContext] Stale fetch abandoned after team query');
        return;
      }

      if (teamError) throw teamError;
      setCurrentTeam(team);
      console.log('[TeamContext] Team loaded:', team.name, team.id);

      // Try to fetch locations - handle gracefully if table doesn't exist
      let teamLocations: Location[] = [];
      try {
        const { data: locData, error: locationsError } = await supabase
          .from('locations')
          .select('*')
          .eq('team_id', teamMember.team_id)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .order('name');

        if (!locationsError) {
          teamLocations = locData || [];
        }
      } catch (e) {
        // Locations table may not exist - continue without it
        console.log('[TeamContext] Locations table not available');
      }
      
      // Check if still latest request
      if (seq !== fetchSeqRef.current) {
        console.log('[TeamContext] Stale fetch abandoned after locations query');
        return;
      }
      
      setLocations(teamLocations);

      // Try to fetch user's assigned locations - handle gracefully if table doesn't exist
      let staffLocationIds: string[] = [];
      try {
        const { data: staffLocations, error: staffError } = await supabase
          .from('location_staff')
          .select('location_id')
          .eq('user_id', user.id);

        if (!staffError && staffLocations) {
          staffLocationIds = staffLocations.map(s => s.location_id);
        }
      } catch (e) {
        // location_staff table may not exist - continue without it
        console.log('[TeamContext] location_staff table not available');
      }
      
      // Final staleness check before setting all remaining state
      if (seq !== fetchSeqRef.current) {
        console.log('[TeamContext] Stale fetch abandoned at final step');
        return;
      }
      
      setAssignedLocationIds(staffLocationIds);

      // Default to 'all' for owners/admins
      if (teamMember.role === 'owner' || teamMember.role === 'admin') {
        setSelectedLocationId('all');
      }
      
      console.log('[TeamContext] Fetch complete, seq:', seq, 'team:', team.name);

    } catch (err) {
      // Only set error if this is still the latest request
      if (seq === fetchSeqRef.current) {
        console.error('[TeamContext] Error fetching team data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch team data');
        setLoading(false);
      }
      return;
    }
    
    // Only update loading state if this is still the latest request
    if (seq === fetchSeqRef.current) {
      setLoading(false);
    }
  }, [user?.id, authLoading]);

  // Refresh team data
  const refreshTeam = useCallback(async () => {
    await fetchTeamData();
  }, [fetchTeamData]);

  // Fetch on mount and when user changes - only after auth is done loading
  useEffect(() => {
    if (!authLoading) {
      fetchTeamData();
    }
  }, [fetchTeamData, authLoading]);

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
    // During hot reload or initial load, provide safe defaults
    console.warn('useTeam called outside of TeamProvider - using defaults');
    return {
      currentTeam: null,
      currentLocation: null,
      locations: [],
      assignedLocationIds: [],
      selectedLocationId: 'all' as const,
      userRole: null,
      isOwner: false,
      isAdmin: false,
      canAccessAllLocations: true,
      canAccessLocation: () => true,
      switchLocation: () => {},
      refreshTeam: async () => {},
      loading: true,
      error: null,
    };
  }
  return context;
};
