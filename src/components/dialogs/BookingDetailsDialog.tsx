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
            Booking ID: {booking.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Vehicle Info */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center space-x-3 mb-2">
              <Car className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">{booking.vehicle}</span>
            </div>
            <div className="text-2xl font-bold text-primary">{booking.value}</div>
            <div className="text-sm text-muted-foreground">Daily rate</div>
          </div>

          {/* Customer Info */}
          <div className="space-y-3">
            <div className="font-semibold text-sm text-muted-foreground">Customer Information</div>
            <div className="space-y-2">
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{booking.customer}</div>
                  <div className="text-xs text-muted-foreground">Full Name</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">+1 (555) 123-4567</div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">customer@email.com</div>
                  <div className="text-xs text-muted-foreground">Email</div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Booking Details */}
          <div className="space-y-3">
            <div className="font-semibold text-sm text-muted-foreground">Booking Details</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/30">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{booking.date || 'Today'}</div>
                  <div className="text-xs text-muted-foreground">Date</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/30">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{booking.time}</div>
                  <div className="text-xs text-muted-foreground">Time</div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/30">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{booking.location}</div>
                <div className="text-xs text-muted-foreground">Pickup Location</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message Customer
          </Button>
          
          {booking.status === 'pending' && onUpdateStatus && (
            <>
              <Button 
                variant="outline"
                className="w-full sm:w-auto text-destructive hover:text-destructive"
                onClick={() => {
                  onUpdateStatus(booking.id, 'cancelled');
                  onOpenChange(false);
                }}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                className="w-full sm:w-auto bg-success hover:bg-success/90"
                onClick={() => {
                  onUpdateStatus(booking.id, 'confirmed');
                  onOpenChange(false);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm
              </Button>
            </>
          )}
          
          {booking.status === 'confirmed' && onUpdateStatus && (
            <Button 
              className="w-full sm:w-auto"
              onClick={() => {
                onUpdateStatus(booking.id, 'completed');
                onOpenChange(false);
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Complete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
