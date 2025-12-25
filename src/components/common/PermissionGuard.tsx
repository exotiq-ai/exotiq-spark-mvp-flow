import { ReactNode } from 'react';
import { useUserRole, AppRole } from '@/hooks/useUserRole';

interface PermissionGuardProps {
  children: ReactNode;
  /** Fallback content when permission is denied */
  fallback?: ReactNode;
  /** Required permissions - user needs at least one */
  permissions?: string[];
  /** Required role - exact match */
  role?: AppRole;
  /** Minimum role level - user needs this role or higher */
  minRole?: AppRole;
  /** If true, requires all permissions instead of any */
  requireAll?: boolean;
}

/**
 * Conditionally renders children based on user permissions or roles.
 * Use this to hide/show UI elements based on user access level.
 */
export const PermissionGuard = ({
  children,
  fallback = null,
  permissions,
  role,
  minRole,
  requireAll = false,
}: PermissionGuardProps) => {
  const { 
    role: userRole, 
    hasRole, 
    hasRoleOrHigher, 
    hasAnyPermission, 
    hasAllPermissions,
    loading 
  } = useUserRole();

  // While loading, don't render anything
  if (loading) {
    return null;
  }

  // Check role if specified
  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  // Check minimum role if specified
  if (minRole && !hasRoleOrHigher(minRole)) {
    return <>{fallback}</>;
  }

  // Check permissions if specified
  if (permissions && permissions.length > 0) {
    const hasAccess = requireAll 
      ? hasAllPermissions(permissions) 
      : hasAnyPermission(permissions);
    
    if (!hasAccess) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

/**
 * HOC version of PermissionGuard for wrapping components
 */
export function withPermissionGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  guardProps: Omit<PermissionGuardProps, 'children'>
) {
  return function GuardedComponent(props: P) {
    return (
      <PermissionGuard {...guardProps}>
        <WrappedComponent {...props} />
      </PermissionGuard>
    );
  };
}
