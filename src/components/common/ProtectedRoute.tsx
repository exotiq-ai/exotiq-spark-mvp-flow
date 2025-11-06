import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Detect auth redirect state (magic link, password recovery) and avoid premature redirects
  const isAuthRedirect = Boolean(
    (location && (location.hash?.includes('access_token') || location.search?.includes('code=')))
  );

  if (loading || isAuthRedirect) {
    return <LoadingSpinner fullScreen text="Signing you in..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
