import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  Car,
  Activity,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import type { CustomerPreview, BookingPreview, VehiclePreview } from '@/hooks/useEntityEnrichment';
import { useMoney } from '@/hooks/useMoney';

interface EntityPreviewProps {
  type: 'customer' | 'booking' | 'vehicle';
  data?: CustomerPreview | BookingPreview | VehiclePreview;
  isLoading?: boolean;
  error?: string;
}

export const EntityPreview = ({ type, data, isLoading, error }: EntityPreviewProps) => {
  const { money } = useMoney();
  if (error) {
    return (
      <div className="p-3 space-y-2 min-w-[250px]">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 space-y-2 min-w-[250px]">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-40" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-3 space-y-2 min-w-[250px]">
        <p className="text-sm text-muted-foreground">No details available</p>
      </div>
    );
  }

  if (type === 'customer' && 'full_name' in data) {
    const customer = data as CustomerPreview;
    return (
      <div className="p-3 space-y-3 min-w-[280px]">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              {customer.full_name}
            </h4>
            <Badge 
              variant="outline" 
              className={`mt-1 text-xs ${
                customer.customer_status === 'active' 
                  ? 'bg-success/10 text-success border-success/20' 
                  : 'bg-muted'
              }`}
            >
              {customer.customer_status}
            </Badge>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{customer.email}</span>
          </div>
          
          {customer.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span>{customer.phone}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {customer.total_bookings} booking{customer.total_bookings !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-success" />
              <span className="font-medium text-success">
                {money(customer.lifetime_value)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'booking' && 'customer_name' in data) {
    const booking = data as BookingPreview;
    return (
      <div className="p-3 space-y-3 min-w-[280px]">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-600" />
              Booking
            </h4>
            <Badge 
              variant="outline" 
              className={`mt-1 text-xs ${
                booking.status === 'confirmed' 
                  ? 'bg-success/10 text-success border-success/20'
                  : booking.status === 'pending'
                  ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                  : booking.status === 'completed'
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  : 'bg-muted'
              }`}
            >
              {booking.status}
            </Badge>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-3 w-3 flex-shrink-0" />
            <span>{booking.customer_name}</span>
          </div>

          {booking.vehicle_make && booking.vehicle_model && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Car className="h-3 w-3 flex-shrink-0" />
              <span>{booking.vehicle_make} {booking.vehicle_model}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>
              {format(new Date(booking.start_date), 'MMM d')} - {format(new Date(booking.end_date), 'MMM d, yyyy')}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-muted-foreground">Total Value</span>
            <span className="font-medium text-success">
              ${booking.total_value.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'vehicle' && 'make' in data) {
    const vehicle = data as VehiclePreview;
    return (
      <div className="p-3 space-y-3 min-w-[280px]">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Car className="h-4 w-4 text-orange-600" />
              {vehicle.make} {vehicle.model}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">{vehicle.year}</p>
          </div>
          <Badge 
            variant="outline" 
            className={`text-xs ${
              vehicle.status === 'available' 
                ? 'bg-success/10 text-success border-success/20'
                : vehicle.status === 'booked'
                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
            }`}
          >
            {vehicle.status}
          </Badge>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Daily Rate
            </span>
            <span className="font-medium">${vehicle.current_rate}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Utilization
            </span>
            <span className="font-medium">{vehicle.utilization}%</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
