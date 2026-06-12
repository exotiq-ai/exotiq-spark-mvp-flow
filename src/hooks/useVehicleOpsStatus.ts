import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFleet } from '@/contexts/FleetContext';
import { useToast } from '@/hooks/use-toast';

export type OpsStatus = 
  | 'not_set'
  | 'pending_inspection'
  | 'needs_wash'
  | 'washing'
  | 'needs_fuel'
  | 'clean_ready'
  | 'check_out_ready'
  | 'renter_has'
  | 'check_in_required';

export interface OpsStatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  description: string;
  nextStates: OpsStatus[];
}

export const OPS_STATUS_CONFIG: Record<OpsStatus, OpsStatusConfig> = {
  not_set: {
    label: 'Not Set',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-muted-foreground/30',
    icon: 'CircleDashed',
    description: 'Ops status has not been set',
    nextStates: ['pending_inspection', 'clean_ready'],
  },
  pending_inspection: {
    label: 'Pending Inspection',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: 'ClipboardCheck',
    description: 'Vehicle needs inspection before next rental',
    nextStates: ['needs_wash', 'needs_fuel', 'clean_ready'],
  },
  needs_wash: {
    label: 'Needs Wash',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: 'Droplets',
    description: 'Vehicle requires cleaning',
    nextStates: ['washing'],
  },
  washing: {
    label: 'Washing',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    icon: 'Loader2',
    description: 'Vehicle is being washed',
    nextStates: ['clean_ready', 'needs_fuel'],
  },
  needs_fuel: {
    label: 'Needs Fuel',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: 'Fuel',
    description: 'Vehicle needs to be fueled',
    nextStates: ['clean_ready'],
  },
  clean_ready: {
    label: 'Clean & Ready',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    icon: 'CheckCircle2',
    description: 'Vehicle is ready for rental',
    nextStates: ['check_out_ready'],
  },
  check_out_ready: {
    label: 'Ready for Pickup',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    icon: 'UserCheck',
    description: 'Vehicle is ready for customer pickup',
    nextStates: ['renter_has'],
  },
  renter_has: {
    label: 'With Renter',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    icon: 'Car',
    description: 'Vehicle is currently rented out',
    nextStates: ['check_in_required'],
  },
  check_in_required: {
    label: 'Check-in Required',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    borderColor: 'border-rose-200 dark:border-rose-800',
    icon: 'LogIn',
    description: 'Vehicle returned, needs check-in processing',
    nextStates: ['pending_inspection'],
  },
};

export const useVehicleOpsStatus = () => {
  const { user } = useAuth();
  const { refreshData } = useFleet();
  const { toast } = useToast();

  const updateOpsStatus = useCallback(async (
    vehicleId: string,
    newStatus: OpsStatus
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({
          ops_status: newStatus,
          last_ops_update: new Date().toISOString(),
        })
        .eq('id', vehicleId);

      if (error) throw error;

      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      await refreshData();

      const config = OPS_STATUS_CONFIG[newStatus];
      toast({
        title: 'Status Updated',
        description: `Vehicle is now "${config.label}"`,
      });

      return true;
    } catch (error: any) {
      console.error('Error updating ops status:', error);
      toast({
        title: 'Error updating status',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [user, refreshData, toast]);

  const getStatusConfig = useCallback((status: OpsStatus | string | null): OpsStatusConfig => {
    if (!status || !(status in OPS_STATUS_CONFIG)) {
      return OPS_STATUS_CONFIG.not_set;
    }
    return OPS_STATUS_CONFIG[status as OpsStatus];
  }, []);

  const getNextStates = useCallback((currentStatus: OpsStatus | string | null): OpsStatus[] => {
    const config = getStatusConfig(currentStatus);
    return config.nextStates;
  }, [getStatusConfig]);

  return {
    updateOpsStatus,
    getStatusConfig,
    getNextStates,
    OPS_STATUS_CONFIG,
  };
};
