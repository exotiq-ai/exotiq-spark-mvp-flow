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

interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (booking: {
    vehicle: string;
    customer: string;
    time: string;
    location: string;
    status: 'confirmed' | 'pending';
    value: string;
    date: string;
  }) => void;
}

export const NewBookingDialog = ({
  open,
  onOpenChange,
  onSubmit
}: NewBookingDialogProps) => {
  const [vehicle, setVehicle] = useState('');
  const [customer, setCustomer] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [rate, setRate] = useState('');

  const vehicles = [
    'McLaren 720S - $450/day',
    'Ferrari 488 - $520/day',
    'Lamborghini Huracán - $480/day',
    'Porsche 911 GT3 - $380/day'
  ];

  const handleSubmit = () => {
    if (!vehicle || !customer || !date || !startTime || !endTime || !location || !rate) {
      return;
    }

    const vehicleName = vehicle.split(' - ')[0];
    
    onSubmit({
      vehicle: vehicleName,
      customer,
      time: `${startTime} - ${endTime}`,
      location,
      status: 'pending',
      value: `$${rate}`,
      date
    });

    // Reset form
    setVehicle('');
    setCustomer('');
    setDate('');
    setStartTime('');
    setEndTime('');
    setLocation('');
    setRate('');
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
            <Select value={vehicle} onValueChange={setVehicle}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
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
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-time">Start</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">End</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
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
                value={location}
                onChange={(e) => setLocation(e.target.value)}
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
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!vehicle || !customer || !date || !startTime || !endTime || !location || !rate}>
            Create Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
