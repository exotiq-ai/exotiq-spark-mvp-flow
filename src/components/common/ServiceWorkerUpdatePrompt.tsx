import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

/**
 * ServiceWorkerUpdatePrompt - Notifies users when a new version is available
 * and allows them to update with a single click.
 */
export const ServiceWorkerUpdatePrompt = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Listen for new service workers
      const handleControllerChange = () => {
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      // Check for waiting service worker
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
        
        if (reg.waiting) {
          setShowUpdate(true);
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdate(true);
                toast.info('A new version is available!', {
                  duration: 10000,
                  action: {
                    label: 'Update',
                    onClick: () => handleUpdate(),
                  },
                });
              }
            });
          }
        });
      });

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 p-4 bg-primary text-primary-foreground rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-left">
      <RefreshCw className="h-5 w-5" />
      <span className="text-sm font-medium">New version available!</span>
      <Button 
        size="sm" 
        variant="secondary" 
        onClick={handleUpdate}
        className="ml-2"
      >
        Update Now
      </Button>
    </div>
  );
};
