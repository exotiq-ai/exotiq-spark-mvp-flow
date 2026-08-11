import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar as CalendarIcon, History, Loader2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { TablesInsert, Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useTeam } from '@/contexts/TeamContext';
import { useMoney } from '@/hooks/useMoney';

interface LogPastBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Tables<'vehicles'>[];
  onSubmit: (booking: Omit<TablesInsert<'bookings'>, 'user_id'>) => Promise<void>;
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const LogPastBookingDialog = ({
  open,
  onOpenChange,
  vehicles,
  onSubmit,
}: LogPastBookingDialogProps) => {
  const { currentTeam, currentLocation } = useTeam();
  const { money } = useMoney();

  const [vehicleId, setVehicleId] = useState('');
  const [customerId, setCustomerId] = useState('new');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [total, setTotal] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [customers, setCustomers] = useState<Tables<'customers'>[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    (async () => {
      let query = supabase.from('customers').select('*').order('full_name', { ascending: true });
      if (currentTeam?.id) query = query.eq('team_id', currentTeam.id);
      const { data } = await query;
      if (data) setCustomers(data);
    })();
  }, [open, currentTeam?.id]);

  useEffect(() => {
    if (!open) {
      setVehicleId('');
      setCustomerId('new');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setStartDate(undefined);
      setEndDate(undefined);
      setTotal('');
      setPickupLocation('');
      setNotes('');
      setSaving(false);
    }
  }, [open]);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const ms = endDate.getTime() - startDate.getTime();
    return Math.max(1, Math.round(ms / 86400000));
  }, [startDate, endDate]);

  const dailyRate = useMemo(() => {
    const t = parseFloat(total);
    if (!Number.isFinite(t) || t <= 0 || days <= 0) return 0;
    return Math.round((t / days) * 100) / 100;
  }, [total, days]);

  const selectedCustomer = customers.find(c => c.id === customerId);

  const handleSubmit = async () => {
    setError(null);
    const t = parseFloat(total);

    if (!vehicleId) return setError('Select the vehicle that was rented.');
    if (customerId === 'new' && !customerName.trim()) return setError('Enter the renter name.');
    if (!startDate || !endDate) return setError('Enter both the start and end dates.');
    if (endDate <= startDate) return setError('The end date must be after the start date.');
    if (endDate >= startOfToday()) return setError('A past booking must have already ended. Use New Booking for current or upcoming rentals.');
    if (!Number.isFinite(t) || t < 0) return setError('Enter the total the renter paid.');

    const start = new Date(startDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(9, 0, 0, 0);

    setSaving(true);
    try {
      await onSubmit({
        vehicle_id: vehicleId,
        customer_id: customerId !== 'new' ? customerId : null,
        customer_name: customerId !== 'new' ? (selectedCustomer?.full_name ?? '') : customerName.trim(),
        customer_email: customerId !== 'new' ? (selectedCustomer?.email ?? null) : (customerEmail.trim() || null),
        customer_phone: customerId !== 'new' ? (selectedCustomer?.phone ?? null) : (customerPhone.trim() || null),
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        pickup_location: pickupLocation.trim() || currentLocation?.name || 'Not recorded',
        daily_rate: dailyRate || 1,
        total_value: t,
        status: 'completed',
        is_historical: true,
        rental_duration_type: days > 1 ? 'multiday' : 'daily',
        notes: notes.trim() || null,
      } as any);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this booking.');
    } finally {
      setSaving(false);
    }
  };

  const DatePicker = ({
    value,
    onChange,
    label,
    testId,
  }: { value?: Date; onChange: (d?: Date) => void; label: string; testId: string }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            data-testid={testId}
            className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {value ? format(value, 'MMM d, yyyy') : 'Select date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[60]" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            disabled={(date) => date >= startOfToday()}
            defaultMonth={value}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto"
        data-testid="log-past-booking-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Log past booking
          </DialogTitle>
          <DialogDescription>
            Record a rental that already happened. Nothing is sent to the renter and it will not appear on your calendar sync.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Saved as completed. It counts toward revenue, customer history, and per-vehicle P&amp;L — no emails, no payment request.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger data-testid="past-booking-vehicle">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent className="z-[60] max-h-64">
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name || `${v.year} ${v.make} ${v.model}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Renter</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger data-testid="past-booking-customer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[60] max-h-64">
                <SelectItem value="new">+ New renter</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {customerId === 'new' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-3">
                <Label>Name</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full name"
                  data-testid="past-booking-customer-name"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email (optional)</Label>
                <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="name@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone" />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <DatePicker label="Start date" value={startDate} onChange={setStartDate} testId="past-booking-start" />
            <DatePicker label="End date" value={endDate} onChange={setEndDate} testId="past-booking-end" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Total collected</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0.00"
                data-testid="past-booking-total"
              />
              {days > 0 && dailyRate > 0 && (
                <p className="text-xs text-muted-foreground">
                  {days} {days === 1 ? 'day' : 'days'} · {money(dailyRate)}/day
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Pickup location (optional)</Label>
              <Input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder={currentLocation?.name || 'Where it started'} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything worth keeping on the record" />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto" data-testid="past-booking-save">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save past booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
