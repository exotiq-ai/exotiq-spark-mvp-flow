import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { VehicleImageDialog } from "./VehicleImageDialog";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Car,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface Booking {
  id: string;
  vehicle: string;
  customer: string;
  time: string;
  location: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  value: string;
  date?: string;
}

interface BookingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  onUpdateStatus?: (bookingId: string, status: Booking['status']) => void;
}

export const BookingDetailsDialog = ({
  open,
  onOpenChange,
  booking,
  onUpdateStatus
}: BookingDetailsDialogProps) => {
  const [showVehicleImage, setShowVehicleImage] = useState(false);

  if (!booking) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-success/10 text-success border-success/30';
      case 'pending': return 'bg-warning/10 text-warning border-warning/30';
      case 'completed': return 'bg-primary/10 text-primary border-primary/30';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return 'bg-muted/10 text-muted-foreground';
    }
  };

  return (
    <>
      <VehicleImageDialog
        open={showVehicleImage}
        onOpenChange={setShowVehicleImage}
        vehicleName={booking.vehicle}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Booking Details</DialogTitle>
              <Badge className={getStatusColor(booking.status)}>
                {booking.status.toUpperCase()}
              </Badge>
            </div>
            <DialogDescription>
              Complete booking information and management options
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Vehicle Info */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">Vehicle</div>
                  <div 
                    className="font-medium text-lg cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setShowVehicleImage(true)}
                  >
                    {booking.vehicle}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground mb-1">Customer</div>
                  <div className="font-medium text-lg mb-3">{booking.customer}</div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>+1 (555) 123-4567</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{booking.customer.toLowerCase().replace(' ', '.')}@email.com</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Date</span>
                </div>
                <div className="font-medium">{booking.date || 'Today'}</div>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Time</span>
                </div>
                <div className="font-medium">{booking.time}</div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Pickup Location</span>
              </div>
              <div className="font-medium">{booking.location}</div>
            </div>

            <Separator />

            {/* Booking Value */}
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
              <span className="text-muted-foreground">Booking Value</span>
              <span className="text-2xl font-bold text-primary">{booking.value}</span>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {/* Handle message */}}
              className="w-full sm:w-auto"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Message Customer
            </Button>

            {booking.status === 'pending' && onUpdateStatus && (
              <>
                <Button
                  variant="outline"
                  onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                  className="w-full sm:w-auto text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={() => onUpdateStatus(booking.id, 'confirmed')}
                  className="w-full sm:w-auto"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm
                </Button>
              </>
            )}

            {booking.status === 'confirmed' && onUpdateStatus && (
              <Button
                onClick={() => onUpdateStatus(booking.id, 'completed')}
                className="w-full sm:w-auto"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};