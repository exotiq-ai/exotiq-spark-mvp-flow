import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer';

interface UserRoleData {
  role: AppRole | null;
  permissions: string[];
  loading: boolean;
  error: string | null;
}

const EMPTY_PERMISSIONS: string[] = [];

// Role hierarchy: owner > admin > manager > operator > viewer
const roleHierarchy: Record<AppRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  operator: 2,
  viewer: 1,
};

interface RoleRow {
  role: AppRole | null;
  permissions: string[];
}

/** Shared cache key: every component reading the role shares one request. */
export const myRoleQueryKey = (userId: string | undefined) => ['my-role', userId] as const;

export const useUserRole = () => {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery({
    queryKey: myRoleQueryKey(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RoleRow> => {
      const { data, error } = await supabase.rpc('get_my_role');
      if (error) throw error;
      // No row yet = new user whose role trigger hasn't run, or an invite still
      // being set up. Null role (not viewer) lets them use the app unrestricted;
      // the auto_assign_user_role trigger assigns the role shortly.
      if (!data || data.length === 0) return { role: null, permissions: [] };
      return { role: data[0].role as AppRole, permissions: data[0].permissions || [] };
    },
  });

  const roleData: UserRoleData = {
    role: query.data?.role ?? null,
    permissions: query.data?.permissions ?? EMPTY_PERMISSIONS,
    loading: userId ? query.isLoading : false,
    error: query.error ? (query.error instanceof Error ? query.error.message : 'Failed to fetch role') : null,
  };

  const { refetch } = query;
  const fetchRole = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
