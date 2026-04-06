import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';
import { useAuthRedirect } from '@/components/auth/AuthRedirectHandler';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isPasswordRecovery } = useAuth();
  const { isProcessing: authRedirectProcessing, error: authError } = useAuthRedirect();
  const [waitingDuration, setWaitingDuration] = useState(0);
  const [showRecoveryUI, setShowRecoveryUI] = useState(false);

  // Track how long we've been waiting - show recovery UI after 8 seconds
  // This is more graceful than the previous 3s auto-redirect to /reset
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (currentPath === '/reset' || currentPath === '/signout') {
      return;
    }
    
    if (loading || authRedirectProcessing) {
      const interval = setInterval(() => {
        setWaitingDuration(prev => {
          const next = prev + 1;
          if (next >= 8) {
            setShowRecoveryUI(true);
          }
          return next;
        });
      }, 1000);
      
      return () => {
        clearInterval(interval);
        setWaitingDuration(0);
        setShowRecoveryUI(false);
      };
    }
  }, [loading, authRedirectProcessing]);

  // Recovery UI - shown after 8 seconds of waiting
  if (showRecoveryUI) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-muted">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Taking longer than expected</h2>
            <p className="text-muted-foreground text-sm">
              We're having trouble signing you in. This could be due to network issues.
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => window.location.reload()} 
              variant="default"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            
            <Button 
              onClick={() => window.location.href = '/reset'} 
              variant="outline"
              className="w-full"
            >
              Clear cache & restart
            </Button>
            
            <Button 
              onClick={() => window.location.href = '/auth'} 
              variant="ghost"
              className="w-full"
            >
              Go to sign in
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            If this keeps happening, try clearing your browser cache or using an incognito window.
          </p>
        </div>
      </div>
    );
  }

  // Dashboard-shaped skeleton while auth loads
  if (loading || authRedirectProcessing) {
    return (
      <div className="min-h-screen bg-background flex">
        {/* Sidebar skeleton */}
        <div className="hidden md:flex w-16 flex-col items-center py-4 gap-4 border-r border-border bg-muted/30 animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="flex-1 flex flex-col gap-3 mt-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-8 w-8 rounded-lg bg-muted" />)}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 p-4 md:p-6 space-y-4 animate-pulse">
          <div className="h-10 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
          </div>
          <div className="h-64 bg-muted rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-muted rounded-lg" />
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
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
