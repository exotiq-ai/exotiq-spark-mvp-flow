import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/hooks/useUserRole';
import { devLog, devError } from '@/lib/logger';

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  slug: string | null;
  logo_url: string | null;
  timezone: string | null;
  is_demo_account?: boolean; // Demo accounts show placeholder content for demos
  trial_start?: string | null;
  trial_end?: string | null;
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
  
  // Enterprise-grade concurrency controls
  const fetchSeqRef = useRef(0);
  const hasInitializedForUserRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  // Derived values
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const canAccessAllLocations = isOwner || isAdmin;

  // Get current location based on selection
  const currentLocation = useMemo(() => {
    if (selectedLocationId === 'all') {
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

  // CRITICAL: Only hard-reset when USER changes (actual account switch)
  useEffect(() => {
    if (user?.id !== hasInitializedForUserRef.current) {
      if (hasInitializedForUserRef.current !== null) {
        devLog('[TeamContext] User switched:', hasInitializedForUserRef.current, '->', user?.id);
        // Clear localStorage for new user
        localStorage.removeItem(LOCATION_STORAGE_KEY);
        // Hard reset all state
        setCurrentTeam(null);
        setLocations([]);
        setAssignedLocationIds([]);
        setUserRole(null);
        setSelectedLocationId('all');
        setLoading(true);
        setError(null);
      }
      hasInitializedForUserRef.current = user?.id || null;
    }
  }, [user?.id]);

  // Fetch team data with concurrency guard
  const fetchTeamData = useCallback(async () => {
    // Concurrency guard
    if (isFetchingRef.current) {
      devLog('[TeamContext] Fetch already in progress, skipping');
      return;
    }
    
    const seq = ++fetchSeqRef.current;
    devLog('[TeamContext] Fetch started, seq:', seq, 'userId:', user?.id);
    
    // Wait for auth to settle
    if (authLoading) {
      devLog('[TeamContext] Auth still loading, waiting...');
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
    
    isFetchingRef.current = true;
    setError(null);
    
    try {
      // Use maybeSingle() to handle "no row found" gracefully
      const { data: teamMember, error: teamMemberError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      // Stale check
      if (seq !== fetchSeqRef.current) {
        devLog('[TeamContext] Stale fetch abandoned, seq:', seq);
        return;
      }

      if (teamMemberError) {
        devError('[TeamContext] Error fetching team membership:', teamMemberError);
        setError(`Team membership error: ${teamMemberError.message}`);
        setLoading(false);
        return;
      }
      
      // No team membership - that's okay, user just doesn't have a team
      if (!teamMember) {
        devLog('[TeamContext] No team membership found for user');
        setCurrentTeam(null);
        setUserRole(null);
        setLoading(false);
        return;
      }

      setUserRole(teamMember.role as AppRole);

      // Parallel fetch: team details + locations + staff assignments
      const [teamResult, locationsResult, staffResult] = await Promise.all([
        supabase
          .from('teams')
          .select('*')
          .eq('id', teamMember.team_id)
          .maybeSingle(),
        supabase
          .from('locations')
          .select('*')
          .eq('team_id', teamMember.team_id)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .order('name')
          .then(res => ({ data: res.data, error: res.error })),
        supabase
          .from('location_staff')
          .select('location_id')
          .eq('user_id', user.id)
          .then(res => ({ data: res.data, error: res.error })),
      ]);

      if (seq !== fetchSeqRef.current) return;

      if (teamResult.error) {
        devError('[TeamContext] Error fetching team:', teamResult.error);
        setError(`Team fetch error: ${teamResult.error.message}`);
        setLoading(false);
        return;
      }
      
      if (!teamResult.data) {
        devLog('[TeamContext] Team not found for id:', teamMember.team_id);
        setError(`Team not found for membership`);
        setLoading(false);
        return;
      }
      
      setCurrentTeam(teamResult.data);
      devLog('[TeamContext] Team loaded:', teamResult.data.name, teamResult.data.id);

      // Set locations (graceful — empty array on failure)
      const teamLocations: Location[] = locationsResult.data || [];
      setLocations(teamLocations);

      // Set staff location assignments (graceful)
      const staffLocationIds: string[] = staffResult.data?.map(s => s.location_id) || [];
      setAssignedLocationIds(staffLocationIds);

      // Default to 'all' for owners/admins
      if (teamMember.role === 'owner' || teamMember.role === 'admin') {
        setSelectedLocationId('all');
      }
      
      devLog('[TeamContext] Fetch complete, seq:', seq, 'team:', teamResult.data.name);

    } catch (err) {
      if (seq === fetchSeqRef.current) {
        devError('[TeamContext] Error fetching team data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch team data');
      }
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [user?.id, authLoading]);

  // Refresh team data
  const refreshTeam = useCallback(async () => {
    await fetchTeamData();
  }, [fetchTeamData]);

  // INITIAL LOAD: Only trigger ONCE per user session
  useEffect(() => {
    // Wait for auth to settle
    if (authLoading) {
      devLog('[TeamContext] Waiting for auth...');
      return;
    }
    
    // No user = no team needed
    if (!user) {
      devLog('[TeamContext] No user, clearing state');
      setLoading(false);
      return;
    }
    
    // Check if we already initialized for this user
    if (hasInitializedForUserRef.current === user.id && currentTeam !== null) {
      devLog('[TeamContext] Already initialized for user', user.id);
      return;
    }
    
    devLog('[TeamContext] Initial load for user:', user.id);
    fetchTeamData();
  }, [authLoading, user?.id]); // Intentionally exclude fetchTeamData to prevent cascades

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
