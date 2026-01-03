import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer';

interface UserRoleData {
  role: AppRole | null;
  permissions: string[];
  loading: boolean;
  error: string | null;
}

// Role hierarchy: owner > admin > manager > operator > viewer
const roleHierarchy: Record<AppRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  operator: 2,
  viewer: 1,
};

export const useUserRole = () => {
  const { user } = useAuth();
  const [roleData, setRoleData] = useState<UserRoleData>({
    role: null,
    permissions: [],
    loading: true,
    error: null,
  });

  const fetchRole = useCallback(async () => {
    if (!user?.id) {
      setRoleData({
        role: null,
        permissions: [],
        loading: false,
        error: null,
      });
      return;
    }

    try {
      setRoleData(prev => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabase.rpc('get_my_role');

      if (error) throw error;

      if (data && data.length > 0) {
        setRoleData({
          role: data[0].role as AppRole,
          permissions: data[0].permissions || [],
          loading: false,
          error: null,
        });
      } else {
        // No role assigned yet - this is a new user whose role trigger hasn't run yet
        // OR they were invited but haven't completed setup
        // Return null role (not viewer) - let them access the app without restrictions
        // The auto_assign_user_role trigger will assign admin role shortly
        setRoleData({
          role: null,
          permissions: [],
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
      setRoleData({
        role: null,
        permissions: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch role',
      });
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  // Check if user has a specific role
  const hasRole = useCallback((role: AppRole): boolean => {
    if (!roleData.role) return false;
    return roleData.role === role;
  }, [roleData.role]);

  // Check if user has at least the specified role level
  const hasRoleOrHigher = useCallback((minimumRole: AppRole): boolean => {
    if (!roleData.role) return false;
    return roleHierarchy[roleData.role] >= roleHierarchy[minimumRole];
  }, [roleData.role]);

  // Check if user has a specific permission
  const hasPermission = useCallback((permission: string): boolean => {
    // Owners and Admins have all permissions
    if (roleData.role === 'owner' || roleData.role === 'admin') return true;
    return roleData.permissions.includes(permission);
  }, [roleData.role, roleData.permissions]);

  // Check if user has any of the specified permissions
  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (roleData.role === 'owner' || roleData.role === 'admin') return true;
    return permissions.some(p => roleData.permissions.includes(p));
  }, [roleData.role, roleData.permissions]);

  // Check if user has all of the specified permissions
  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (roleData.role === 'owner' || roleData.role === 'admin') return true;
    return permissions.every(p => roleData.permissions.includes(p));
  }, [roleData.role, roleData.permissions]);

  // Check if user is owner
  const isOwner = roleData.role === 'owner';

  // Check if user is owner or admin
  const isOwnerOrAdmin = roleData.role === 'owner' || roleData.role === 'admin';

  // Check if user is admin (includes owner for backwards compatibility)
  const isAdmin = isOwnerOrAdmin;

  // Check if user is manager or higher
  const isManagerOrHigher = roleData.role ? roleHierarchy[roleData.role] >= roleHierarchy['manager'] : false;

  // Check if user can manage users (owner/admin only)
  const canManageUsers = isOwnerOrAdmin;

  // Check if user can manage billing (owner/admin only)
  const canManageBilling = isOwnerOrAdmin;

  // Check if user can create/edit bookings
  const canManageBookings = roleData.role ? roleHierarchy[roleData.role] >= roleHierarchy['operator'] : false;

  // Check if user is read-only (explicitly assigned viewer role)
  // Note: null role means role not yet assigned, NOT read-only
  const isReadOnly = roleData.role === 'viewer';

  // Owner-only permissions
  const canDeleteAccount = isOwner;
  const canConfigureIntegrations = isOwner;
  const canTransferOwnership = isOwner;

  return {
    ...roleData,
    hasRole,
    hasRoleOrHigher,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isOwner,
    isOwnerOrAdmin,
    isAdmin,
    isManagerOrHigher,
    canManageUsers,
    canManageBilling,
    canManageBookings,
    isReadOnly,
    canDeleteAccount,
    canConfigureIntegrations,
    canTransferOwnership,
    refetch: fetchRole,
  };
};
