import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { VehicleThumbnail } from '@/components/common/VehicleThumbnail';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon,
  Droplets,
  Fuel,
  ClipboardCheck,
  Wrench,
  LogIn,
  LogOut,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskType, TaskPriority, CreateTaskInput } from '@/hooks/useFleetTasks';

interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
}

interface TeamMember {
  id: string;
  user_id: string;
  profile?: {
    full_name: string | null;
    email: string;
  };
}

interface CreateVehicleTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  teamMembers: TeamMember[];
  onCreateTask: (input: CreateTaskInput) => Promise<any>;
}

const TASK_TYPES: { value: TaskType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'wash', label: 'Wash', icon: Droplets },
  { value: 'fuel', label: 'Fuel', icon: Fuel },
  { value: 'inspection', label: 'Inspection', icon: ClipboardCheck },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
  { value: 'check_in', label: 'Check-in', icon: LogIn },
  { value: 'check_out', label: 'Check-out', icon: LogOut },
  { value: 'detail', label: 'Detail', icon: Sparkles },
  { value: 'repair', label: 'Repair', icon: Wrench },
  { value: 'other', label: 'Other', icon: AlertCircle },
];

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-muted-foreground' },
  { value: 'normal', label: 'Normal', color: 'text-foreground' },
  { value: 'urgent', label: 'Urgent', color: 'text-destructive' },
];

export const CreateVehicleTaskDialog = ({
  open,
  onOpenChange,
  vehicle,
  teamMembers,
  onCreateTask,
}: CreateVehicleTaskDialogProps) => {
  const [taskType, setTaskType] = useState<TaskType>('other');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes or vehicle changes
  useEffect(() => {
    if (open) {
      setTaskType('other');
      setTitle('');
      setPriority('normal');
      setAssignedTo('');
      setNotes('');
      setDueDate(undefined);
    }
  }, [open, vehicle]);

  // Auto-generate title based on task type
  useEffect(() => {
    const selectedType = TASK_TYPES.find(t => t.value === taskType);
    if (selectedType && vehicle) {
      setTitle(`${selectedType.label} - ${vehicle.name}`);
    }
  }, [taskType, vehicle]);

  const handleSubmit = async () => {
    if (!vehicle || !title.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateTask({
        vehicle_id: vehicle.id,
        task_type: taskType,
        title: title.trim(),
        priority,
        assigned_to: assignedTo || undefined,
        notes: notes.trim() || undefined,
        due_at: dueDate?.toISOString(),
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Create Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Vehicle Info */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border">
            <VehicleThumbnail vehicleName={vehicle.name} size="md" />
            <div>
              <h4 className="font-semibold text-foreground">{vehicle.name}</h4>
              <p className="text-sm text-muted-foreground">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
            </div>
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label className="text-foreground">Task Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {TASK_TYPES.slice(0, 6).map((type) => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    type="button"
                    variant={taskType === type.value ? 'default' : 'outline'}
                    className={cn(
                      'h-auto py-3 flex-col gap-1',
                      taskType === type.value && 'ring-2 ring-primary'
                    )}
                    onClick={() => setTaskType(type.value)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs">{type.label}</span>
                  </Button>
                );
              })}
            </div>
            <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-foreground">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="text-foreground">Priority</Label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  variant={priority === p.value ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    priority === p.value && p.value === 'urgent' && 'bg-destructive hover:bg-destructive/90'
                  )}
                  onClick={() => setPriority(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Assign To */}
          <div className="space-y-2">
            <Label className="text-foreground">Assign To (Optional)</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Leave unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profile?.full_name || member.profile?.email || 'Team Member'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label className="text-foreground">Due Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dueDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : 'No due date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-foreground">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
