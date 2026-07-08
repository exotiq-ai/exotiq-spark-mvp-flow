import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { VehicleThumbnail } from '@/components/common/VehicleThumbnail';
import { useWorkOrders, WorkOrder, WorkOrderEvent, WORK_ORDER_STATUSES, type WorkOrderStatus } from '@/hooks/useWorkOrders';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { useMoney } from '@/hooks/useMoney';
import {
  Clock, AlertTriangle, CheckCircle2, Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EntityCommentThread } from '@/components/comments/EntityCommentThread';
import { format, formatDistanceToNow, isPast } from 'date-fns';

interface WorkOrderDetailSheetProps {
  workOrder: WorkOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleMap: Record<string, any>;
}

const STATUS_FLOW: Record<string, WorkOrderStatus[]> = {
  new: ['triaged', 'in_progress', 'cancelled'],
  triaged: ['scheduled', 'in_progress', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['blocked_parts', 'blocked_vendor', 'qa_review', 'completed'],
  blocked_parts: ['in_progress', 'cancelled'],
  blocked_vendor: ['in_progress', 'cancelled'],
  qa_review: ['completed', 'in_progress'],
  completed: [],
  cancelled: [],
};

export const WorkOrderDetailSheet = ({ workOrder, open, onOpenChange, vehicleMap }: WorkOrderDetailSheetProps) => {
  const { updateWorkOrderStatus, toggleOutOfRotation, fetchEvents, updateWorkOrder } = useWorkOrders();
  const { bookings } = useLocationFilteredFleet();
  const { currency } = useMoney();
  const [events, setEvents] = useState<WorkOrderEvent[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');

  useEffect(() => {
    if (workOrder?.id) {
      fetchEvents(workOrder.id).then(setEvents);
      setShowComplete(false);
      setResolutionSummary('');
      setActualCost('');
    } else {
      setEvents([]);
    }
  }, [workOrder?.id, fetchEvents]);

  if (!workOrder) return null;

  const vehicle = vehicleMap[workOrder.vehicle_id];
  const isOverdue = workOrder.due_at && isPast(new Date(workOrder.due_at)) && !['completed', 'cancelled'].includes(workOrder.status);
  const nextStatuses = STATUS_FLOW[workOrder.status] || [];
  const isTerminal = workOrder.status === 'completed' || workOrder.status === 'cancelled';
  const statusLabel = WORK_ORDER_STATUSES.find(s => s.value === workOrder.status)?.label || workOrder.status;

  const conflictingBookings = workOrder.out_of_rotation && workOrder.expected_return_at
    ? bookings.filter(b =>
        b.vehicle_id === workOrder.vehicle_id &&
        b.status !== 'cancelled' && b.status !== 'completed' &&
        new Date(b.start_date) <= new Date(workOrder.expected_return_at!) &&
        new Date(b.end_date) >= new Date()
      )
    : [];

  const handleStatusChange = async (status: WorkOrderStatus) => {
    if (status === 'completed') { setShowComplete(true); return; }
    await updateWorkOrderStatus(workOrder.id, status);
  };

  const handleComplete = async () => {
    await updateWorkOrderStatus(workOrder.id, 'completed', {
      resolution_summary: resolutionSummary || undefined,
      actual_cost: actualCost ? Number(actualCost) : undefined,
    });
    setShowComplete(false);
    onOpenChange(false);
  };

  const handleOORToggle = async (enabled: boolean) => {
    await toggleOutOfRotation(workOrder.id, enabled, expectedReturn || undefined);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] flex flex-col p-0" aria-label="Work order details">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 space-y-4">
          <div className="flex items-start gap-4">
            <VehicleThumbnail vehicleName={vehicle?.name || 'Unknown'} imageUrl={vehicle?.image_url} size="lg" />
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg leading-tight">{workOrder.title}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">{vehicle?.name || 'Unknown Vehicle'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn('text-xs',
              workOrder.status.includes('blocked') ? 'bg-destructive/10 text-destructive border-destructive/30' :
              workOrder.status === 'completed' ? 'bg-success/10 text-success border-success/30' :
              'bg-primary/10 text-primary border-primary/30'
            )}>{statusLabel}</Badge>
            <Badge variant={workOrder.priority === 'urgent' ? 'destructive' : 'outline'} className="capitalize">{workOrder.priority}</Badge>
            <Badge variant="outline" className="capitalize">{workOrder.issue_type}</Badge>
            <Badge variant="outline">{workOrder.internal_or_outsourced === 'outsourced' ? 'Outsourced' : 'Internal'}</Badge>
            {workOrder.out_of_rotation && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-600"><Ban className="h-3 w-3 mr-1" />Out of Service</Badge>
            )}
          </div>
        </SheetHeader>

        <Separator />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isOverdue && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Overdue</p>
                <p className="text-xs text-muted-foreground">
                  Due {formatDistanceToNow(new Date(workOrder.due_at!), { addSuffix: true })}
                </p>
              </div>
            </div>
          )}

          {/* Due Date */}
          {workOrder.due_at && !isOverdue && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Due {formatDistanceToNow(new Date(workOrder.due_at), { addSuffix: true })}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(workOrder.due_at), 'EEEE, MMM d, yyyy · h:mm a')}</p>
              </div>
            </div>
          )}

          {/* Cost */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Estimated</p>
                <p className="text-lg font-semibold">{workOrder.estimate_cost ? `$${Number(workOrder.estimate_cost).toLocaleString()}` : '—'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Actual</p>
                <p className="text-lg font-semibold">{workOrder.actual_cost ? `$${Number(workOrder.actual_cost).toLocaleString()}` : '—'}</p>
              </div>
            </div>
          </div>

          {/* Vendor */}
          {workOrder.vendor_name && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendor</h4>
              <p className="text-sm p-3 rounded-lg bg-muted/30">{workOrder.vendor_name}</p>
            </div>
          )}

          {/* Out of Rotation */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rotation Status</h4>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Out of Rotation</span>
              </div>
              <Switch checked={workOrder.out_of_rotation} onCheckedChange={handleOORToggle} disabled={isTerminal} aria-label="Toggle out of rotation" />
            </div>
            {workOrder.out_of_rotation && (
              <div className="space-y-2">
                <Label className="text-xs">Expected Return Date</Label>
                <Input
                  type="datetime-local"
                  value={expectedReturn || (workOrder.expected_return_at ? workOrder.expected_return_at.slice(0, 16) : '')}
                  onChange={(e) => {
                    setExpectedReturn(e.target.value);
                    if (e.target.value) {
                      updateWorkOrder(workOrder.id, { expected_return_at: new Date(e.target.value).toISOString() } as any);
                    }
                  }}
                  disabled={isTerminal}
                />
                {conflictingBookings.length > 0 && (
                  <div className="p-2 rounded-lg bg-warning/10 border border-warning/20 text-xs">
                    <div className="flex items-center gap-1 text-warning font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {conflictingBookings.length} booking{conflictingBookings.length > 1 ? 's' : ''} may need rebooking
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          {workOrder.notes && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</h4>
              <p className="text-sm whitespace-pre-wrap p-3 rounded-lg bg-muted/30">{workOrder.notes}</p>
            </div>
          )}

          {/* Resolution */}
          {workOrder.resolution_summary && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resolution</h4>
              <p className="text-sm whitespace-pre-wrap p-3 rounded-lg bg-success/5 border border-success/20">{workOrder.resolution_summary}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timeline</h4>
            <div className="space-y-3">
              {events.map(event => (
                <div key={event.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground capitalize">{event.event_type.replace(/_/g, ' ')}</span>
                    {event.old_value && event.new_value && (
                      <span className="text-muted-foreground"> — {event.old_value} → {event.new_value}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {format(new Date(event.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              ))}
              {events.length === 0 && <p className="text-sm text-muted-foreground">No events recorded yet</p>}
            </div>
          </div>

          {/* Activity (mentions) */}
          {workOrder.team_id && (
            <div className="space-y-2 pt-2">
              <EntityCommentThread
                entityType="work_order"
                entityId={workOrder.id}
                teamId={workOrder.team_id}
                recordLabel={workOrder.title}
                density="compact"
              />
            </div>
          )}



          {/* Completion Form */}
          {showComplete && (
            <div className="space-y-4 p-4 rounded-lg border border-success/30 bg-success/5">
              <h4 className="font-medium">Complete Work Order</h4>
              <div className="space-y-2">
                <Label>Resolution Summary</Label>
                <Textarea placeholder="Describe what was done..." value={resolutionSummary} onChange={(e) => setResolutionSummary(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Actual Cost ({currency})</Label>
                <Input type="number" placeholder="0.00" value={actualCost} onChange={(e) => setActualCost(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowComplete(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleComplete} className="flex-1 bg-success hover:bg-success/90 text-success-foreground">
                  <CheckCircle2 className="h-4 w-4 mr-2" />Complete
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        {!isTerminal && !showComplete && nextStatuses.length > 0 && (
          <>
            <Separator />
            <div className="p-4 flex flex-wrap gap-2 bg-background">
              {nextStatuses.map(status => {
                const meta = WORK_ORDER_STATUSES.find(s => s.value === status);
                const isComplete = status === 'completed';
                const isCancel = status === 'cancelled';
                return (
                  <Button
                    key={status}
                    variant={isComplete ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'flex-1 min-w-[100px]',
                      isComplete && 'bg-success hover:bg-success/90 text-success-foreground',
                      isCancel && 'text-destructive hover:text-destructive'
                    )}
                    onClick={() => handleStatusChange(status)}
                  >
                    {isComplete && <CheckCircle2 className="h-4 w-4 mr-1" />}
                    {meta?.label || status}
                  </Button>
                );
              })}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};