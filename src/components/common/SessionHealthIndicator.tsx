import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionHealthStatus } from '@/hooks/useSessionHealth';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SessionHealthIndicatorProps {
  status: SessionHealthStatus;
  className?: string;
}

/**
 * A subtle visual indicator showing the current session health status.
 * 
 * - healthy: No indicator shown (clean UI)
 * - refreshing: Spinning loader
 * - checking: Spinning loader
 * - expired: Red dot
 * - idle-warning: Yellow/amber dot
 */
export function SessionHealthIndicator({ status, className }: SessionHealthIndicatorProps) {
  // Don't show anything when healthy
  if (status === 'healthy') {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'refreshing':
      case 'checking':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />,
          tooltip: 'Refreshing session...',
        };
      case 'idle-warning':
        return {
          icon: <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />,
          tooltip: 'Session expiring soon due to inactivity',
        };
      case 'expired':
        return {
          icon: <div className="h-2 w-2 rounded-full bg-destructive" />,
          tooltip: 'Session expired - please sign in again',
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex items-center justify-center p-1', className)}>
          {config.icon}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {config.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
