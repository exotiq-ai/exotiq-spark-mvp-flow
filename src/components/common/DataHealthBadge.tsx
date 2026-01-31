import React from 'react';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DataHealthBadgeProps {
  hasCustomer: boolean;
  hasVehicle: boolean;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
  className?: string;
}

type HealthStatus = 'complete' | 'partial' | 'incomplete';

interface HealthInfo {
  status: HealthStatus;
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  message: string;
}

function getHealthInfo(hasCustomer: boolean, hasVehicle: boolean): HealthInfo {
  if (hasCustomer && hasVehicle) {
    return {
      status: 'complete',
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      message: 'All data linked'
    };
  }
  
  if (hasCustomer || hasVehicle) {
    const missing = !hasCustomer ? 'customer' : 'vehicle';
    return {
      status: 'partial',
      icon: AlertCircle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      message: `Missing ${missing} link`
    };
  }
  
  return {
    status: 'incomplete',
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    message: 'Missing customer and vehicle links'
  };
}

export function DataHealthBadge({ 
  hasCustomer, 
  hasVehicle, 
  size = 'sm',
  showTooltip = true,
  className 
}: DataHealthBadgeProps) {
  const healthInfo = getHealthInfo(hasCustomer, hasVehicle);
  const Icon = healthInfo.icon;
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5'
  };
  
  const badge = (
    <div className={cn(
      'flex items-center justify-center rounded-full p-0.5',
      healthInfo.bgColor,
      className
    )}>
      <Icon className={cn(sizeClasses[size], healthInfo.color)} />
    </div>
  );
  
  if (!showTooltip) {
    return badge;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{healthInfo.message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function getDataHealthStatus(hasCustomer: boolean, hasVehicle: boolean): HealthStatus {
  return getHealthInfo(hasCustomer, hasVehicle).status;
}
