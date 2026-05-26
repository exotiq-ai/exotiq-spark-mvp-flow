import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { VehicleThumbnail } from '@/components/common/VehicleThumbnail';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { 
  MoreHorizontal, 
  DollarSign, 
  Calendar, 
  
  Pencil,
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
  Trash2,
  Sparkles,
  CircleDashed,
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
  /** The 24hr/daily rate. Preserved name for backwards compatibility (48+ references). */
  current_rate: number;
  suggested_rate?: number | null;
  license_plate?: string | null;
  image_url?: string | null;
  last_ops_update?: string | null;
  rate_3hr?: number | null;
  rate_6hr?: number | null;
  rate_multiday?: number | null;
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
  onEdit?: (vehicle: Vehicle) => void;
  onDelete?: (vehicle: Vehicle) => void;
  isOpsMode?: boolean;
  isSelected?: boolean;
  onSelectChange?: (vehicleId: string, selected: boolean) => void;
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
  CircleDashed,
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
  onEdit,
  onDelete,
  isOpsMode = false,
  isSelected = false,
  onSelectChange,
  className,
}: FleetVehicleCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const isRetired = vehicle.status === 'retired';
  const opsStatus = (vehicle.ops_status || 'not_set') as OpsStatus;
  const statusConfig = OPS_STATUS_CONFIG[opsStatus] || OPS_STATUS_CONFIG.not_set;
  const StatusIcon = OpsStatusIcon[statusConfig.icon] || CircleDashed;

  // Derive display status from real DB values
  const isInMaintenance = vehicle.status === 'maintenance';
  const hasActiveBooking = !!activeBooking;
  const isWithRenter = opsStatus === 'renter_has';
  
  // Determine the display status label and styling
  const getStatusDisplay = () => {
    if (isRetired) return { label: 'Retired', className: 'border-muted-foreground/50 bg-muted/50 text-muted-foreground' };
    if (isWithRenter) return { label: 'With Renter', className: 'border-primary/50 bg-primary/10 text-primary' };
    if (hasActiveBooking) return { label: 'Booked', className: 'border-primary/50 bg-primary/10 text-primary' };
    if (isInMaintenance) return { label: 'Maintenance', className: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400' };
    return { label: 'Available', className: 'border-success/50 bg-success/10 text-success' };
  };

  const statusDisplay = getStatusDisplay();
  



  // Next booking countdown
  const nextBookingText = nextBooking 
    ? formatDistanceToNow(new Date(nextBooking.start_date), { addSuffix: true })
    : null;

  // Quick status actions for ops mode (hide for retired)
  const quickStatusActions = !isRetired ? (OPS_STATUS_CONFIG[opsStatus]?.nextStates || []) : [];

  // Has Rari pricing suggestion
  const hasRariSuggestion = !isRetired && vehicle.suggested_rate != null && vehicle.suggested_rate !== vehicle.current_rate;

  // ============================================================
  // OPS MODE (mobile) — unchanged horizontal layout
  // ============================================================
  if (isOpsMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        <Card
          className={cn(
            'overflow-hidden transition-all duration-200 p-4 touch-manipulation',
            isRetired && 'opacity-50 grayscale',
            className
          )}
        >
          <div className="flex gap-3">
            <div className="relative flex-shrink-0">
              <VehicleThumbnail
                vehicleName={vehicle.name}
                imageUrl={vehicle.image_url}
                size="md"
                onClick={() => onViewDetails(vehicle)}
                badge={taskCount > 0 ? (
                  <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {taskCount}
                  </Badge>
                ) : undefined}
              />
              {!isRetired && (
                <div className={cn('absolute -bottom-1 -right-1 rounded-full p-1 border', statusConfig.bgColor, statusConfig.borderColor)}>
                  <StatusIcon className={cn('h-3 w-3', statusConfig.color)} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{vehicle.name}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {!isRetired && opsStatus !== 'not_set' ? (
                  <Badge variant="outline" className={cn('text-xs', statusConfig.bgColor, statusConfig.borderColor, statusConfig.color)}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                ) : (
                  <Badge variant="outline" className={cn('text-xs', statusDisplay.className)}>
                    {statusDisplay.label}
                  </Badge>
                )}
                {vehicle.license_plate && (
                  <span className="text-xs text-muted-foreground">{vehicle.license_plate}</span>
                )}
              </div>

              {!isRetired && quickStatusActions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {quickStatusActions.slice(0, 2).map((nextStatus) => {
                    const nextConfig = OPS_STATUS_CONFIG[nextStatus];
                    const NextIcon = OpsStatusIcon[nextConfig.icon] || CheckCircle2;
                    return (
                      <Button
                        key={nextStatus}
                        variant="outline"
                        size="sm"
                        className={cn('h-9 text-xs touch-manipulation', nextConfig.bgColor, nextConfig.borderColor, nextConfig.color, 'hover:opacity-80')}
                        onClick={() => onStatusChange(vehicle, nextStatus)}
                      >
                        <NextIcon className="h-3.5 w-3.5 mr-1.5" />
                        {nextConfig.label}
                      </Button>
                    );
                  })}
                  <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => onCreateTask(vehicle)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-full self-center flex-shrink-0"
              onClick={() => onViewDetails(vehicle)}
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  // ============================================================
  // GRID MODE (desktop) — redesigned vertical card
  // ============================================================
  const opsLabel = !isRetired && opsStatus !== 'not_set' ? statusConfig.label : null;
  const photoBadgeColor = photoCount === undefined
    ? ''
    : photoCount >= 8
      ? 'text-success'
      : photoCount >= 4
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: isRetired ? 0 : -2 }}
      transition={{ duration: 0.2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card
        className={cn(
          'overflow-hidden transition-all duration-300 group p-0',
          !isRetired && 'hover:shadow-xl hover:border-primary/20',
          isRetired && 'opacity-50 grayscale',
          className
        )}
      >
        {/* Image section */}
        <div
          className="relative w-full aspect-[16/10] bg-muted overflow-hidden cursor-pointer"
          onClick={() => onViewDetails(vehicle)}
        >
          <VehicleThumbnail
            vehicleName={vehicle.name}
            imageUrl={vehicle.image_url}
            size="full"
            className="!rounded-none w-full h-full"
          />

          {/* Subtle gradient for badge legibility */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent" />

          {/* Top-left: selection checkbox OR status badge */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            {onSelectChange ? (
              <div
                className="bg-background/90 backdrop-blur-sm rounded-md p-1 shadow-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectChange(vehicle.id, !!checked)}
                  aria-label={`Select ${vehicle.name}`}
                />
              </div>
            ) : null}
            <Badge
              variant="outline"
              className={cn(
                'text-xs backdrop-blur-md shadow-sm border',
                statusDisplay.className
              )}
            >
              {statusDisplay.label}
            </Badge>
          </div>

          {/* Top-right: actions menu */}
          <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-background/80 backdrop-blur-md hover:bg-background shadow-sm"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <PermissionGuard minRole="manager">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(vehicle)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Vehicle
                    </DropdownMenuItem>
                  )}
                </PermissionGuard>
                {!isRetired && (
                  <>
                    <DropdownMenuItem onClick={() => onEditPrice(vehicle)}>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Edit Pricing
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCreateTask(vehicle)}>
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      Create Task
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onViewDetails(vehicle)}>
                  View Details
                </DropdownMenuItem>
                <PermissionGuard role="admin">
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(vehicle)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Vehicle
                      </DropdownMenuItem>
                    </>
                  )}
                </PermissionGuard>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Task badge — bottom-right */}
          {taskCount > 0 && (
            <div className="absolute bottom-3 right-3">
              <Badge variant="destructive" className="shadow-sm">
                {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
              </Badge>
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="p-4 space-y-2">
          {/* Name + price row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-foreground truncate leading-tight cursor-pointer hover:text-primary transition-colors"
                onClick={() => onViewDetails(vehicle)}
                title={vehicle.name}
              >
                {vehicle.name}
              </h3>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
            </div>

            {!isRetired && (
              <div className="flex items-start gap-1 flex-shrink-0">
                <div className="text-right">
                  <div className="text-lg font-bold text-foreground leading-tight">
                    ${vehicle.current_rate.toLocaleString()}
                    <span className="text-xs font-normal text-muted-foreground">/day</span>
                  </div>
                  {(vehicle.rate_3hr || vehicle.rate_6hr) && (
                    <div className="flex gap-1.5 justify-end mt-0.5">
                      {vehicle.rate_3hr && (
                        <span className="text-[10px] text-muted-foreground">3h ${vehicle.rate_3hr}</span>
                      )}
                      {vehicle.rate_6hr && (
                        <span className="text-[10px] text-muted-foreground">6h ${vehicle.rate_6hr}</span>
                      )}
                    </div>
                  )}
                </div>
                {hasRariSuggestion && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-primary hover:text-primary -mt-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPrice(vehicle);
                          }}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Rari has a pricing suggestion</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>

          {/* Meta row — combined, muted */}
          {!isRetired && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap pt-1">
              {opsLabel && (
                <span className="inline-flex items-center gap-1">
                  <StatusIcon className={cn('h-3 w-3', statusConfig.color)} />
                  <span className={statusConfig.color}>{opsLabel}</span>
                </span>
              )}

              {photoCount !== undefined && (
                <>
                  {opsLabel && <span className="text-muted-foreground/40">·</span>}
                  <span className={cn('inline-flex items-center gap-1', photoBadgeColor)}>
                    <Camera className="h-3 w-3" />
                    {photoCount}/11
                  </span>
                </>
              )}

              {activeBooking && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                    <Car className="h-3 w-3" />
                    {activeBooking.customer_name}
                  </span>
                </>
              )}

              {nextBooking && !activeBooking && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Next {nextBookingText}
                  </span>
                </>
              )}

              {vehicle.license_plate && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{vehicle.license_plate}</span>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
