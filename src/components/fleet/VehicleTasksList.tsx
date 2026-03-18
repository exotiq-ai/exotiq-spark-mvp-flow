import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  Droplets,
  Fuel,
  Search,
  Wrench,
  ClipboardCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sparkles,
  Plus,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { VehicleTask, TaskType, TaskPriority } from "@/hooks/useFleetTasks";

const TASK_TYPE_ICONS: Record<TaskType, React.ElementType> = {
  wash: Droplets,
  fuel: Fuel,
  inspection: Search,
  maintenance: Wrench,
  check_in: ArrowDownToLine,
  check_out: ArrowUpFromLine,
  detail: Sparkles,
  repair: Wrench,
  other: ClipboardCheck,
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "text-destructive bg-destructive/10 border-destructive/20",
  normal: "text-foreground bg-muted/50 border-border",
  low: "text-muted-foreground bg-muted/30 border-border",
};

interface VehicleTasksListProps {
  tasks: VehicleTask[];
  onCreateTask: () => void;
  onCompleteTask: (taskId: string) => void;
  onClaimTask: (taskId: string) => void;
  onViewTask: (task: VehicleTask) => void;
  currentUserId?: string;
}

export const VehicleTasksList = ({
  tasks,
  onCreateTask,
  onCompleteTask,
  onClaimTask,
  onViewTask,
  currentUserId,
}: VehicleTasksListProps) => {
  const activeTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled");

  if (activeTasks.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto" />
        <div>
          <p className="text-sm font-medium text-foreground">No active tasks</p>
          <p className="text-xs text-muted-foreground mt-1">Create a task to get started</p>
        </div>
        <Button size="sm" onClick={onCreateTask}>
          <Plus className="h-4 w-4 mr-1" />
          Create Task
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {activeTasks.length} Active Task{activeTasks.length !== 1 ? "s" : ""}
        </span>
        <Button size="sm" variant="outline" onClick={onCreateTask}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          New
        </Button>
      </div>

      <div className="space-y-2">
        {activeTasks.map((task) => {
          const Icon = TASK_TYPE_ICONS[task.task_type] || ClipboardCheck;
          const isAssignedToMe = task.assigned_to === currentUserId;
          const isUnassigned = !task.assigned_to;

          return (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                PRIORITY_COLORS[task.priority]
              )}
              onClick={() => onViewTask(task)}
            >
              <div className="p-1.5 rounded-md bg-background border flex-shrink-0">
                <Icon className="h-3.5 w-3.5" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                    {task.task_type.replace("_", " ")}
                  </Badge>
                  {task.due_at && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isUnassigned && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClaimTask(task.id);
                    }}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Claim
                  </Button>
                )}
                {(isAssignedToMe || task.status === "in_progress") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-success hover:text-success"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCompleteTask(task.id);
                    }}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Done
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
