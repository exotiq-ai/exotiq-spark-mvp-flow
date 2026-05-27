import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { useFleetTasks, type VehicleTask } from '@/hooks/useFleetTasks';
import { useVehicleOpsStatus, OpsStatus } from '@/hooks/useVehicleOpsStatus';
import { useVehiclePhotos } from '@/hooks/useVehiclePhotos';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { FleetVehicleCard } from './FleetVehicleCard';
import { FleetFilters, FleetFiltersState, ViewMode } from './FleetFilters';
import { TaskQueue } from './TaskQueue';
import { TaskDetailSheet } from './TaskDetailSheet';
import { MaintenanceHub } from './MaintenanceHub';
import { CreateVehicleTaskDialog } from '@/components/dialogs/CreateVehicleTaskDialog';
import { QuickPriceEditorDialog } from '@/components/dialogs/QuickPriceEditorDialog';
import { VehicleImageDialog } from '@/components/dialogs/VehicleImageDialog';
import { AddVehicleDialog } from '@/components/dialogs/AddVehicleDialog';
import { EditVehicleDialog } from '@/components/dialogs/EditVehicleDialog';
import { ImportWizard } from '@/components/import/ImportWizard';
import { BulkUploadModal } from '@/components/photos/BulkUploadModal';
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
  Plus,
  Upload,
  Trash2,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';

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
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { vehicles, bookings, loading, applyPriceOptimization, updateVehicle, refreshData, createVehicle, deleteVehicles, archiveVehicle, trashVehicle } = useLocationFilteredFleet() as any;
  const { tasks, myTasks, unassignedTasks, createTask, updateTaskStatus, claimTask } = useFleetTasks();
  const { updateOpsStatus } = useVehicleOpsStatus();
  const { photoCountByVehicle } = useVehiclePhotos({ realtime: false });
  const { currentTeam } = useTeam();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Selection state for batch operations
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo-toast delete refs
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deletedVehicleRef = useRef<any>(null);

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

  // Deep-link routing
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state
  const [activeTab, setActiveTab] = useState('fleet');
  const [selectedTask, setSelectedTask] = useState<VehicleTask | null>(null);

  // Deep-link from notifications/attention tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    const taskId = searchParams.get('taskId');
    
    if (tab === 'maintenance') setActiveTab('maintenance');
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId);
      if (task) setSelectedTask(task);
    }
  }, [searchParams, tasks]);

  // Deep-link: auto-open add vehicle dialog from action param
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add-vehicle') {
      setShowAddVehicle(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams]);

  // Listen for work order creation from other modules (e.g., CheckInOutDialog)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        sessionStorage.setItem('wo-prefill', JSON.stringify(detail));
        setActiveTab('maintenance');
      }
    };
    window.addEventListener('create-work-order', handler);
    return () => window.removeEventListener('create-work-order', handler);
  }, []);

  // View state
  const [isOpsMode, setIsOpsMode] = useState(isMobile);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<FleetFiltersState>({
    search: '',
    bookingStatus: [],
    opsStatus: [],
    sortBy: 'name',
    sortDesc: false,
    hideRetired: true,
  });

  // Dialog state
  const [priceEditVehicle, setPriceEditVehicle] = useState<any>(null);
  const [taskVehicle, setTaskVehicle] = useState<any>(null);
  const [detailsVehicle, setDetailsVehicle] = useState<any>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [photoUploadVehicle, setPhotoUploadVehicle] = useState<{ id: string; name: string } | null>(null);
  const [editVehicle, setEditVehicle] = useState<any>(null);

  // Filter and sort vehicles
  const filteredVehicles = useMemo(() => {
    let result = [...vehicles];

    // Hide retired vehicles by default
    if (filters.hideRetired) {
      result = result.filter(v => v.status !== 'retired');
    }

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
      result = result.filter(v => filters.opsStatus.includes((v.ops_status || 'not_set') as OpsStatus));
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

  // Selection handlers
  const handleSelectVehicle = (vehicleId: string, selected: boolean) => {
    setSelectedVehicleIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(vehicleId);
      } else {
        next.delete(vehicleId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVehicleIds(new Set(filteredVehicles.map(v => v.id)));
    } else {
      setSelectedVehicleIds(new Set());
    }
  };

  // Archive (Manager+): hides from active fleet, reversible from Settings → Archived
  const handleArchiveVehicle = useCallback(async (vehicle: any) => {
    const ok = window.confirm(
      `Archive ${vehicle.name}?\n\nThis hides it from your Fleet, calendar, and booking pickers. All history stays intact. You can restore it anytime from Settings → Archived. Archived vehicles aren't billed.`
    );
    if (!ok) return;
    await archiveVehicle(vehicle.id);
  }, [archiveVehicle]);

  // Delete (Owner only): sends to Trash for 30 days, then permanently removed
  const handleDeleteVehicle = useCallback(async (vehicle: any) => {
    const confirmName = window.prompt(
      `Delete ${vehicle.name}?\n\nThis vehicle will move to Trash for 30 days, then be permanently removed. You can restore it anytime before then from Settings → Trash.\n\nHistorical records (bookings, inspections, customer history) keep the vehicle name — but the vehicle itself will be gone.\n\nHeads up: vehicles in Trash still count toward your subscription until they're permanently removed.\n\nType the vehicle name to confirm:`
    );
    if (confirmName === null) return;
    if (confirmName.trim() !== vehicle.name.trim()) {
      sonnerToast.error('Name did not match. Vehicle was not deleted.');
      return;
    }
    const result = await trashVehicle(vehicle.id);
    if (!result.ok) {
      sonnerToast.error(result.error || "Couldn't delete vehicle");
      return;
    }
    const purgeDate = new Date();
    purgeDate.setDate(purgeDate.getDate() + 30);
    sonnerToast.success(`Moved to Trash. Auto-removes ${purgeDate.toLocaleDateString()}.`);
  }, [trashVehicle]);

  const handleBatchDelete = async () => {
    if (selectedVehicleIds.size === 0) return;
    setIsDeleting(true);
    try {
      await deleteVehicles(Array.from(selectedVehicleIds));
      setSelectedVehicleIds(new Set());
    } finally {
      setIsDeleting(false);
    }
  };

  // Prepare vehicles for PhotoHubTab
  const vehiclesForPhotos = useMemo(() => {
    return vehicles.map(v => ({
      id: v.id,
      name: v.name,
      make: v.make,
      model: v.model,
      year: v.year,
      color: v.color,
    }));
  }, [vehicles]);

  // Module tabs configuration
  const moduleTabs = [
    { id: 'fleet', label: 'Fleet', shortLabel: 'Fleet', icon: Car },
    { id: 'maintenance', label: 'Maintenance', shortLabel: 'Maint.', icon: Wrench },
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

          {/* Add Vehicle + Import buttons */}
          <Button onClick={() => setShowAddVehicle(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
          <Button variant="outline" onClick={() => setShowImportWizard(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>

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
                onViewTask={(task) => setSelectedTask(task)}
                title="My Tasks"
                emptyMessage="No tasks assigned to you"
                compact
              />
            </Card>
          )}

          {/* Filters + Batch Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <FleetFilters
              filters={filters}
              onFiltersChange={setFilters}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              vehicleCount={vehicles.length}
              filteredCount={filteredVehicles.length}
              isOpsMode={isOpsMode}
            />
            
            {/* Batch Actions - show when vehicles are selected */}
            {!isOpsMode && selectedVehicleIds.size > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
                <Checkbox
                  checked={selectedVehicleIds.size === filteredVehicles.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all vehicles"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedVehicleIds.size} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            )}
          </div>

          {/* Vehicle Grid/List */}
          {filteredVehicles.length === 0 ? (
            <EmptyState
              icon={Car}
              title="No vehicles found"
              description={filters.search ? "Try adjusting your search or filters" : "Add your first vehicle to get started"}
              action={!filters.search ? {
                label: "Add Vehicle",
                onClick: () => setShowAddVehicle(true)
              } : undefined}
            />
          ) : (
            <div className={cn(
              isOpsMode
                ? 'grid grid-cols-1 gap-4'
                : viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
                  : 'flex flex-col divide-y border rounded-lg overflow-hidden bg-card'
            )}>
              <AnimatePresence mode="popLayout">
                {filteredVehicles.map((vehicle) => (
                  <FleetVehicleCard
                    key={vehicle.id}
                    vehicle={vehicle as any}
                    activeBooking={getActiveBooking(vehicle.id) as any}
                    nextBooking={getNextBooking(vehicle.id) as any}
                    taskCount={taskCountMap[vehicle.id] || 0}
                    photoCount={photoCountByVehicle[vehicle.id]}
                    onEditPrice={(v) => setPriceEditVehicle(v)}
                    onEdit={(v) => setEditVehicle(v)}
                    onCreateTask={(v) => setTaskVehicle(v)}
                    onViewDetails={(v) => setDetailsVehicle(v)}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteVehicle}
                    isOpsMode={isOpsMode}
                    viewMode={viewMode}
                    isSelected={selectedVehicleIds.has(vehicle.id)}
                    onSelectChange={!isOpsMode ? handleSelectVehicle : undefined}
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
                onViewTask={(task) => setSelectedTask(task)}
                showClaimButton
                title="Unassigned Tasks"
                emptyMessage="All tasks are assigned"
              />
            </>
          )}
        </TabsContent>

        {/* Maintenance Tab Content */}
        <TabsContent value="maintenance" className="mt-0">
          <MaintenanceHub />
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

      {/* Add Vehicle Dialog */}
      <AddVehicleDialog
        open={showAddVehicle}
        onOpenChange={setShowAddVehicle}
        onSubmit={createVehicle}
        onAddPhotos={(vehicleId, vehicleName) => {
          setShowAddVehicle(false);
          setPhotoUploadVehicle({ id: vehicleId, name: vehicleName });
        }}
      />

      {/* Bulk Upload Modal for newly added vehicle */}
      <BulkUploadModal
        open={!!photoUploadVehicle}
        onOpenChange={(open) => !open && setPhotoUploadVehicle(null)}
        vehicles={photoUploadVehicle ? [{ id: photoUploadVehicle.id, name: photoUploadVehicle.name }] : []}
        preSelectedVehicleId={photoUploadVehicle?.id}
      />

      {/* Import Wizard Dialog */}
      <Dialog open={showImportWizard} onOpenChange={setShowImportWizard}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Fleet Data</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <ImportWizard 
              onClose={() => setShowImportWizard(false)}
              onComplete={() => {
                setShowImportWizard(false);
                refreshData();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        vehicleMap={vehicleMap}
        onStatusChange={updateTaskStatus}
        onClaim={claimTask}
        onConvertToWorkOrder={(task) => {
          setSelectedTask(null);
          window.dispatchEvent(new CustomEvent('create-work-order', {
            detail: {
              vehicle_id: task.vehicle_id,
              title: task.title,
              notes: task.notes || '',
              priority: task.priority,
              source: 'task',
              source_id: task.id,
              issue_type: task.task_type === 'repair' ? 'mechanical' : task.task_type === 'maintenance' ? 'general' : 'general',
            }
          }));
        }}
      />

      <VehicleImageDialog
        open={!!detailsVehicle}
        onOpenChange={(open) => !open && setDetailsVehicle(null)}
        vehicleName={detailsVehicle?.name || ''}
        vehicleId={detailsVehicle?.id}
        vehicleDetails={{
          make: detailsVehicle?.make,
          model: detailsVehicle?.model,
          year: detailsVehicle?.year,
          status: detailsVehicle?.status,
          dailyRate: detailsVehicle?.current_rate,
          color: detailsVehicle?.color,
          license_plate: detailsVehicle?.license_plate,
          vin: detailsVehicle?.vin,
          ops_status: detailsVehicle?.ops_status,
          suggested_rate: detailsVehicle?.suggested_rate,
        }}
        onApplyRate={applyPriceOptimization}
        onCreateTask={(v) => { setDetailsVehicle(null); setTaskVehicle(v); }}
        onStatusChange={handleStatusChange}
        onEdit={(v) => { setDetailsVehicle(null); setEditVehicle(v); }}
        vehicleTasks={detailsVehicle ? tasks.filter(t => t.vehicle_id === detailsVehicle.id) : []}
        onCompleteTask={handleCompleteTask}
        onClaimTask={claimTask}
        onViewTask={(task) => { setDetailsVehicle(null); setSelectedTask(task); }}
        currentUserId={user?.id}
        activeBooking={detailsVehicle ? getActiveBooking(detailsVehicle.id) : undefined}
        nextBooking={detailsVehicle ? getNextBooking(detailsVehicle.id) : undefined}
      />

      {/* Edit Vehicle Dialog */}
      <EditVehicleDialog
        open={!!editVehicle}
        onOpenChange={(open) => !open && setEditVehicle(null)}
        vehicle={editVehicle}
        onSave={updateVehicle}
      />
    </div>
  );
};

export default FleetPageEnhanced;
