import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useWorkOrders, type CreateWorkOrderInput, ISSUE_TYPES } from '@/hooks/useWorkOrders';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: Partial<CreateWorkOrderInput>;
  onCreated?: (workOrder: any) => void;
}

export const CreateWorkOrderDialog = ({ open, onOpenChange, prefill, onCreated }: CreateWorkOrderDialogProps) => {
  const { createWorkOrder } = useWorkOrders();
  const { vehicles } = useLocationFilteredFleet();

  const [vehicleId, setVehicleId] = useState(prefill?.vehicle_id || '');
  const [title, setTitle] = useState(prefill?.title || '');
  const [issueType, setIssueType] = useState(prefill?.issue_type || 'general');
  const [priority, setPriority] = useState(prefill?.priority || 'normal');
  const [isOutsourced, setIsOutsourced] = useState(prefill?.internal_or_outsourced === 'outsourced');
  const [vendorName, setVendorName] = useState(prefill?.vendor_name || '');
  const [estimateCost, setEstimateCost] = useState(prefill?.estimate_cost?.toString() || '');
  const [dueAt, setDueAt] = useState(prefill?.due_at || '');
  const [notes, setNotes] = useState(prefill?.notes || '');
  const [loading, setLoading] = useState(false);

  // Sync when prefill changes (dialog re-opens with new data)
  useEffect(() => {
    if (prefill) {
      if (prefill.vehicle_id) setVehicleId(prefill.vehicle_id);
      if (prefill.title) setTitle(prefill.title);
      if (prefill.issue_type) setIssueType(prefill.issue_type);
      if (prefill.priority) setPriority(prefill.priority);
      if (prefill.notes) setNotes(prefill.notes);
    }
  }, [prefill]);

  const resetForm = () => {
    setVehicleId('');
    setTitle('');
    setIssueType('general');
    setPriority('normal');
    setIsOutsourced(false);
    setVendorName('');
    setEstimateCost('');
    setDueAt('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !title) return;

    setLoading(true);
    try {
      const result = await createWorkOrder({
        vehicle_id: vehicleId,
        title,
        issue_type: issueType,
        priority,
        internal_or_outsourced: isOutsourced ? 'outsourced' : 'internal',
        vendor_name: isOutsourced ? vendorName : undefined,
        estimate_cost: estimateCost ? Number(estimateCost) : undefined,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        notes: notes || undefined,
        source: prefill?.source || 'manual',
        source_id: prefill?.source_id,
      });

      if (result) {
        onCreated?.(result);
        resetForm();
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vehicle */}
          <div className="space-y-2">
            <Label>Vehicle *</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
              <SelectContent>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name} ({v.make} {v.model})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input placeholder="e.g., Replace brake pads" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          {/* Issue Type + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Type</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <div className="flex gap-1">
                {(['low', 'normal', 'urgent'] as const).map(p => (
                  <Button
                    key={p}
                    type="button"
                    variant={priority === p ? 'default' : 'outline'}
                    size="sm"
                    className={cn('flex-1 capitalize', priority === p && p === 'urgent' && 'bg-destructive hover:bg-destructive/90')}
                    onClick={() => setPriority(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Internal vs Outsourced */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
            <div>
              <p className="text-sm font-medium">Outsource to Vendor</p>
              <p className="text-xs text-muted-foreground">Send to external service provider</p>
            </div>
            <Switch checked={isOutsourced} onCheckedChange={setIsOutsourced} aria-label="Toggle outsource" />
          </div>

          {isOutsourced && (
            <div className="space-y-2">
              <Label>Vendor Name</Label>
              <Input placeholder="e.g., Premium Auto Care" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
            </div>
          )}

          {/* Cost + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estimated Cost ($)</Label>
              <Input type="number" placeholder="0.00" value={estimateCost} onChange={(e) => setEstimateCost(e.target.value)} min="0" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Additional details..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !vehicleId || !title}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : 'Create Work Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};