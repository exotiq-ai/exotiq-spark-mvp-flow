import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getVehicleImage } from "@/lib/vehicleImageMapping";
import { VehiclePhotoManager } from "@/components/photos/VehiclePhotoManager";
import { BulkUploadModal } from "@/components/photos/BulkUploadModal";
import { PhotoGalleryStrip } from "@/components/photos/PhotoGalleryStrip";
import { QuickPriceEditorContent } from "@/components/pricing/QuickPriceEditorContent";
import { VehicleTasksList } from "@/components/fleet/VehicleTasksList";
import { useVehiclePhotos } from "@/hooks/useVehiclePhotos";
import { PermissionGuard } from "@/components/common/PermissionGuard";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Info,
  History,
  ClipboardList,
  Car,
  MapPin,
  Hash,
  Palette,
  Edit,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import type { VehicleTask } from "@/hooks/useFleetTasks";
import type { OpsStatus } from "@/hooks/useVehicleOpsStatus";

// Ops status config
const OPS_STATUS_OPTIONS: { value: OpsStatus; label: string; color: string }[] = [
  { value: "clean_ready", label: "Clean & Ready", color: "bg-success/15 text-success border-success/20" },
  { value: "needs_wash", label: "Needs Wash", color: "bg-warning/15 text-warning border-warning/20" },
  { value: "needs_fuel", label: "Needs Fuel", color: "bg-accent/15 text-accent border-accent/20" },
  { value: "pending_inspection", label: "Pending Inspection", color: "bg-destructive/15 text-destructive border-destructive/20" },
  { value: "renter_has", label: "With Renter", color: "bg-primary/15 text-primary border-primary/20" },
  { value: "check_in_required", label: "Check-In Required", color: "bg-muted text-muted-foreground border-border" },
];

interface VehicleImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleName: string;
  vehicleId?: string;
  vehicleDetails?: {
    make: string;
    model: string;
    year: number;
    status: string;
    dailyRate: number;
    utilization?: number;
    revenue?: number;
    returnDate?: string;
    color?: string;
    license_plate?: string;
    vin?: string;
    location?: string;
    ops_status?: string | null;
    suggested_rate?: number | null;
    maintenanceAlerts?: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  };
  // Command center callbacks
  onEditPrice?: (vehicle: any) => void;
  onApplyRate?: (vehicleId: string, newRate: number) => Promise<void>;
  onCreateTask?: (vehicle: any) => void;
  onStatusChange?: (vehicle: any, newStatus: OpsStatus) => void;
  onEdit?: (vehicle: any) => void;
  vehicleTasks?: VehicleTask[];
  onCompleteTask?: (taskId: string) => void;
  onClaimTask?: (taskId: string) => void;
  onViewTask?: (task: VehicleTask) => void;
  currentUserId?: string;
  activeBooking?: any;
  nextBooking?: any;
}

export function VehicleImageDialog({
  open,
  onOpenChange,
  vehicleName,
  vehicleId,
  vehicleDetails,
  onApplyRate,
  onCreateTask,
  onStatusChange,
  onEdit,
  vehicleTasks = [],
  onCompleteTask,
  onClaimTask,
  onViewTask,
  currentUserId,
  activeBooking,
  nextBooking,
}: VehicleImageDialogProps) {
  const staticImageUrl = getVehicleImage(vehicleName);
  const [activeTab, setActiveTab] = useState<string>("details");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { photos, loading: photosLoading, refetch } = useVehiclePhotos({
    vehicleId: vehicleId || '',
    realtime: true
  });

  const heroPhoto = useMemo(() =>
    photos.find(p => p.photo_type === 'hero'),
    [photos]
  );

  const mainImageUrl = useMemo(() => {
    if (heroPhoto?.url) return heroPhoto.url;
    return staticImageUrl;
  }, [heroPhoto, staticImageUrl]);

  useEffect(() => {
    if (open) setActiveTab("details");
  }, [open]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  // Build a vehicle object for pricing content
  const vehicleForPricing = vehicleId && vehicleDetails ? {
    id: vehicleId,
    name: vehicleName,
    make: vehicleDetails.make,
    model: vehicleDetails.model,
    year: vehicleDetails.year,
    status: vehicleDetails.status,
    current_rate: vehicleDetails.dailyRate,
    suggested_rate: vehicleDetails.suggested_rate,
    utilization: vehicleDetails.utilization,
    image_url: mainImageUrl,
  } : null;

  const hasCommandFeatures = !!(onApplyRate || onCreateTask || onStatusChange);
  const activeTaskCount = vehicleTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
  const currentOpsStatus = vehicleDetails?.ops_status || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0">
        {/* Header with compact hero */}
        <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
          <div className="flex items-start gap-4">
            {/* Compact hero image */}
            <div className="h-20 w-28 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
              {mainImageUrl ? (
                <img
                  src={mainImageUrl}
                  alt={vehicleName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    if (staticImageUrl && e.currentTarget.src !== staticImageUrl) {
                      e.currentTarget.src = staticImageUrl;
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Car className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl truncate">{vehicleName}</DialogTitle>
              {vehicleDetails && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {vehicleDetails.year} {vehicleDetails.make} {vehicleDetails.model}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                {vehicleDetails && (
                  <Badge variant="outline" className="capitalize text-xs">
                    {vehicleDetails.status}
                  </Badge>
                )}
                {currentOpsStatus && currentOpsStatus !== 'not_set' && (
                  <Badge variant="outline" className={cn("text-xs",
                    OPS_STATUS_OPTIONS.find(o => o.value === currentOpsStatus)?.color
                  )}>
                    {OPS_STATUS_OPTIONS.find(o => o.value === currentOpsStatus)?.label || currentOpsStatus}
                  </Badge>
                )}
                {!currentOpsStatus && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Not Set</Badge>
                )}
              </div>
            </div>
            {vehicleDetails?.dailyRate != null && (
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-muted-foreground">Rate</div>
                <div className="text-xl font-bold">${vehicleDetails.dailyRate}</div>
                <div className="text-xs text-muted-foreground">/day</div>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Tabs */}
        {vehicleId ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-6 pt-4">
              <TabsList className={cn(
                "grid w-full",
                hasCommandFeatures ? "grid-cols-4" : "grid-cols-3"
              )}>
                <TabsTrigger value="details" className="gap-1.5 text-xs">
                  <Info className="h-3.5 w-3.5" />
                  Details
                </TabsTrigger>
                {hasCommandFeatures && (
                  <TabsTrigger value="pricing" className="gap-1.5 text-xs">
                    <DollarSign className="h-3.5 w-3.5" />
                    Pricing
                  </TabsTrigger>
                )}
                <TabsTrigger value="tasks" className="gap-1.5 text-xs relative">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Tasks
                  {activeTaskCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                      {activeTaskCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="photos" className="gap-1.5 text-xs">
                  <Camera className="h-3.5 w-3.5" />
                  Photos
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Details Tab */}
              <TabsContent value="details" className="px-6 pb-6 pt-4 space-y-4 mt-0">
                {/* Vehicle Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {vehicleDetails?.color && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border">
                      <Palette className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Color</div>
                        <div className="text-sm font-medium">{vehicleDetails.color}</div>
                      </div>
                    </div>
                  )}
                  {vehicleDetails?.license_plate && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border">
                      <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Plate</div>
                        <div className="text-sm font-medium">{vehicleDetails.license_plate}</div>
                      </div>
                    </div>
                  )}
                  {vehicleDetails?.location && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Location</div>
                        <div className="text-sm font-medium truncate">{vehicleDetails.location}</div>
                      </div>
                    </div>
                  )}
                  {vehicleDetails?.vin && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border col-span-2">
                      <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">VIN</div>
                        <div className="text-xs font-mono">{vehicleDetails.vin}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ops Status Quick Change */}
                {onStatusChange && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Status</div>
                      <div className="flex flex-wrap gap-1.5">
                        {OPS_STATUS_OPTIONS.map((opt) => (
                          <Button
                            key={opt.value}
                            variant="outline"
                            size="sm"
                            className={cn(
                              "text-xs h-7 px-2.5",
                              currentOpsStatus === opt.value && opt.color
                            )}
                            onClick={() => onStatusChange(
                              { id: vehicleId, name: vehicleName, ...vehicleDetails },
                              opt.value
                            )}
                          >
                            {currentOpsStatus === opt.value && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Active Booking */}
                {activeBooking && (
                  <>
                    <Separator />
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Active Rental</span>
                      </div>
                      <p className="text-sm text-foreground">{activeBooking.customer_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(activeBooking.start_date)} — {formatDate(activeBooking.end_date)}
                      </p>
                    </div>
                  </>
                )}

                {/* Next Booking */}
                {nextBooking && !activeBooking && (
                  <>
                    <Separator />
                    <div className="p-3 rounded-lg bg-accent/5 border border-accent/15">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Calendar className="h-4 w-4 text-accent" />
                        <span className="text-sm font-medium">Next Booking</span>
                      </div>
                      <p className="text-sm text-foreground">{nextBooking.customer_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Starts {formatDistanceToNow(new Date(nextBooking.start_date), { addSuffix: true })}
                      </p>
                    </div>
                  </>
                )}

                {/* Performance Metrics */}
                {(vehicleDetails?.utilization !== undefined || vehicleDetails?.revenue !== undefined) && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                      {vehicleDetails?.utilization !== undefined && (
                        <div className="p-3 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/15">
                          <div className="flex items-center gap-1.5 mb-1">
                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs text-muted-foreground">Utilization</span>
                          </div>
                          <div className="text-2xl font-bold">{vehicleDetails.utilization}%</div>
                        </div>
                      )}
                      {vehicleDetails?.revenue !== undefined && (
                        <div className="p-3 rounded-lg bg-gradient-to-br from-success/5 to-success/10 border border-success/15">
                          <div className="flex items-center gap-1.5 mb-1">
                            <DollarSign className="h-3.5 w-3.5 text-success" />
                            <span className="text-xs text-muted-foreground">Revenue</span>
                          </div>
                          <div className="text-2xl font-bold">${vehicleDetails.revenue?.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Maintenance Alerts */}
                {vehicleDetails?.maintenanceAlerts && vehicleDetails.maintenanceAlerts.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      {vehicleDetails.maintenanceAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border",
                            alert.severity === 'high'
                              ? "bg-destructive/5 border-destructive/20"
                              : "bg-warning/5 border-warning/20"
                          )}
                        >
                          <AlertTriangle className={cn(
                            "h-4 w-4 flex-shrink-0",
                            alert.severity === 'high' ? "text-destructive" : "text-warning"
                          )} />
                          <span className="text-sm">{alert.description}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Edit Vehicle Button */}
                {onEdit && (
                  <>
                    <Separator />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        onEdit({ id: vehicleId, name: vehicleName, ...vehicleDetails });
                        onOpenChange(false);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Vehicle Details
                    </Button>
                  </>
                )}

                {/* Change History */}
                <Separator />
                <PermissionGuard minRole="manager" fallback={null}>
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <History className="h-4 w-4" />
                      Change History
                      <ArrowRight className="h-3 w-3 ml-auto group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="mt-3">
                      <VehicleChangeHistory vehicleId={vehicleId} />
                    </div>
                  </details>
                </PermissionGuard>
              </TabsContent>

              {/* Pricing Tab */}
              {hasCommandFeatures && (
                <TabsContent value="pricing" className="px-6 pb-6 pt-4 mt-0">
                  {vehicleForPricing && onApplyRate ? (
                    <QuickPriceEditorContent
                      vehicle={vehicleForPricing}
                      onApplyRate={onApplyRate}
                      compact
                    />
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Pricing editor not available
                    </div>
                  )}

                  {/* Link to MotorIQ for advanced pricing */}
                  <div className="mt-4 p-3 rounded-lg bg-muted/30 border flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">Need date-specific pricing?</p>
                      <p className="text-[10px] text-muted-foreground">Use MotorIQ for demand-based pricing calendars</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted/50">
                      MotorIQ →
                    </Badge>
                  </div>
                </TabsContent>
              )}

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="px-6 pb-6 pt-4 mt-0">
                <VehicleTasksList
                  tasks={vehicleTasks}
                  onCreateTask={() => {
                    onCreateTask?.({ id: vehicleId, name: vehicleName, ...vehicleDetails });
                  }}
                  onCompleteTask={(taskId) => onCompleteTask?.(taskId)}
                  onClaimTask={(taskId) => onClaimTask?.(taskId)}
                  onViewTask={(task) => onViewTask?.(task)}
                  currentUserId={currentUserId}
                />
              </TabsContent>

              {/* Photos Tab */}
              <TabsContent value="photos" className="px-6 pb-6 pt-4 mt-0">
                <VehiclePhotoManager
                  vehicleId={vehicleId}
                  vehicleName={vehicleName}
                  onUploadClick={() => setShowUploadModal(true)}
                />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          /* Fallback for no vehicleId */
          <div className="px-6 pb-6 space-y-4">
            {vehicleDetails && (
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <p className="text-sm text-muted-foreground">Make & Model</p>
                  <p className="font-medium">{vehicleDetails.make} {vehicleDetails.model}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Year</p>
                  <p className="font-medium">{vehicleDetails.year}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Daily Rate</p>
                  <p className="font-medium">${vehicleDetails.dailyRate}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bulk Upload Modal */}
        {vehicleId && (
          <BulkUploadModal
            open={showUploadModal}
            onOpenChange={setShowUploadModal}
            vehicles={[{ id: vehicleId, name: vehicleName }]}
            preSelectedVehicleId={vehicleId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Vehicle Change History (kept from original)
function VehicleChangeHistory({ vehicleId }: { vehicleId: string }) {
  const [changes, setChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChanges = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('vehicle_change_log' as any)
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(20);
      setChanges(data || []);
      setLoading(false);
    };
    fetchChanges();
  }, [vehicleId]);

  const formatFieldName = (field: string) =>
    field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formatValue = (field: string, value: string | null) => {
    if (value === null || value === '') return '—';
    if (field === 'current_rate' || field === 'mileage_overage_rate') return `$${value}`;
    return value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="text-center py-6">
        <History className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">No changes recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {changes.map((change) => (
        <div key={change.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-muted/30">
          <div className="flex-shrink-0 mt-1">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">{formatFieldName(change.field_name)}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatValue(change.field_name, change.old_value)} → {formatValue(change.field_name, change.new_value)}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {change.change_source || 'manual'}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(change.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
