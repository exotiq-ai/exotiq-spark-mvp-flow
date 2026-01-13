import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getVehicleImage } from "@/lib/vehicleImageMapping";
import { ShareWithTeamDialog } from "@/components/dialogs/ShareWithTeamDialog";
import { 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle,
  Wrench,
  MessageSquare,
  ExternalLink,
  FileText,
  Clock,
  User
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DamageClaim {
  id: string;
  claim_type: string;
  description: string;
  severity: string;
  claim_status: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  reported_date: string | null;
  resolution_notes: string | null;
}

interface MaintenanceSchedule {
  id: string;
  maintenance_type: string;
  scheduled_date: string;
  status: string | null;
  notes: string | null;
  estimated_cost: number | null;
}

interface VehicleDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleName: string;
  vehicleDetails?: {
    id: string;
    make: string;
    model: string;
    year: number;
    status: string;
    dailyRate: number;
  };
  damageClaims?: DamageClaim[];
  maintenanceSchedules?: MaintenanceSchedule[];
}

export function VehicleDetailsDialog({
  open,
  onOpenChange,
  vehicleName,
  vehicleDetails,
  damageClaims = [],
  maintenanceSchedules = [],
}: VehicleDetailsDialogProps) {
  const imageUrl = getVehicleImage(vehicleName);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedClaimForShare, setSelectedClaimForShare] = useState<DamageClaim | null>(null);

  const activeClaims = damageClaims.filter(c => c.claim_status !== 'resolved');
  const upcomingMaintenance = maintenanceSchedules.filter(m => m.status !== 'completed');

  const handleShareClaim = (claim: DamageClaim) => {
    setSelectedClaimForShare(claim);
    setShowShareDialog(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'open': return 'bg-warning/10 text-warning border-warning/30';
      case 'pending_review': return 'bg-info/10 text-info border-info/30';
      case 'resolved': return 'bg-success/10 text-success border-success/30';
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">{vehicleName}</DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Vehicle Image */}
              {imageUrl ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border shadow-lg">
                  <img
                    src={imageUrl}
                    alt={vehicleName}
                    className="object-cover w-full h-full"
                  />
                </div>
              ) : (
                <div className="aspect-video w-full bg-muted rounded-xl flex items-center justify-center">
                  <p className="text-muted-foreground">No image available</p>
                </div>
              )}
              
              {vehicleDetails && (
                <>
                  {/* Basic Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b">
                    <div>
                      <p className="text-sm text-muted-foreground">Make & Model</p>
                      <p className="font-medium">{vehicleDetails.make} {vehicleDetails.model}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Year</p>
                      <p className="font-medium">{vehicleDetails.year}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant={vehicleDetails.status === 'available' ? 'default' : 'secondary'} className="capitalize">
                        {vehicleDetails.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Daily Rate</p>
                      <p className="font-medium">${vehicleDetails.dailyRate.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Active Damage Claims */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      Active Damage Claims ({activeClaims.length})
                    </h4>
                    
                    {activeClaims.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/20 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                        <p className="text-sm font-medium text-success">No active damage claims</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeClaims.map(claim => (
                          <Card key={claim.id} className="p-4 border-warning/30 bg-warning/5">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2">
                                <Badge className={getSeverityColor(claim.severity)}>
                                  {claim.severity}
                                </Badge>
                                <Badge className={getStatusColor(claim.claim_status)}>
                                  {claim.claim_status === 'pending_review' ? 'Pending Review' : claim.claim_status || 'open'}
                                </Badge>
                              </div>
                            </div>

                            <div className="space-y-2 mb-4">
                              <div className="flex items-center gap-2 text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium capitalize">{claim.claim_type.replace('_', ' ')}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{claim.description}</p>
                              
                              <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span>Reported: {formatDate(claim.reported_date)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                                  <span>Est. Cost: ${claim.estimated_cost?.toLocaleString() || 0}</span>
                                </div>
                              </div>

                              {claim.resolution_notes && (
                                <div className="p-3 mt-2 rounded-lg bg-muted/30">
                                  <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                                  <p className="text-sm">{claim.resolution_notes}</p>
                                </div>
                              )}
                            </div>

                            <Separator className="my-3" />

                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm">
                                <FileText className="h-3.5 w-3.5 mr-1.5" />
                                Update Status
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleShareClaim(claim)}
                              >
                                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                Share with Team
                              </Button>
                              <Button variant="outline" size="sm">
                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                View Full Claim
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Maintenance Status */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-info" />
                      Maintenance Status ({upcomingMaintenance.length} scheduled)
                    </h4>
                    
                    {upcomingMaintenance.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/20 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-success">No scheduled maintenance</p>
                          <p className="text-xs text-muted-foreground">Vehicle is in excellent condition</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {upcomingMaintenance.map(schedule => (
                          <div 
                            key={schedule.id}
                            className="p-3 rounded-lg bg-info/10 border border-info/20"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm capitalize">
                                {schedule.maintenance_type.replace('_', ' ')}
                              </span>
                              <Badge variant="outline" className="text-xs capitalize">
                                {schedule.status || 'scheduled'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(schedule.scheduled_date)}
                              </span>
                              {schedule.estimated_cost && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${schedule.estimated_cost.toLocaleString()}
                                </span>
                              )}
                            </div>
                            {schedule.notes && (
                              <p className="text-xs text-muted-foreground mt-2">{schedule.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Share with Team Dialog */}
      {selectedClaimForShare && vehicleDetails && (
        <ShareWithTeamDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          claim={selectedClaimForShare}
          vehicleName={vehicleName}
          vehicleId={vehicleDetails.id}
        />
      )}
    </>
  );
}
