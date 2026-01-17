import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';
import { useAuthRedirect } from '@/components/auth/AuthRedirectHandler';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isPasswordRecovery } = useAuth();
  const { isProcessing: authRedirectProcessing, error: authError } = useAuthRedirect();
  const [timedOut, setTimedOut] = useState(false);

  // Timeout after 3 seconds to prevent infinite loading (reduced from 5)
  useEffect(() => {
    if (loading || authRedirectProcessing) {
      const timeout = setTimeout(() => {
        console.warn('ProtectedRoute: Auth loading timed out after 3 seconds');
        setTimedOut(true);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [loading, authRedirectProcessing]);

  // If timed out, redirect to /reset for nuclear cleanup
  if (timedOut) {
    window.location.href = '/reset';
    return <LoadingSpinner fullScreen text="Session timed out, clearing cache..." />;
  }

  // Show loading while auth context is initializing or an auth redirect is being processed
  if (loading || authRedirectProcessing) {
    return <LoadingSpinner fullScreen text="Signing you in..." />;
  }

  // If password recovery is in progress, allow access (user will be redirected to update password)
  if (isPasswordRecovery) {
    return <>{children}</>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
