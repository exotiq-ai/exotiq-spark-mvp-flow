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
import { Calendar, User, MapPin, Clock, DollarSign } from 'lucide-react';
import { TablesInsert } from '@/integrations/supabase/types';

interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (booking: TablesInsert<"bookings">) => Promise<void>;
}

export const NewBookingDialog = ({
  open,
  onOpenChange,
  onSubmit
}: NewBookingDialogProps) => {
  const [vehicleId, setVehicleId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dailyRate, setDailyRate] = useState('');

  const vehicles = [
    { id: '1', name: 'McLaren 720S', rate: 450 },
    { id: '2', name: 'Ferrari 488', rate: 520 },
    { id: '3', name: 'Lamborghini Huracán', rate: 480 },
    { id: '4', name: 'Porsche 911 GT3', rate: 380 }
  ];

  const handleSubmit = async () => {
    if (!vehicleId || !customerName || !startDate || !endDate || !pickupLocation || !dailyRate) {
      return;
    }

    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const totalValue = Number(dailyRate) * days;

    await onSubmit({
      vehicle_id: vehicleId,
      customer_name: customerName,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      pickup_location: pickupLocation,
      daily_rate: Number(dailyRate),
      total_value: totalValue,
      status: 'pending',
      user_id: '' // Will be set by context
    });

    // Reset form
    setVehicleId('');
    setCustomerName('');
    setStartDate('');
    setEndDate('');
    setPickupLocation('');
    setDailyRate('');
    onOpenChange(false);
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

        <div className="space-y-4 py-4">
          {/* Vehicle Selection */}
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle</Label>
            <Select value={vehicleId} onValueChange={(value) => {
              setVehicleId(value);
              const vehicle = vehicles.find(v => v.id === value);
              if (vehicle) setDailyRate(vehicle.rate.toString());
            }}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} - ${v.rate}/day
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Name */}
          <div className="space-y-2">
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

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Pickup Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                placeholder="Downtown, Airport, etc."
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Rate */}
          <div className="space-y-2">
            <Label htmlFor="rate">Daily Rate</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="rate"
                type="number"
                placeholder="450"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!vehicleId || !customerName || !startDate || !endDate || !pickupLocation || !dailyRate}>
            Create Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
