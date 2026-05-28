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
import { Button } from '@/components/ui/button';
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
    let cancelled = false;

    const checkSuperAdmin = async () => {
      if (authLoading) {
        setCheckingStatus(true);
        setIsSuperAdmin(null);
        setError(null);
        return;
      }

      if (!user) {
        setIsSuperAdmin(false);
        setCheckingStatus(false);
        setError(null);
        return;
      }

      setCheckingStatus(true);
      setIsSuperAdmin(null);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('is_super_admin', {
          check_user_id: user.id
        });

        if (cancelled) return;

        if (rpcError) {
          setError(rpcError.message);
          setIsSuperAdmin(false);
        } else {
          setIsSuperAdmin(data === true);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsSuperAdmin(false);
      } finally {
        if (!cancelled) setCheckingStatus(false);
      }
    };

    checkSuperAdmin();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

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

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Show explicit denial once the check has completed
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 p-4">
        <Card className="w-full max-w-md border-destructive/40">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Super Admin Access Required</CardTitle>
            <CardDescription>
              {user.email || 'This account'} is signed in, but is not currently authorized for Super Admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => { window.location.href = '/dashboard'; }}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is verified super admin - render protected content
  return <>{children}</>;
};
