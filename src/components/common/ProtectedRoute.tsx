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
