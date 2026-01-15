import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2,
  Clock,
  User,
  Droplets,
  Fuel,
  ClipboardCheck,
  Wrench,
  LogIn,
  LogOut,
  Sparkles,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VehicleTask, TaskType, TaskPriority } from '@/hooks/useFleetTasks';
import { formatDistanceToNow } from 'date-fns';

interface TaskQueueProps {
  tasks: VehicleTask[];
  vehicleMap: Record<string, { name: string }>;
  onCompleteTask: (taskId: string) => void;
  onClaimTask: (taskId: string) => void;
  onViewTask: (task: VehicleTask) => void;
  showClaimButton?: boolean;
  title?: string;
  emptyMessage?: string;
  compact?: boolean;
}

const TASK_TYPE_CONFIG: Record<TaskType, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  wash: { icon: Droplets, color: 'text-blue-500' },
  fuel: { icon: Fuel, color: 'text-orange-500' },
  inspection: { icon: ClipboardCheck, color: 'text-amber-500' },
  maintenance: { icon: Wrench, color: 'text-slate-500' },
  check_in: { icon: LogIn, color: 'text-rose-500' },
  check_out: { icon: LogOut, color: 'text-purple-500' },
  detail: { icon: Sparkles, color: 'text-cyan-500' },
  repair: { icon: Wrench, color: 'text-red-500' },
  other: { icon: AlertCircle, color: 'text-muted-foreground' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-muted-foreground', bg: 'bg-muted' },
  normal: { label: 'Normal', color: 'text-foreground', bg: 'bg-secondary' },
  urgent: { label: 'Urgent', color: 'text-destructive', bg: 'bg-destructive/10' },
};

export const TaskQueue = ({
  tasks,
  vehicleMap,
  onCompleteTask,
  onClaimTask,
  onViewTask,
  showClaimButton = false,
  title = 'Tasks',
  emptyMessage = 'No tasks',
  compact = false,
}: TaskQueueProps) => {
  if (tasks.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </Card>
    );
  }

  // Group tasks by priority
  const urgentTasks = tasks.filter(t => t.priority === 'urgent');
  const normalTasks = tasks.filter(t => t.priority === 'normal');
  const lowTasks = tasks.filter(t => t.priority === 'low');

  const renderTask = (task: VehicleTask) => {
    const typeConfig = TASK_TYPE_CONFIG[task.task_type] || TASK_TYPE_CONFIG.other;
    const priorityConfig = PRIORITY_CONFIG[task.priority];
    const TaskIcon = typeConfig.icon;
    const vehicleName = vehicleMap[task.vehicle_id]?.name || 'Unknown Vehicle';
    const dueText = task.due_at 
      ? formatDistanceToNow(new Date(task.due_at), { addSuffix: true })
      : null;

    return (
      <motion.div
        key={task.id}
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
      >
        <Card 
          className={cn(
            'p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/20',
            task.priority === 'urgent' && 'border-l-4 border-l-destructive',
            compact && 'p-2'
          )}
          onClick={() => onViewTask(task)}
        >
          <div className="flex items-center gap-3">
            {/* Task Type Icon */}
            <div className={cn(
              'p-2 rounded-lg bg-muted flex-shrink-0',
              compact && 'p-1.5'
            )}>
              <TaskIcon className={cn('h-4 w-4', typeConfig.color)} />
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className={cn(
                  'font-medium text-foreground truncate',
                  compact && 'text-sm'
                )}>
                  {task.title}
                </h4>
                {task.priority === 'urgent' && (
                  <Badge variant="destructive" className="text-xs px-1.5">
                    Urgent
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="truncate">{vehicleName}</span>
                {dueText && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {dueText}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {showClaimButton && !task.assigned_to && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClaimTask(task.id);
                  }}
                >
                  <User className="h-3 w-3 mr-1" />
                  Claim
                </Button>
              )}
              
              {task.status === 'in_progress' && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompleteTask(task.id);
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Done
                </Button>
              )}

              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
      )}

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {/* Urgent first */}
            {urgentTasks.map(renderTask)}
            
            {/* Then normal */}
            {normalTasks.map(renderTask)}
            
            {/* Then low */}
            {lowTasks.map(renderTask)}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
};
