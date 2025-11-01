import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Alert variant="destructive" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-auto animate-fade-in">
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        You're offline. Some features may be unavailable.
      </AlertDescription>
    </Alert>
  );
};
