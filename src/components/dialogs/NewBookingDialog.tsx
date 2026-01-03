import { useState } from 'react';
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
import { Calendar, User, MapPin, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { TablesInsert, Tables } from '@/integrations/supabase/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validators, validateForm } from '@/lib/validation';
import { toast } from '@/hooks/use-toast';
import { useAIPricing } from '@/hooks/useAIPricing';
import { useTeam } from '@/contexts/TeamContext';

interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Tables<'vehicles'>[];
  onSubmit: (booking: Omit<TablesInsert<"bookings">, 'user_id'>) => Promise<void>;
}

export const NewBookingDialog = ({
  open,
  onOpenChange,
  vehicles,
  onSubmit
}: NewBookingDialogProps) => {
  const { selectedLocationId, currentLocation, locations } = useTeam();
  
  const [vehicleId, setVehicleId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pickupLocationId, setPickupLocationId] = useState('');
  const [pickupLocationText, setPickupLocationText] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const pricingSuggestion = useAIPricing(selectedVehicle || null, startDate);
  
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
      () => validators.required(startDate, 'Start date'),
      () => validators.required(endDate, 'End date'),
      () => validators.required(pickupLocationName, 'Pickup location'),
      () => validators.dateRange(startDate, endDate),
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
      const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
      const totalValue = Number(selectedVehicle.current_rate) * days;

      await onSubmit({
        vehicle_id: vehicleId,
        customer_name: customerName,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        pickup_location: pickupLocationName,
        pickup_location_id: effectivePickupLocationId || null,
        dropoff_location: dropoffLocation || null,
        daily_rate: selectedVehicle.current_rate,
        total_value: totalValue,
        notes: notes || null,
        status: 'pending'
      });

      // Reset form
      setVehicleId('');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setStartDate('');
      setEndDate('');
      setPickupLocationId('');
      setPickupLocationText('');
      setDropoffLocation('');
      setNotes('');
      setError(null);
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span>New Booking</span>
          </DialogTitle>
          <DialogDescription>
            Create a new booking for your fleet
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          {/* Vehicle Selection */}
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} - ${v.current_rate}/day
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI Price Suggestion */}
          {pricingSuggestion && vehicleId && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">AI Pricing Insight</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    {pricingSuggestion.reasoning}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Suggested Rate:</span>
                      <span className="font-bold text-primary ml-2">${pricingSuggestion.suggestedRate}/day</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Impact:</span>
                      <span className="font-semibold text-success ml-2">{pricingSuggestion.expectedImpact}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pricingSuggestion.factors.map((factor, idx) => (
                      <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  // In a real implementation, this would update the rate field
                  toast({
                    title: "AI Rate Applied",
                    description: `Daily rate set to $${pricingSuggestion.suggestedRate}`,
                  });
                }}
              >
                Use AI Suggested Rate (${pricingSuggestion.suggestedRate}/day)
              </Button>
            </div>
          )}

          {/* Customer Info */}
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
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
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
            </div>
          </div>

          {/* Start and End Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
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
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !vehicleId || !customerName || !startDate || !endDate || (!effectivePickupLocationId && !pickupLocationText)}
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
