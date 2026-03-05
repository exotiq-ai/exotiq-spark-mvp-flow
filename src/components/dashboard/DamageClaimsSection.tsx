import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useFleet } from "@/contexts/FleetContext";
import { useTeam } from "@/contexts/TeamContext";
import { DamageReportDialog } from "@/components/dialogs/DamageReportDialog";
import { VehicleDetailsDialog } from "@/components/dialogs/VehicleDetailsDialog";
import { VehicleThumbnail } from "@/components/common/VehicleThumbnail";
import {
  AlertTriangle,
  Plus,
  Search,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

export const DamageClaimsSection = () => {
  const { damageClaims, vehicles, maintenance } = useLocationFilteredFleet();
  const { refreshDamageClaims } = useFleet();
  const { currentTeam } = useTeam();

  // Page-level realtime subscription for damage_claims table
  useRealtimeTable('damage_claims', {
    teamId: currentTeam?.id,
    onUpdate: refreshDamageClaims,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{
    id: string;
    name: string;
    make: string;
    model: string;
    year: number;
    status: string;
    dailyRate: number;
  } | null>(null);
  const [selectedVehicleClaims, setSelectedVehicleClaims] = useState<typeof damageClaims>([]);
  const [selectedVehicleMaintenance, setSelectedVehicleMaintenance] = useState<typeof maintenance>([]);

  const handleVehicleClick = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      // Get all claims for this vehicle
      const vehicleClaims = damageClaims.filter(c => c.vehicle_id === vehicleId);
      // Get all maintenance for this vehicle
      const vehicleMaintenance = maintenance.filter(m => m.vehicle_id === vehicleId);
      
      setSelectedVehicle({
        id: vehicle.id,
        name: vehicle.name,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        status: vehicle.status,
        dailyRate: Number(vehicle.current_rate),
      });
      setSelectedVehicleClaims(vehicleClaims);
      setSelectedVehicleMaintenance(vehicleMaintenance);
      setShowVehicleDetails(true);
    }
  };

  const filteredClaims = damageClaims.filter(claim => {
    const vehicle = vehicles.find(v => v.id === claim.vehicle_id);
    const vehicleName = vehicle?.name?.toLowerCase() || '';
    const description = claim.description?.toLowerCase() || '';
    const searchLower = searchTerm.toLowerCase().trim();
    
    const matchesSearch = vehicleName.includes(searchLower) || description.includes(searchLower);
    const matchesStatus = statusFilter === "all" || claim.claim_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const claimStats = {
    total: damageClaims.length,
    open: damageClaims.filter(c => c.claim_status === 'open').length,
    pending: damageClaims.filter(c => c.claim_status === 'pending_review').length,
    resolved: damageClaims.filter(c => c.claim_status === 'resolved').length,
    totalCost: damageClaims.reduce((sum, c) => sum + (Number(c.actual_cost) || Number(c.estimated_cost) || 0), 0)
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="h-4 w-4" />;
      case 'pending_review': return <AlertTriangle className="h-4 w-4" />;
      case 'resolved': return <CheckCircle2 className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-warning/10 text-warning border-warning/30';
      case 'pending_review': return 'bg-info/10 text-info border-info/30';
      case 'resolved': return 'bg-success/10 text-success border-success/30';
      case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-success/10 text-success border-success/30';
      case 'moderate': return 'bg-warning/10 text-warning border-warning/30';
      case 'major': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  return (
    <>
      <DamageReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        vehicles={vehicles}
      />

      {selectedVehicle && (
        <VehicleDetailsDialog
          open={showVehicleDetails}
          onOpenChange={setShowVehicleDetails}
          vehicleName={selectedVehicle.name}
          vehicleDetails={selectedVehicle}
          damageClaims={selectedVehicleClaims}
          maintenanceSchedules={selectedVehicleMaintenance}
        />
      )}

      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="card-module p-3 sm:p-4">
            <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span className="text-xs sm:text-sm text-muted-foreground">Total Claims</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold">{claimStats.total}</div>
          </Card>

          <Card className="card-module p-3 sm:p-4">
            <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-warning flex-shrink-0" />
              <span className="text-xs sm:text-sm text-muted-foreground">Open</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold">{claimStats.open}</div>
          </Card>

          <Card className="card-module p-3 sm:p-4">
            <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-info flex-shrink-0" />
              <span className="text-xs sm:text-sm text-muted-foreground">Pending</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold">{claimStats.pending}</div>
          </Card>

          <Card className="card-module p-3 sm:p-4">
            <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0" />
              <span className="text-xs sm:text-sm text-muted-foreground">Total Cost</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold">${claimStats.totalCost.toLocaleString()}</div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="card-premium p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6">
            <h3 className="text-base sm:text-lg font-semibold">Damage Claims</h3>
            <Button onClick={() => setShowReportDialog(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Claim
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search claims..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'open', 'pending_review', 'resolved'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all' ? 'All' : 
                   status === 'pending_review' ? 'Pending Review' : 
                   status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Claims List */}
          <div className="space-y-3">
            {filteredClaims.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No damage claims found</p>
              </div>
            ) : (
              filteredClaims.map((claim) => {
                const vehicle = vehicles.find(v => v.id === claim.vehicle_id);
                return (
                  <div
                    key={claim.id}
                    className="p-3 sm:p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                      <VehicleThumbnail 
                        vehicleName={vehicle?.name || ''} 
                        imageUrl={vehicle?.image_url}
                        size="avatar"
                        onClick={() => handleVehicleClick(claim.vehicle_id)}
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 
                            className="font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleVehicleClick(claim.vehicle_id)}
                          >
                            {vehicle?.name || 'Unknown Vehicle'}
                          </h4>
                          <Badge className={getSeverityColor(claim.severity)}>
                            {claim.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{claim.description}</p>
                      </div>
                      <Badge className={`${getStatusColor(claim.claim_status || 'open')} flex-shrink-0`}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(claim.claim_status || 'open')}
                          {claim.claim_status === 'pending_review' ? 'Pending Review' : 
                           (claim.claim_status || 'open').replace('_', ' ')}
                        </span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <span className="ml-2 font-medium capitalize">{claim.claim_type}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Estimated:</span>
                        <span className="ml-2 font-medium">${claim.estimated_cost || 0}</span>
                      </div>
                      {claim.actual_cost && (
                        <div>
                          <span className="text-muted-foreground">Actual:</span>
                          <span className="ml-2 font-medium">${claim.actual_cost}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Reported:</span>
                        <span className="ml-2 font-medium">
                          {format(new Date(claim.reported_date || ''), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {claim.insurance_claim_number && (
                        <div className="col-span-1 sm:col-span-2">
                          <span className="text-muted-foreground">Insurance #:</span>
                          <span className="ml-2 font-medium">{claim.insurance_claim_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </>
  );
};
