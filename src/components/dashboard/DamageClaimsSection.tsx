import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFleet } from "@/contexts/FleetContext";
import { DamageReportDialog } from "@/components/dialogs/DamageReportDialog";
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
  const { damageClaims, vehicles } = useFleet();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showReportDialog, setShowReportDialog] = useState(false);

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

      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-module p-4">
            <div className="flex items-center space-x-3 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Claims</span>
            </div>
            <div className="text-2xl font-bold">{claimStats.total}</div>
          </Card>

          <Card className="card-module p-4">
            <div className="flex items-center space-x-3 mb-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <span className="text-sm text-muted-foreground">Open</span>
            </div>
            <div className="text-2xl font-bold">{claimStats.open}</div>
          </Card>

          <Card className="card-module p-4">
            <div className="flex items-center space-x-3 mb-2">
              <Clock className="h-5 w-5 text-info" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <div className="text-2xl font-bold">{claimStats.pending}</div>
          </Card>

          <Card className="card-module p-4">
            <div className="flex items-center space-x-3 mb-2">
              <DollarSign className="h-5 w-5 text-destructive" />
              <span className="text-sm text-muted-foreground">Total Cost</span>
            </div>
            <div className="text-2xl font-bold">${claimStats.totalCost.toLocaleString()}</div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="card-premium p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold">Damage Claims</h3>
            <Button onClick={() => setShowReportDialog(true)}>
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
            <div className="flex gap-2">
              {['all', 'open', 'pending_review', 'resolved'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all' ? 'All' : status.replace('_', ' ')}
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
                    className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{vehicle?.name || 'Unknown Vehicle'}</h4>
                          <Badge className={getSeverityColor(claim.severity)}>
                            {claim.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{claim.description}</p>
                      </div>
                      <Badge className={getStatusColor(claim.claim_status || 'open')}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(claim.claim_status || 'open')}
                          {claim.claim_status?.replace('_', ' ') || 'open'}
                        </span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
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
                        <div className="col-span-2">
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
