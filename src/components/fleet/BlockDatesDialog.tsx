import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar as CalendarIcon, Loader2, Trash2, Ban, AlertCircle } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useVehicleBlockedDates } from '@/hooks/useVehicleBlockedDates';
import { BLOCK_REASON_OPTIONS, blockReasonLabel, type BlockReason } from '@/lib/blockedDates';
import { hasBlockingOverlap } from '@/lib/conflictDetection';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';

interface BlockDatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: { id: string; name?: string | null; make?: string | null; model?: string | null } | null;
  onChanged?: () => void;
}

export const BlockDatesDialog = ({ open, onOpenChange, vehicle, onChanged }: BlockDatesDialogProps) => {
  const { blocks, loading, addBlock, removeBlock } = useVehicleBlockedDates(vehicle?.id);
  const { bookings } = useLocationFilteredFleet();

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reason, setReason] = useState<BlockReason>('turo');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vehicleLabel =
    vehicle?.name || [vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || 'this vehicle';

  const range = useMemo(() => {
    if (!startDate || !endDate) return null;
    return { start: startOfDay(startDate), end: endOfDay(endDate) };
  }, [startDate, endDate]);

  const conflictsWithBooking = useMemo(() => {
    if (!vehicle || !range) return false;
    return hasBlockingOverlap(vehicle.id, range.start, range.end, (bookings || []) as any);
  }, [vehicle, range, bookings]);

  const reset = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setReason('turo');
    setNote('');
    setError(null);
  };

  const handleAdd = async () => {
    setError(null);
    if (!vehicle || !range) {
      setError('Pick a start and end date.');
      return;
    }
    if (range.end <= range.start) {
      setError('The end date must be on or after the start date.');
      return;
    }
    setSaving(true);
    try {
      await addBlock({
        vehicle_id: vehicle.id,
        start_date: range.start.toISOString(),
        end_date: range.end.toISOString(),
        reason,
        note: note.trim() || null,
      });
      toast({ title: 'Dates blocked', description: `${vehicleLabel} is unavailable for those dates.` });
      reset();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block those dates.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeBlock(id);
      toast({ title: 'Block removed' });
      onChanged?.();
    } catch (err) {
      toast({
        title: 'Could not remove block',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-4 w-4" />
            Block dates — {vehicleLabel}
          </DialogTitle>
          <DialogDescription>
            Blocked dates keep the vehicle off the calendar and off your public booking site.
            They are not reservations, so they never affect revenue or customer records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start font-normal', !startDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'MMM d, yyyy') : 'Start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[60]" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => {
                      setStartDate(d);
                      if (d && endDate && endDate < d) setEndDate(d);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Through</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start font-normal', !endDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'MMM d, yyyy') : 'End date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[60]" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(d) => (startDate ? d < startOfDay(startDate) : false)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as BlockReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                {BLOCK_REASON_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Turo trip #12345"
            />
          </div>

          {conflictsWithBooking && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Heads up: there is already a reservation for {vehicleLabel} in this window.
                Blocking the dates will not cancel it.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleAdd} disabled={saving || !startDate || !endDate} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
            Block these dates
          </Button>

          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Current blocks</p>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : blocks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No blocked dates for this vehicle.</p>
            ) : (
              <div className="space-y-2">
                {blocks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {format(new Date(b.start_date), 'MMM d, yyyy')} – {format(new Date(b.end_date), 'MMM d, yyyy')}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{blockReasonLabel(b.reason)}</Badge>
                        {b.note && <span className="text-xs text-muted-foreground truncate">{b.note}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(b.id)} aria-label="Remove block">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
