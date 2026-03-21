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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Calendar as CalendarIcon, User, MapPin, Loader2, AlertCircle, Sparkles, UserPlus, ChevronDown, Check, DollarSign, Clock, Info } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimeSelect } from '@/components/ui/time-select';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { TablesInsert, Tables } from '@/integrations/supabase/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validators, validateForm } from '@/lib/validation';
import { toast } from '@/hooks/use-toast';
import { useAIPricing } from '@/hooks/useAIPricing';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { calculateBookingTotal, DEFAULT_GAS_FEE, getRateForDuration, getAvailableDurations, getDurationLabel, type RentalDurationType } from '@/lib/pricingUtils';
import { isBlockingBooking } from '@/lib/conflictDetection';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { Switch } from '@/components/ui/switch';

interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Tables<'vehicles'>[];
  onSubmit: (booking: Omit<TablesInsert<"bookings">, 'user_id'>) => Promise<void>;
  prefillCustomer?: { id: string; name: string; email?: string; phone?: string };
}

export const NewBookingDialog = ({
  open,
  onOpenChange,
  vehicles,
  onSubmit,
  prefillCustomer,
}: NewBookingDialogProps) => {
  const { selectedLocationId, currentLocation, locations, currentTeam } = useTeam();
  const { bookings: allBookings } = useLocationFilteredFleet();
  
  const [vehicleId, setVehicleId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('new');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState('09:00');
  const [endDateManuallySet, setEndDateManuallySet] = useState(false);
  const [pickupLocationId, setPickupLocationId] = useState('');
  const [pickupLocationText, setPickupLocationText] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Tables<'customers'>[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [discountExpanded, setDiscountExpanded] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [gasFeeWaived, setGasFeeWaived] = useState(false);
  const [durationType, setDurationType] = useState<RentalDurationType>('daily');
  // Fetch existing customers when dialog opens
  useEffect(() => {
    if (open) {
      fetchCustomers();
    }
  }, [open, currentTeam?.id]);

  // Prefill customer data when provided (e.g. from CRM)
  useEffect(() => {
    if (open && prefillCustomer) {
      setSelectedCustomerId(prefillCustomer.id);
      setCustomerName(prefillCustomer.name);
      setCustomerEmail(prefillCustomer.email || '');
      setCustomerPhone(prefillCustomer.phone || '');
    }
  }, [open, prefillCustomer]);

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .order('full_name', { ascending: true });
      
      if (currentTeam?.id) {
        query = query.eq('team_id', currentTeam.id);
      }
      
      const { data, error } = await query;
      if (!error && data) {
        setCustomers(data);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Handle customer selection
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    
    if (customerId === 'new') {
      // Clear fields for new customer
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
    } else {
      // Auto-fill from existing customer
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setCustomerName(customer.full_name);
        setCustomerEmail(customer.email || '');
        setCustomerPhone(customer.phone || '');
      }
    }
  };

  // Helper to combine date + time into ISO string
  const combineDateAndTime = (date: Date | undefined, time: string): string => {
    if (!date) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

  const startDateTimeStr = combineDateAndTime(startDate, startTime);
  const endDateTimeStr = combineDateAndTime(endDate, endTime);

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const pricingSuggestion = useAIPricing(selectedVehicle || null, startDateTimeStr);

  // Check which vehicles have conflicting bookings for the selected dates
  const vehicleAvailability = useMemo(() => {
    if (!startDate || !endDate) return {};
    const start = new Date(startDateTimeStr);
    const end = new Date(endDateTimeStr);
    const availability: Record<string, boolean> = {};
    vehicles.forEach(v => {
      const hasConflict = allBookings.some(b => {
        if (b.vehicle_id !== v.id) return false;
        if (!isBlockingBooking(b.status)) return false;
        const bStart = new Date(b.start_date);
        const bEnd = new Date(b.end_date);
        return start < bEnd && end > bStart;
      });
      availability[v.id] = !hasConflict;
    });
    return availability;
  }, [startDate, endDate, vehicles, allBookings]);
  
  // Auto-set pickup location when dialog opens
  const effectivePickupLocationId = pickupLocationId || (selectedLocationId !== 'all' ? selectedLocationId : locations[0]?.id || '');
  const effectivePickupLocation = locations.find(l => l.id === effectivePickupLocationId);
  const pickupLocationName = effectivePickupLocation?.name || pickupLocationText;

  const handleSubmit = async () => {
    setError(null);

    // Validate form
    const validation = validateForm([
      () => validators.required(vehicleId, 'Vehicle'),
      () => validators.required(customerName, 'Customer name'),
      () => validators.required(startDateTimeStr, 'Start date'),
      () => validators.required(endDateTimeStr, 'End date'),
      () => validators.required(pickupLocationName, 'Pickup location'),
      () => validators.dateRange(startDateTimeStr, endDateTimeStr),
      () => customerEmail ? validators.email(customerEmail) : { isValid: true },
      () => customerPhone ? validators.phone(customerPhone) : { isValid: true },
    ]);

    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    const selectedVehicle = vehicles.find(v => v.id === vehicleId);
    if (!selectedVehicle) {
      setError('Selected vehicle not found');
      return;
    }

    setLoading(true);

    try {
      const effectiveRate = getRateForDuration(
        durationType,
        Number(selectedVehicle.current_rate),
        (selectedVehicle as any).rate_3hr,
        (selectedVehicle as any).rate_6hr,
        (selectedVehicle as any).rate_multiday,
      );

      const pricing = calculateBookingTotal({
        startDate: new Date(startDateTimeStr),
        endDate: new Date(endDateTimeStr),
        dailyRate: effectiveRate,
        discountAmount: Number(discountAmount) || 0,
        gasFee: DEFAULT_GAS_FEE,
        gasFeeWaived,
        durationType,
      });

      await onSubmit({
        vehicle_id: vehicleId,
        customer_name: customerName,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        customer_id: selectedCustomerId !== 'new' ? selectedCustomerId : null,
        start_date: startDateTimeStr,
        end_date: endDateTimeStr,
        pickup_location: pickupLocationName,
        pickup_location_id: effectivePickupLocationId || null,
        dropoff_location: dropoffLocation || null,
        daily_rate: effectiveRate,
        total_value: pricing.grandTotal,
        discount_amount: pricing.discountAmount > 0 ? pricing.discountAmount : 0,
        discount_reason: pricing.discountAmount > 0 ? discountReason || null : null,
        gas_fee: DEFAULT_GAS_FEE,
        gas_fee_waived: gasFeeWaived,
        notes: notes || null,
        status: 'pending',
        rental_duration_type: durationType,
        mileage_limit: selectedVehicle.default_mileage_limit ?? 250,
        mileage_overage_fee: selectedVehicle.mileage_overage_rate ?? 1.50,
      } as any);

      // Reset form
      setVehicleId('');
      setSelectedCustomerId('new');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setStartDate(undefined);
      setStartTime('09:00');
      setEndDate(undefined);
      setEndTime('09:00');
      setPickupLocationId('');
      setPickupLocationText('');
      setDropoffLocation('');
      setNotes('');
      setError(null);
      setDurationType('daily');
      setAiExpanded(false);
      setDiscountExpanded(false);
      setDiscountAmount('');
      setDiscountReason('');
      onOpenChange(false);
      
      toast({
        title: "Success",
        description: "Booking created successfully",
      });
    } catch (err) {
      setError('Failed to create booking. Please try again.');
      console.error('Booking error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span>New Booking</span>
          </DialogTitle>
          <DialogDescription>
            Create a new booking for your fleet
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Vehicle Selection */}
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger id="vehicle">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => {
                    const hasDateSelected = startDate && endDate;
                    const isAvailable = !hasDateSelected || vehicleAvailability[v.id] !== false;
                    return (
                      <SelectItem key={v.id} value={v.id}>
                        <span className="flex items-center gap-2">
                          {v.name} - ${v.current_rate}/day
                          {hasDateSelected && !isAvailable && (
                            <span className="text-xs text-destructive font-medium">Booked</span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Duration Selector - shown after vehicle selection */}
            {selectedVehicle && (
              <div className="space-y-2">
                <Label>Rental Duration</Label>
                <div className="flex flex-wrap gap-2">
                  {getAvailableDurations(
                    (selectedVehicle as any).rate_3hr,
                    (selectedVehicle as any).rate_6hr,
                  ).map((dt) => {
                    const rate = getRateForDuration(
                      dt,
                      Number(selectedVehicle.current_rate),
                      (selectedVehicle as any).rate_3hr,
                      (selectedVehicle as any).rate_6hr,
                      (selectedVehicle as any).rate_multiday,
                    );
                    return (
                      <button
                        key={dt}
                        type="button"
                        onClick={() => { setDurationType(dt); setEndDateManuallySet(false); }}
                        className={cn(
                          "px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                          durationType === dt
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-muted"
                        )}
                      >
                        <span>{getDurationLabel(dt)}</span>
                        <span className="ml-1 opacity-75">${rate.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>
                {(durationType === '3hr' || durationType === '6hr') && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Select a pickup time — vehicle stays available for other bookings outside this window.
                  </p>
                )}
              </div>
            )}

            {/* AI Price Suggestion - Collapsible */}
            {pricingSuggestion && vehicleId && (
              <Collapsible open={aiExpanded} onOpenChange={setAiExpanded}>
                <CollapsibleTrigger asChild>
                  <button className="w-full p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between hover:bg-primary/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        AI suggests ${pricingSuggestion.suggestedRate}/day
                      </span>
                      {pricingSuggestion.suggestedRate > (selectedVehicle?.current_rate || 0) && (
                        <span className="text-xs text-success font-semibold">
                          +${pricingSuggestion.suggestedRate - (selectedVehicle?.current_rate || 0)}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      aiExpanded && "rotate-180"
                    )} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-3 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {pricingSuggestion.reasoning}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Expected:</span>
                        <span className="font-semibold text-success ml-2">{pricingSuggestion.expectedImpact}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pricingSuggestion.factors.map((factor, idx) => (
                        <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {factor}
                        </span>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        toast({
                          title: "AI Rate Applied",
                          description: `Daily rate set to $${pricingSuggestion.suggestedRate}`,
                        });
                      }}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Use AI Suggested Rate (${pricingSuggestion.suggestedRate}/day)
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={selectedCustomerId} onValueChange={handleCustomerSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingCustomers ? "Loading customers..." : "Select or add customer"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">
                    <span className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      New Customer
                    </span>
                  </SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {customer.full_name}
                        {customer.email && (
                          <span className="text-muted-foreground text-xs">({customer.email})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="customer">Customer Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customer"
                    placeholder="John Smith"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pl-10"
                    disabled={selectedCustomerId !== 'new'}
                  />
                </div>
                {selectedCustomerId !== 'new' && (
                  <p className="text-xs text-muted-foreground">
                    Auto-filled from CRM. Select "New Customer" to enter manually.
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  disabled={selectedCustomerId !== 'new'}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                {selectedCustomerId !== 'new' && (
                  <p className="text-xs text-muted-foreground">
                    Phone can be updated for this booking
                  </p>
                )}
              </div>
            </div>

            {/* Start and End Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-date">
                  {(durationType === '3hr' || durationType === '6hr') ? 'Pickup Date & Time' : 'Start Date'}
                </Label>
                <Input
                  id="start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    // Auto-calculate end time for hourly tiers
                    if (val && (durationType === '3hr' || durationType === '6hr')) {
                      const start = new Date(val);
                      const hours = durationType === '3hr' ? 3 : 6;
                      const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
                      // Format as datetime-local value
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const endVal = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                      setEndDate(endVal);
                      setEndDateManuallySet(false);
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">
                  {(durationType === '3hr' || durationType === '6hr') ? 'Return Date & Time' : 'End Date'}
                </Label>
                <Input
                  id="end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setEndDateManuallySet(true);
                  }}
                  disabled={!!(durationType === '3hr' || durationType === '6hr') && !endDateManuallySet}
                />
                {(durationType === '3hr' || durationType === '6hr') && !endDateManuallySet && startDate && (
                  <p className="text-xs text-muted-foreground">
                    Auto-set to {durationType === '3hr' ? '3' : '6'} hours after pickup
                  </p>
                )}
              </div>
            </div>

            {/* Discount Section */}
            <Collapsible open={discountExpanded} onOpenChange={setDiscountExpanded}>
              <CollapsibleTrigger asChild>
                <button className="w-full p-3 rounded-lg bg-muted/30 border border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Apply Discount</span>
                    {Number(discountAmount) > 0 && (
                      <Badge variant="secondary" className="text-xs">-${discountAmount}</Badge>
                    )}
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    discountExpanded && "rotate-180"
                  )} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="discount">Discount ($)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="discount"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="discount-reason">Reason</Label>
                      <Select value={discountReason} onValueChange={setDiscountReason}>
                        <SelectTrigger id="discount-reason">
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Promotional">Promotional</SelectItem>
                          <SelectItem value="Military Discount">Military Discount</SelectItem>
                          <SelectItem value="Employee">Employee</SelectItem>
                          <SelectItem value="Friends and Family">Friends and Family</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedVehicle && startDate && endDate && (() => {
                    const effectiveRate = getRateForDuration(
                      durationType,
                      Number(selectedVehicle.current_rate),
                      (selectedVehicle as any).rate_3hr,
                      (selectedVehicle as any).rate_6hr,
                      (selectedVehicle as any).rate_multiday,
                    );
                    const pricing = calculateBookingTotal({
                      startDate: new Date(startDate),
                      endDate: new Date(endDate),
                      dailyRate: effectiveRate,
                      discountAmount: Number(discountAmount) || 0,
                      gasFee: DEFAULT_GAS_FEE,
                      gasFeeWaived,
                      durationType,
                    });
                    if (pricing.rentalDays <= 0) return null;
                    const isHourly = durationType === '3hr' || durationType === '6hr';
                    return (
                      <div className="space-y-1 text-sm p-2 rounded-lg bg-muted/30">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {isHourly 
                              ? `${getDurationLabel(durationType)} Rate`
                              : `${pricing.rentalDays} day${pricing.rentalDays !== 1 ? 's' : ''} × $${effectiveRate.toLocaleString()}`
                            }
                          </span>
                          <span>${pricing.rentalSubtotal.toLocaleString()}</span>
                        </div>
                        {pricing.discountAmount > 0 && (
                          <div className="flex justify-between text-success">
                            <span>Discount</span>
                            <span>-${pricing.discountAmount.toLocaleString()}</span>
                          </div>
                        )}
                        {pricing.gasFee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Gas/Re-fueling Fee</span>
                            <span>${pricing.gasFee.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
                          <span>Total</span>
                          <span>${pricing.grandTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Gas Fee Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Gas/Re-fueling Fee</span>
                  <p className="text-xs text-muted-foreground">${DEFAULT_GAS_FEE.toFixed(2)} standard fee</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {gasFeeWaived && <span className="text-xs text-warning">Waived</span>}
                <Switch checked={!gasFeeWaived} onCheckedChange={(checked) => setGasFeeWaived(!checked)} />
              </div>
            </div>

            {/* Locations */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pickup">Pickup Location</Label>
                {locations.length > 0 ? (
                  <>
                    <Select value={effectivePickupLocationId} onValueChange={setPickupLocationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pickup location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            <span className="flex items-center gap-2">
                              <MapPin className="h-3 w-3" />
                              {loc.name}
                              {loc.is_default && " (Default)"}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentLocation && selectedLocationId !== 'all' && (
                      <p className="text-xs text-muted-foreground">
                        Auto-assigned to current location
                      </p>
                    )}
                  </>
                ) : (
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="pickup"
                      placeholder="Downtown, Airport, etc."
                      value={pickupLocationText}
                      onChange={(e) => setPickupLocationText(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dropoff">Drop-off Location (optional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dropoff"
                    placeholder="Same as pickup"
                    value={dropoffLocation}
                    onChange={(e) => setDropoffLocation(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Special requests or additional information..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !vehicleId || !customerName || !startDate || !endDate || (!effectivePickupLocationId && !pickupLocationText)}
            className="min-h-[44px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Booking'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
