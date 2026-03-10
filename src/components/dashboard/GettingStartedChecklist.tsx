import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useProfile } from '@/hooks/useProfile';
import { 
  Car, 
  Calendar, 
  Users, 
  Compass, 
  Check,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GettingStartedChecklistProps {
  vehicleCount: number;
  bookingCount: number;
  onAddVehicle: () => void;
  onImportFleet: () => void;
  onCreateBooking: () => void;
  onStartTour: () => void;
  onNavigateToTeam: () => void;
}

export const GettingStartedChecklist = ({
  vehicleCount,
  bookingCount,
  onAddVehicle,
  onImportFleet,
  onCreateBooking,
  onStartTour,
  onNavigateToTeam,
}: GettingStartedChecklistProps) => {
  const { profile } = useProfile();
  
  const tourCompleted = profile ? (profile as any).tour_completed === true : false;

  const steps = useMemo(() => [
    {
      id: 'vehicle',
      label: 'Add your first vehicle',
      description: 'Or import your fleet from a CSV file',
      icon: Car,
      done: vehicleCount > 0,
      action: onAddVehicle,
      secondaryAction: onImportFleet,
      secondaryLabel: 'Import CSV',
    },
    {
      id: 'booking',
      label: 'Create your first booking',
      description: 'Start managing reservations',
      icon: Calendar,
      done: bookingCount > 0,
      action: onCreateBooking,
    },
    {
      id: 'team',
      label: 'Set up your team',
      description: 'Invite team members to collaborate',
      icon: Users,
      done: teamSetUp,
      action: onNavigateToTeam,
    },
    {
      id: 'tour',
      label: 'Take the platform tour',
      description: 'Quick walkthrough of all features',
      icon: Compass,
      done: tourCompleted,
      action: onStartTour,
    },
  ], [vehicleCount, bookingCount, teamSetUp, tourCompleted, onAddVehicle, onImportFleet, onCreateBooking, onNavigateToTeam, onStartTour]);

  const completedCount = steps.filter(s => s.done).length;
  const progress = (completedCount / steps.length) * 100;

  // Don't show if all steps are done
  if (completedCount === steps.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
    >
      <Card className="p-6 border-border bg-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Getting Started</h3>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {steps.length} complete
            </p>
          </div>
        </div>

        <Progress value={progress} className="h-1.5 mb-5" />

        <div className="space-y-1">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-colors',
                  step.done 
                    ? 'opacity-60' 
                    : 'hover:bg-muted/50 cursor-pointer'
                )}
                onClick={!step.done ? step.action : undefined}
              >
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
                  step.done 
                    ? 'bg-success/10 text-success' 
                    : 'bg-muted text-muted-foreground'
                )}>
                  {step.done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    step.done ? 'line-through text-muted-foreground' : 'text-foreground'
                  )}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {step.description}
                  </p>
                </div>

                {!step.done && (
                  <div className="flex items-center gap-2 shrink-0">
                    {step.secondaryAction && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          step.secondaryAction?.();
                        }}
                        className="text-xs text-muted-foreground h-7"
                      >
                        {step.secondaryLabel}
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
};
