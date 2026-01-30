import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VehicleThumbnail } from '@/components/common/VehicleThumbnail';
import { 
  MoreHorizontal, 
  DollarSign, 
  Calendar, 
  Wrench,
  ClipboardCheck,
  Droplets,
  Fuel,
  CheckCircle2,
  UserCheck,
  Car,
  LogIn,
  Loader2,
  ChevronRight,
  Camera,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { OpsStatus, OPS_STATUS_CONFIG } from '@/hooks/useVehicleOpsStatus';
import { formatDistanceToNow } from 'date-fns';

interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  status: string;
  ops_status?: string | null;
  current_rate: number;
  suggested_rate?: number | null;
  license_plate?: string | null;
  image_url?: string | null;
  last_ops_update?: string | null;
}

interface Booking {
  id: string;
  vehicle_id: string;
  customer_name: string;
  start_date: string;
  end_date: string;
  status: string | null;
}

interface FleetVehicleCardProps {
  vehicle: Vehicle;
  activeBooking?: Booking | null;
  nextBooking?: Booking | null;
  taskCount?: number;
  photoCount?: number;
  onEditPrice: (vehicle: Vehicle) => void;
  onCreateTask: (vehicle: Vehicle) => void;
  onViewDetails: (vehicle: Vehicle) => void;
  onStatusChange: (vehicle: Vehicle, newStatus: OpsStatus) => void;
  isOpsMode?: boolean;
  className?: string;
}

const OpsStatusIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardCheck,
  Droplets,
  Fuel,
  CheckCircle2,
  UserCheck,
  Car,
  LogIn,
  Loader2,
};

export const FleetVehicleCard = ({
  vehicle,
  activeBooking,
  nextBooking,
  taskCount = 0,
  photoCount,
  onEditPrice,
  onCreateTask,
  onViewDetails,
  onStatusChange,
  isOpsMode = false,
  className,
}: FleetVehicleCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const opsStatus = (vehicle.ops_status || 'clean_ready') as OpsStatus;
  const statusConfig = OPS_STATUS_CONFIG[opsStatus] || OPS_STATUS_CONFIG.clean_ready;
  const StatusIcon = OpsStatusIcon[statusConfig.icon] || CheckCircle2;

  // Booking status
  const isRented = vehicle.status === 'rented' || activeBooking;
  const isInMaintenance = vehicle.status === 'maintenance';
  
  // Time since last update (remove "about" prefix for cleaner display)
  const lastUpdateText = vehicle.last_ops_update 
    ? formatDistanceToNow(new Date(vehicle.last_ops_update), { addSuffix: true }).replace('about ', '')
    : null;

  // Next booking countdown
  const nextBookingText = nextBooking 
    ? formatDistanceToNow(new Date(nextBooking.start_date), { addSuffix: true })
    : null;

  // Quick status actions for ops mode
  const quickStatusActions = OPS_STATUS_CONFIG[opsStatus]?.nextStates || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: isOpsMode ? 1 : 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card 
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpsMode 
            ? 'p-3 touch-manipulation' 
            : 'p-4 hover:shadow-lg hover:border-primary/20',
          isHovered && !isOpsMode && 'ring-1 ring-primary/20',
          className
        )}
      >
        <div className={cn(
          'flex gap-4',
          isOpsMode && 'gap-3'
        )}>
          {/* Thumbnail */}
          <div className="relative flex-shrink-0">
            <VehicleThumbnail 
              vehicleName={vehicle.name}
              imageUrl={vehicle.image_url}
              size={isOpsMode ? 'md' : 'lg'}
              onClick={() => onViewDetails(vehicle)}
              badge={taskCount > 0 ? (
                <Badge 
                  variant="destructive" 
                  className="h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {taskCount}
                </Badge>
              ) : undefined}
            />
            
            {/* Ops Status Badge - positioned over thumbnail */}
            <div className={cn(
              'absolute -bottom-1 -right-1 rounded-full p-1',
              statusConfig.bgColor,
              statusConfig.borderColor,
              'border'
            )}>
              <StatusIcon className={cn('h-3 w-3', statusConfig.color)} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {vehicle.name}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
              </div>

              {/* Desktop: Price + Actions */}
              {!isOpsMode && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">
                      ${vehicle.current_rate}
                      <span className="text-xs font-normal text-muted-foreground">/day</span>
                    </div>
                    {vehicle.suggested_rate && vehicle.suggested_rate > vehicle.current_rate && (
                      <div className="text-xs text-success">
                        AI: ${vehicle.suggested_rate}
                      </div>
                    )}
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditPrice(vehicle)}>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Edit Pricing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCreateTask(vehicle)}>
                        <ClipboardCheck className="h-4 w-4 mr-2" />
                        Create Task
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onViewDetails(vehicle)}>
                        View Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* Status Row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Booking Status */}
              <Badge 
                variant="outline" 
                className={cn(
                  'text-xs capitalize',
                  isRented && 'border-primary/50 bg-primary/10 text-primary',
                  isInMaintenance && 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  !isRented && !isInMaintenance && 'border-success/50 bg-success/10 text-success'
                )}
              >
                {isRented ? 'Rented' : isInMaintenance ? 'Maintenance' : 'Available'}
              </Badge>

              {/* Ops Status */}
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  statusConfig.bgColor,
                  statusConfig.borderColor,
                  statusConfig.color
                )}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>

              {/* Photo Count Badge */}
              {photoCount !== undefined && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    'text-xs gap-1',
                    photoCount >= 8 && 'border-success/50 text-success',
                    photoCount >= 4 && photoCount < 8 && 'border-amber-500/50 text-amber-600',
                    photoCount < 4 && 'border-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  <Camera className="h-3 w-3" />
                  {photoCount}/11
                </Badge>
              )}

              {/* License Plate */}
              {vehicle.license_plate && (
                <span className="text-xs text-muted-foreground">
                  {vehicle.license_plate}
                </span>
              )}
            </div>

            {/* Info Row - Desktop Only - Fixed height for consistency */}
            {!isOpsMode && (
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground h-4">
                {activeBooking && (
                  <div className="flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">
                      {activeBooking.customer_name}
                    </span>
                  </div>
                )}
                {nextBooking && !activeBooking && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Next: {nextBookingText}</span>
                  </div>
                )}
                {lastUpdateText && (
                  <div className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    <span>{lastUpdateText}</span>
                  </div>
                )}
              </div>
            )}

            {/* Ops Mode: Quick Actions */}
            {isOpsMode && quickStatusActions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {quickStatusActions.slice(0, 2).map((nextStatus) => {
                  const nextConfig = OPS_STATUS_CONFIG[nextStatus];
                  const NextIcon = OpsStatusIcon[nextConfig.icon] || CheckCircle2;
                  return (
                    <Button
                      key={nextStatus}
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-9 text-xs touch-manipulation',
                        nextConfig.bgColor,
                        nextConfig.borderColor,
                        nextConfig.color,
                        'hover:opacity-80'
                      )}
                      onClick={() => onStatusChange(vehicle, nextStatus)}
                    >
                      <NextIcon className="h-3.5 w-3.5 mr-1.5" />
                      {nextConfig.label}
                    </Button>
                  );
                })}
                
                {/* More actions button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => onCreateTask(vehicle)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Mobile: Chevron for navigation */}
          {isOpsMode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-full self-center flex-shrink-0"
              onClick={() => onViewDetails(vehicle)}
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
