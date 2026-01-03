/**
 * SuperAdminGuard - Route protection for Super Admin Dashboard
 * 
 * Purpose: Prevents unauthorized access to super admin features
 * 
 * Usage:
 * <Route path="/super-admin" element={
 *   <SuperAdminGuard>
 *     <SuperAdminDashboard />
 *   </SuperAdminGuard>
 * } />
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SuperAdminGuardProps {
  children: React.ReactNode;
}

export const SuperAdminGuard = ({ children }: SuperAdminGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      if (!user) {
        setIsSuperAdmin(false);
        setCheckingStatus(false);
        return;
      }

      try {
        console.log('[SuperAdminGuard] Checking super admin status for user:', user.id);
        
        // Call the is_super_admin function from Supabase
        const { data, error: rpcError } = await supabase.rpc('is_super_admin', {
          check_user_id: user.id
        });

        if (rpcError) {
          console.error('[SuperAdminGuard] Error checking super admin status:', rpcError);
          setError(rpcError.message);
          setIsSuperAdmin(false);
        } else {
          console.log('[SuperAdminGuard] Super admin status:', data);
          setIsSuperAdmin(data === true);
        }
      } catch (err) {
        console.error('[SuperAdminGuard] Unexpected error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsSuperAdmin(false);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkSuperAdmin();
  }, [user]);

  // Show loading state while checking authentication or super admin status
  if (authLoading || checkingStatus) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <CardTitle>Verifying Access</CardTitle>
            <CardDescription>
              Checking your super admin privileges...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show error state if check failed
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-destructive/5">
        <Card className="w-full max-w-md border-destructive/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Access Check Failed</CardTitle>
            <CardDescription className="text-destructive/70">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Please contact your administrator if you believe this is an error.
            </p>
            <a href="/dashboard" className="text-primary hover:underline">
              Return to Dashboard
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect to dashboard if not a super admin
  if (!isSuperAdmin) {
    console.warn('[SuperAdminGuard] Access denied - user is not a super admin');
    return <Navigate to="/dashboard" replace />;
  }

  // User is verified super admin - render protected content
  return <>{children}</>;
};
