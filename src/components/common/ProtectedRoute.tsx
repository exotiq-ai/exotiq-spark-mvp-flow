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

  // Show loading while auth context is initializing or an auth redirect is being processed
  if (loading || authRedirectProcessing) {
    return (
      <LoadingSpinner 
        fullScreen 
        text={waitingDuration > 3 ? "Still signing you in..." : "Signing you in..."} 
      />
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
