import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { useFleetTasks } from '@/hooks/useFleetTasks';
import { useVehicleOpsStatus, OpsStatus } from '@/hooks/useVehicleOpsStatus';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { FleetVehicleCard } from './FleetVehicleCard';
import { FleetFilters, FleetFiltersState, ViewMode } from './FleetFilters';
import { TaskQueue } from './TaskQueue';
import { CreateVehicleTaskDialog } from '@/components/dialogs/CreateVehicleTaskDialog';
import { QuickPriceEditorDialog } from '@/components/dialogs/QuickPriceEditorDialog';
import { VehicleImageDialog } from '@/components/dialogs/VehicleImageDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { SkeletonVehicleCard } from '@/components/ui/skeleton-specialized';
import { ModuleTabs, TabsContent } from '@/components/common/ModuleTabs';
import { PhotoHubTab } from '@/components/photos/PhotoHubTab';
import {
  Car,
  Smartphone,
  Monitor,
  RefreshCw,
  Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  profile?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export const FleetPageEnhanced = () => {
  const isMobile = useIsMobile();
  const { vehicles, bookings, loading, applyPriceOptimization, refreshData } = useLocationFilteredFleet();
  const { tasks, myTasks, unassignedTasks, createTask, updateTaskStatus, claimTask } = useFleetTasks();
  const { updateOpsStatus } = useVehicleOpsStatus();
  const { currentTeam } = useTeam();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Fetch team members
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!currentTeam?.id) return;
      
      const { data } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('team_id', currentTeam.id)
        .eq('is_active', true);
      
      if (data) {
        setTeamMembers(data.map(m => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          profile: m.profiles as any
        })));
      }
    };
    
    fetchTeamMembers();
  }, [currentTeam?.id]);

  // Tab state
  const [activeTab, setActiveTab] = useState('fleet');

  // View state
  const [isOpsMode, setIsOpsMode] = useState(isMobile);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<FleetFiltersState>({
    search: '',
    bookingStatus: [],
    opsStatus: [],
    sortBy: 'name',
    sortDesc: false,
  });

  // Dialog state
  const [priceEditVehicle, setPriceEditVehicle] = useState<any>(null);
  const [taskVehicle, setTaskVehicle] = useState<any>(null);
  const [detailsVehicle, setDetailsVehicle] = useState<any>(null);

  // Filter and sort vehicles
  const filteredVehicles = useMemo(() => {
    let result = [...vehicles];

    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(search) ||
        v.make?.toLowerCase().includes(search) ||
        v.model?.toLowerCase().includes(search) ||
        v.license_plate?.toLowerCase().includes(search)
      );
    }

    if (filters.bookingStatus.length > 0) {
      result = result.filter(v => filters.bookingStatus.includes(v.status || 'available'));
    }

    if (filters.opsStatus.length > 0) {
      result = result.filter(v => filters.opsStatus.includes((v.ops_status || 'clean_ready') as OpsStatus));
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rate':
          comparison = (a.current_rate || 0) - (b.current_rate || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'updated':
          comparison = new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
          break;
      }
      return filters.sortDesc ? -comparison : comparison;
    });

    return result;
  }, [vehicles, filters]);

  // Create vehicle map for task queue
  const vehicleMap = useMemo(() => {
    return vehicles.reduce((acc, v) => {
      acc[v.id] = { name: v.name };
      return acc;
    }, {} as Record<string, { name: string }>);
  }, [vehicles]);

  const getActiveBooking = (vehicleId: string) => {
    return bookings.find(b => b.vehicle_id === vehicleId && (b.status === 'active' || b.status === 'confirmed'));
  };

  const getNextBooking = (vehicleId: string) => {
    const now = new Date();
    return bookings
      .filter(b => b.vehicle_id === vehicleId && new Date(b.start_date) > now && b.status !== 'cancelled')
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0];
  };

  const taskCountMap = useMemo(() => {
    return tasks.reduce((acc, t) => {
      if (t.status !== 'completed' && t.status !== 'cancelled') {
        acc[t.vehicle_id] = (acc[t.vehicle_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [tasks]);

  const handleStatusChange = async (vehicle: any, newStatus: OpsStatus) => {
    await updateOpsStatus(vehicle.id, newStatus);
  };

  const handleCompleteTask = async (taskId: string) => {
    await updateTaskStatus(taskId, 'completed');
  };

  // Prepare vehicles for PhotoHubTab
  const vehiclesForPhotos = useMemo(() => {
    return vehicles.map(v => ({
      id: v.id,
      name: v.name,
      make: v.make,
      model: v.model,
      year: v.year,
    }));
  }, [vehicles]);

  // Module tabs configuration
  const moduleTabs = [
    { id: 'fleet', label: 'Fleet', shortLabel: 'Fleet', icon: Car },
    { id: 'photos', label: 'Photos', shortLabel: 'Photos', icon: Camera },
  ];

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <SkeletonVehicleCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Car className="h-6 w-6 text-primary" />
            Fleet Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage vehicle availability, status, and pricing
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Ops Mode Toggle - only show on Fleet tab */}
          {activeTab === 'fleet' && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
              <Monitor className={cn('h-4 w-4', !isOpsMode && 'text-primary')} />
              <Switch
                checked={isOpsMode}
                onCheckedChange={setIsOpsMode}
                aria-label="Toggle ops mode"
              />
              <Smartphone className={cn('h-4 w-4', isOpsMode && 'text-primary')} />
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {isOpsMode ? 'Ops Mode' : 'Admin View'}
              </span>
            </div>
          )}

          <Button variant="outline" size="icon" onClick={() => refreshData()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Module Tabs */}
      <ModuleTabs
        tabs={moduleTabs}
        defaultValue="fleet"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        {/* Fleet Tab Content */}
        <TabsContent value="fleet" className="space-y-6 mt-0">
          {/* Ops Mode: My Tasks */}
          {isOpsMode && myTasks.length > 0 && (
            <Card className="p-4 border-primary/20 bg-primary/5">
              <TaskQueue
                tasks={myTasks}
                vehicleMap={vehicleMap}
                onCompleteTask={handleCompleteTask}
                onClaimTask={claimTask}
                onViewTask={() => {}}
                title="My Tasks"
                emptyMessage="No tasks assigned to you"
                compact
              />
            </Card>
          )}

          {/* Filters */}
          <FleetFilters
            filters={filters}
            onFiltersChange={setFilters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            vehicleCount={vehicles.length}
            filteredCount={filteredVehicles.length}
            isOpsMode={isOpsMode}
          />

          {/* Vehicle Grid/List */}
          {filteredVehicles.length === 0 ? (
            <EmptyState
              icon={Car}
              title="No vehicles found"
              description={filters.search ? "Try adjusting your search or filters" : "Add your first vehicle to get started"}
            />
          ) : (
            <div className={cn(
              'grid gap-4',
              isOpsMode 
                ? 'grid-cols-1' 
                : viewMode === 'grid'
                  ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                  : 'grid-cols-1'
            )}>
              <AnimatePresence mode="popLayout">
                {filteredVehicles.map((vehicle) => (
                  <FleetVehicleCard
                    key={vehicle.id}
                    vehicle={vehicle as any}
                    activeBooking={getActiveBooking(vehicle.id) as any}
                    nextBooking={getNextBooking(vehicle.id) as any}
                    taskCount={taskCountMap[vehicle.id] || 0}
                    onEditPrice={(v) => setPriceEditVehicle(v)}
                    onCreateTask={(v) => setTaskVehicle(v)}
                    onViewDetails={(v) => setDetailsVehicle(v)}
                    onStatusChange={handleStatusChange}
                    isOpsMode={isOpsMode}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Unassigned Tasks (Admin View) */}
          {!isOpsMode && unassignedTasks.length > 0 && (
            <>
              <Separator />
              <TaskQueue
                tasks={unassignedTasks}
                vehicleMap={vehicleMap}
                onCompleteTask={handleCompleteTask}
                onClaimTask={claimTask}
                onViewTask={() => {}}
                showClaimButton
                title="Unassigned Tasks"
                emptyMessage="All tasks are assigned"
              />
            </>
          )}
        </TabsContent>

        {/* Photos Tab Content */}
        <TabsContent value="photos" className="mt-0">
          <PhotoHubTab vehicles={vehiclesForPhotos} loading={loading} />
        </TabsContent>
      </ModuleTabs>

      {/* Dialogs */}
      <QuickPriceEditorDialog
        open={!!priceEditVehicle}
        onOpenChange={(open) => !open && setPriceEditVehicle(null)}
        vehicle={priceEditVehicle}
        onApplyRate={applyPriceOptimization}
      />

      <CreateVehicleTaskDialog
        open={!!taskVehicle}
        onOpenChange={(open) => !open && setTaskVehicle(null)}
        vehicle={taskVehicle}
        teamMembers={teamMembers as any}
        onCreateTask={createTask}
      />

      <VehicleImageDialog
        open={!!detailsVehicle}
        onOpenChange={(open) => !open && setDetailsVehicle(null)}
        vehicleName={detailsVehicle?.name || ''}
        vehicleDetails={{
          make: detailsVehicle?.make,
          model: detailsVehicle?.model,
          year: detailsVehicle?.year,
          status: detailsVehicle?.status,
          dailyRate: detailsVehicle?.current_rate,
        }}
      />
    </div>
  );
};
