import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { VehicleTask, TaskType, TaskPriority, TaskStatus } from '@/hooks/useFleetTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { EntityCommentThread } from '@/components/comments/EntityCommentThread';
import {
  CheckCircle2, Clock, User,
  Droplets, Fuel, ClipboardCheck, Wrench, LogIn, LogOut, Sparkles, AlertCircle,
  Play, UserPlus, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isPast } from 'date-fns';

const TASK_TYPE_META: Record<TaskType, { icon: any; label: string; color: string }> = {
  wash: { icon: Droplets, label: 'Wash', color: 'text-blue-500' },
  fuel: { icon: Fuel, label: 'Fuel', color: 'text-orange-500' },
  inspection: { icon: ClipboardCheck, label: 'Inspection', color: 'text-amber-500' },
  maintenance: { icon: Wrench, label: 'Maintenance', color: 'text-slate-500' },
  check_in: { icon: LogIn, label: 'Check In', color: 'text-rose-500' },
  check_out: { icon: LogOut, label: 'Check Out', color: 'text-purple-500' },
  detail: { icon: Sparkles, label: 'Detail', color: 'text-cyan-500' },
  repair: { icon: Wrench, label: 'Repair', color: 'text-red-500' },
  other: { icon: AlertCircle, label: 'Other', color: 'text-muted-foreground' },
};

const PRIORITY_META: Record<TaskPriority, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  low: { label: 'Low', variant: 'secondary' },
  normal: { label: 'Normal', variant: 'outline' },
  urgent: { label: 'Urgent', variant: 'destructive' },
};

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', color: 'bg-primary/10 text-primary' },
  completed: { label: 'Completed', color: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive' },
};

interface TaskDetailSheetProps {
  task: VehicleTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleMap: Record<string, { name: string }>;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<boolean>;
  onClaim: (taskId: string) => Promise<boolean>;
  onConvertToWorkOrder?: (task: VehicleTask) => void;
}

export const TaskDetailSheet = ({
  task, open, onOpenChange, vehicleMap, onStatusChange, onClaim, onConvertToWorkOrder,
}: TaskDetailSheetProps) => {
  const { user } = useAuth();

  if (!task) return null;

  const typeMeta = TASK_TYPE_META[task.task_type] || TASK_TYPE_META.other;
  const priorityMeta = PRIORITY_META[task.priority];
  const statusMeta = STATUS_META[task.status];
  const TypeIcon = typeMeta.icon;
  const vehicleName = vehicleMap[task.vehicle_id]?.name || 'Unknown Vehicle';
  const isOverdue = task.due_at && isPast(new Date(task.due_at)) && task.status !== 'completed';
  const isMyTask = task.assigned_to === user?.id;
  const isUnassigned = !task.assigned_to;

  const handleClaim = async () => {
    const success = await onClaim(task.id);
    if (success) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] flex flex-col p-0" aria-label="Task details">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-muted flex-shrink-0">
              <TypeIcon className={cn('h-6 w-6', typeMeta.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg leading-tight">{task.title}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">{vehicleName}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className={statusMeta.color}>{statusMeta.label}</Badge>
            <Badge variant={priorityMeta.variant}>{priorityMeta.label} Priority</Badge>
            <Badge variant="outline" className={typeMeta.color}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {typeMeta.label}
            </Badge>
          </div>
        </SheetHeader>

        <Separator />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Due Date */}
          {task.due_at && (
            <div className={cn(
              'flex items-center gap-3 p-3 rounded-lg border',
              isOverdue ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30'
            )}>
              <Clock className={cn('h-5 w-5', isOverdue ? 'text-destructive' : 'text-muted-foreground')} />
              <div>
                <p className={cn('text-sm font-medium', isOverdue && 'text-destructive')}>
                  {isOverdue ? 'Overdue' : 'Due'} {formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(task.due_at), 'EEEE, MMM d, yyyy · h:mm a')}
                </p>
              </div>
            </div>
          )}

          {/* Assignment */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assignment</h4>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="p-2 rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isMyTask ? 'Assigned to you' : isUnassigned ? 'Unassigned' : 'Assigned to team member'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isUnassigned ? 'Claim this task to get started' : 'Task is being worked on'}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {task.notes && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</h4>
              <div className="p-3 rounded-lg bg-muted/30 text-sm whitespace-pre-wrap">
                {task.notes}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timeline</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Created</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(new Date(task.created_at), 'MMM d, h:mm a')}
                </span>
              </div>
              {task.completed_at && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                  <span className="text-muted-foreground">Completed</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {format(new Date(task.completed_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        {task.status !== 'completed' && task.status !== 'cancelled' && (
          <>
            <Separator />
            <div className="p-4 flex gap-2 bg-background">
              {isUnassigned && (
                <Button onClick={handleClaim} className="flex-1" size="lg">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Claim Task
                </Button>
              )}
              {task.status === 'pending' && isMyTask && (
                <Button
                  onClick={() => onStatusChange(task.id, 'in_progress')}
                  className="flex-1" size="lg"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Task
                </Button>
              )}
              {task.status === 'in_progress' && (
                <Button
                  onClick={() => { onStatusChange(task.id, 'completed'); onOpenChange(false); }}
                  className="flex-1 bg-success hover:bg-success/90 text-success-foreground" size="lg"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              )}
              {onConvertToWorkOrder && (
                <Button variant="outline" size="lg" onClick={() => onConvertToWorkOrder(task)}>
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Work Order
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};