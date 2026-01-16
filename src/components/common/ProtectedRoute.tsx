import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';
import { useAuthRedirect, hasAuthRedirectParams } from '@/components/auth/AuthRedirectHandler';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isPasswordRecovery } = useAuth();
  const { isProcessing: authRedirectProcessing, error: authError } = useAuthRedirect();

  // Check if we have auth params in URL that need processing
  const hasAuthParams = hasAuthRedirectParams();

  // Show loading while:
  // 1. Auth context is initializing
  // 2. Auth redirect is being processed
  // 3. We have auth params that haven't been processed yet
  if (loading || authRedirectProcessing || (hasAuthParams && !authError)) {
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
