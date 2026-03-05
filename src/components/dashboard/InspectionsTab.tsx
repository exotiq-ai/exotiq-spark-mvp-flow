import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeam } from '@/contexts/TeamContext';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/common/EmptyState';
import { VehicleThumbnail } from '@/components/common/VehicleThumbnail';
import { InspectionWidget } from '@/components/inspections';
import {
  ClipboardCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Camera,
  AlertTriangle,
  Timer,
  CheckCircle2,
  Calendar,
  Car,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';

type Vehicle = Tables<'vehicles'>;

interface InspectionsTabProps {
  vehicles: Vehicle[];
}

export const InspectionsTab = ({ vehicles }: InspectionsTabProps) => {
  const { currentTeam } = useTeam();
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [inspectionDirection, setInspectionDirection] = useState<'check_in' | 'check_out'>('check_in');
  const [selectedInspectionVehicle, setSelectedInspectionVehicle] = useState<Vehicle | null>(null);
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');

  // Fetch recent inspections
  const { data: recentInspections, refetch: refetchInspections } = useQuery({
    queryKey: ['recent-inspections', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam?.id) return [];
      
      const { data, error } = await supabase
        .from('vehicle_inspections')
        .select(`
          *,
          vehicles(id, name, make, model, year, status, image_url)
        `)
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching inspections:', error);
        return [];
      }

      // Fetch photo and damage counts separately for each inspection
      const inspectionsWithCounts = await Promise.all(
        (data || []).map(async (inspection) => {
          const [photoResult, damageResult] = await Promise.all([
            supabase
              .from('inspection_photos')
              .select('id', { count: 'exact', head: true })
              .eq('inspection_id', inspection.id),
            supabase
              .from('inspection_damage_items')
              .select('id, severity', { count: 'exact' })
              .eq('inspection_id', inspection.id)
          ]);

          return {
            ...inspection,
            photoCount: photoResult.count || 0,
            damageCount: damageResult.count || 0,
            damageItems: damageResult.data || []
          };
        })
      );

      return inspectionsWithCounts;
    },
    enabled: !!currentTeam?.id,
  });

  // Compute stats
  const inspectionStats = useMemo(() => {
    if (!recentInspections?.length) {
      return { total: 0, pendingReview: 0, damageCount: 0, avgTime: '-' };
    }

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlyInspections = recentInspections.filter(
      i => new Date(i.created_at!) >= thisMonth
    );

    const pendingReview = recentInspections.filter(
      i => i.status === 'completed' && !i.reviewed_at
    ).length;

    const damageCount = recentInspections.reduce(
      (acc, i) => acc + (i.damageCount || 0),
      0
    );

    // Calculate average completion time
    const completedWithTime = recentInspections.filter(
      i => i.started_at && i.completed_at
    );
    let avgTime = '-';
    if (completedWithTime.length > 0) {
      const totalMs = completedWithTime.reduce((acc, i) => {
        const start = new Date(i.started_at!).getTime();
        const end = new Date(i.completed_at!).getTime();
        return acc + (end - start);
      }, 0);
      const avgMs = totalMs / completedWithTime.length;
      const avgMinutes = Math.round(avgMs / 60000);
      avgTime = `~${avgMinutes} min`;
    }

    return {
      total: monthlyInspections.length,
      pendingReview,
      damageCount,
      avgTime,
    };
  }, [recentInspections]);

  // Filter vehicles by search term
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearchTerm.trim()) return vehicles;
    const term = vehicleSearchTerm.toLowerCase();
    return vehicles.filter(
      v =>
        v.name.toLowerCase().includes(term) ||
        v.make.toLowerCase().includes(term) ||
        v.model.toLowerCase().includes(term)
    );
  }, [vehicles, vehicleSearchTerm]);

  // Sort vehicles based on direction
  const sortedVehicles = useMemo(() => {
    return [...filteredVehicles].sort((a, b) => {
      if (inspectionDirection === 'check_out') {
        // Rented vehicles first for check-out
        if (a.status === 'rented' && b.status !== 'rented') return -1;
        if (b.status === 'rented' && a.status !== 'rented') return 1;
      } else {
        // Available vehicles first for check-in
        if (a.status === 'available' && b.status !== 'available') return -1;
        if (b.status === 'available' && a.status !== 'available') return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [filteredVehicles, inspectionDirection]);

  const handleStartInspection = (direction: 'check_in' | 'check_out') => {
    setInspectionDirection(direction);
    setVehicleSearchTerm('');
    setShowVehicleSelector(true);
  };

  const handleVehicleSelect = (vehicle: Vehicle) => {
    setSelectedInspectionVehicle(vehicle);
    setShowVehicleSelector(false);
  };

  const handleInspectionComplete = () => {
    setSelectedInspectionVehicle(null);
    refetchInspections();
  };

  const getVehicleDisplayName = (vehicle: { name?: string; make?: string; model?: string; year?: number } | null) => {
    if (!vehicle) return 'Unknown Vehicle';
    return vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  };

  // If a vehicle is selected, show the InspectionWidget
  if (selectedInspectionVehicle) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <VehicleThumbnail vehicleName={selectedInspectionVehicle.name} imageUrl={selectedInspectionVehicle.image_url} size="lg" />
            <div>
              <h3 className="font-semibold">{selectedInspectionVehicle.name}</h3>
              <p className="text-sm text-muted-foreground">
                {inspectionDirection === 'check_in' ? 'Check-In' : 'Check-Out'} Inspection
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setSelectedInspectionVehicle(null)}>
            Cancel
          </Button>
        </div>
        <InspectionWidget
          vehicleId={selectedInspectionVehicle.id}
          vehicleName={selectedInspectionVehicle.name}
          direction={inspectionDirection}
          onComplete={handleInspectionComplete}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">This Month</span>
          </div>
          <div className="text-2xl font-bold">{inspectionStats.total}</div>
        </Card>
        
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-warning" />
            <span className="text-xs text-muted-foreground">Pending Review</span>
          </div>
          <div className="text-2xl font-bold">{inspectionStats.pendingReview}</div>
        </Card>
        
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-muted-foreground">Damage Items</span>
          </div>
          <div className="text-2xl font-bold">{inspectionStats.damageCount}</div>
        </Card>
        
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-1">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Avg Time</span>
          </div>
          <div className="text-2xl font-bold">{inspectionStats.avgTime}</div>
        </Card>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card 
          className="card-premium p-6 border-success/30 hover:border-success/50 cursor-pointer transition-colors"
          onClick={() => handleStartInspection('check_in')}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <ArrowDownToLine className="h-6 w-6 text-success" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Check-In Inspection</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Vehicle arriving - document condition before handoff
              </p>
              <Button className="bg-success hover:bg-success/90 text-success-foreground">
                <Camera className="h-4 w-4 mr-2" />
                Start Check-In
              </Button>
            </div>
          </div>
        </Card>

        <Card 
          className="card-premium p-6 border-primary/30 hover:border-primary/50 cursor-pointer transition-colors"
          onClick={() => handleStartInspection('check_out')}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <ArrowUpFromLine className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Check-Out Inspection</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Vehicle departing - document condition at return
              </p>
              <Button className="btn-premium">
                <Camera className="h-4 w-4 mr-2" />
                Start Check-Out
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Inspections */}
      <Card className="card-module p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Recent Inspections
          </h3>
          {recentInspections && recentInspections.length > 0 && (
            <Badge variant="secondary">{recentInspections.length}</Badge>
          )}
        </div>

        {!recentInspections || recentInspections.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-16 w-16" />}
            title="No Inspections Yet"
            description="Start documenting vehicle conditions with guided photo capture"
            action={{
              label: "Start First Inspection",
              onClick: () => handleStartInspection('check_in'),
            }}
          />
        ) : (
          <div className="space-y-3">
            {recentInspections.map((inspection) => (
              <div
                key={inspection.id}
                className="p-3 sm:p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <VehicleThumbnail
                    vehicleName={getVehicleDisplayName(inspection.vehicles)}
                    imageUrl={inspection.vehicles?.image_url}
                    size="avatar"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {getVehicleDisplayName(inspection.vehicles)}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          inspection.inspection_direction === 'check_in'
                            ? 'border-success/50 text-success'
                            : 'border-primary/50 text-primary'
                        }
                      >
                        {inspection.inspection_direction === 'check_in' ? 'Check-In' : 'Check-Out'}
                      </Badge>
                      {inspection.status === 'completed' && !inspection.reviewed_at && (
                        <Badge variant="outline" className="border-warning/50 text-warning">
                          Pending Review
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {inspection.created_at
                          ? formatDistanceToNow(new Date(inspection.created_at), { addSuffix: true })
                          : '-'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        {inspection.photoCount} photos
                      </span>
                      {inspection.damageCount > 0 && (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {inspection.damageCount} damage
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Vehicle Selector Modal */}
      <Dialog open={showVehicleSelector} onOpenChange={setShowVehicleSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Select Vehicle for {inspectionDirection === 'check_in' ? 'Check-In' : 'Check-Out'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              value={vehicleSearchTerm}
              onChange={(e) => setVehicleSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px] -mx-4 px-4">
            {sortedVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Car className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No vehicles found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    onClick={() => handleVehicleSelect(vehicle)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <VehicleThumbnail vehicleName={vehicle.name} imageUrl={vehicle.image_url} size="avatar" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{vehicle.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        vehicle.status === 'available'
                          ? 'border-success/50 text-success'
                          : vehicle.status === 'rented'
                          ? 'border-primary/50 text-primary'
                          : 'border-muted-foreground/50 text-muted-foreground'
                      }
                    >
                      {vehicle.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setShowVehicleSelector(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
