import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VehicleThumbnail } from '@/components/common/VehicleThumbnail';
import { EmptyState } from '@/components/common/EmptyState';
import { SkeletonVehicleCard } from '@/components/ui/skeleton-specialized';
import { useWorkOrders, WorkOrder, WORK_ORDER_STATUSES, type CreateWorkOrderInput } from '@/hooks/useWorkOrders';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { useSearchParams } from 'react-router-dom';
import { WorkOrderDetailSheet } from './WorkOrderDetailSheet';
import { CreateWorkOrderDialog } from './CreateWorkOrderDialog';
import {
  Plus, Search, Wrench, Clock, Ban, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isPast } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  triaged: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  scheduled: 'bg-primary/10 text-primary border-primary/30',
  in_progress: 'bg-primary/10 text-primary border-primary/30',
  blocked_parts: 'bg-destructive/10 text-destructive border-destructive/30',
  blocked_vendor: 'bg-destructive/10 text-destructive border-destructive/30',
  qa_review: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  completed: 'bg-success/10 text-success border-success/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-secondary text-secondary-foreground',
  urgent: 'bg-destructive/10 text-destructive',
};

type StatusFilter = 'active' | 'blocked' | 'completed' | 'all';

export const MaintenanceHub = () => {
  const { workOrders, activeOrders, blockedOrders, loading } = useWorkOrders();
  const { vehicles } = useLocationFilteredFleet();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<Partial<CreateWorkOrderInput> | undefined>();

  const vehicleMap = useMemo(() => {
    return vehicles.reduce((acc, v) => {
      acc[v.id] = v;
      return acc;
    }, {} as Record<string, any>);
  }, [vehicles]);

  // Deep-link: open specific work order
  useEffect(() => {
    const woId = searchParams.get('workOrderId');
    if (woId && workOrders.length > 0) {
      const wo = workOrders.find(w => w.id === woId);
      if (wo) setSelectedOrder(wo);
    }
  }, [searchParams, workOrders]);

  // Handle prefill from CheckInOut or task conversion via sessionStorage
  useEffect(() => {
    const prefillStr = sessionStorage.getItem('wo-prefill');
    if (prefillStr) {
      try {
        setCreatePrefill(JSON.parse(prefillStr));
        setShowCreate(true);
      } catch { /* ignore */ }
      sessionStorage.removeItem('wo-prefill');
    }
  }, []);

  // Listen for create-work-order event (from CheckInOut or task detail)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setCreatePrefill(detail);
        setShowCreate(true);
      }
    };
    window.addEventListener('create-work-order', handler);
    return () => window.removeEventListener('create-work-order', handler);
  }, []);

  const filteredOrders = useMemo(() => {
    let result = [...workOrders];

    if (statusFilter === 'active') {
      result = result.filter(wo => !['completed', 'cancelled'].includes(wo.status));
    } else if (statusFilter === 'blocked') {
      result = result.filter(wo => wo.status === 'blocked_parts' || wo.status === 'blocked_vendor');
    } else if (statusFilter === 'completed') {
      result = result.filter(wo => wo.status === 'completed');
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(wo => {
        const vehicle = vehicleMap[wo.vehicle_id];
        return wo.title.toLowerCase().includes(q) ||
          vehicle?.name?.toLowerCase().includes(q) ||
          vehicle?.make?.toLowerCase().includes(q) ||
          vehicle?.model?.toLowerCase().includes(q);
      });
    }

    result.sort((a, b) => {
      const aOverdue = a.due_at && isPast(new Date(a.due_at)) && !['completed', 'cancelled'].includes(a.status);
      const bOverdue = b.due_at && isPast(new Date(b.due_at)) && !['completed', 'cancelled'].includes(b.status);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      const pri: Record<string, number> = { urgent: 0, normal: 1, low: 2 };
      if ((pri[a.priority] ?? 1) !== (pri[b.priority] ?? 1)) return (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [workOrders, statusFilter, search, vehicleMap]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <SkeletonVehicleCard key={i} />)}
      </div>
    );
  }

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: activeOrders.length },
    { key: 'blocked', label: 'Blocked', count: blockedOrders.length },
    { key: 'completed', label: 'Completed', count: workOrders.filter(wo => wo.status === 'completed').length },
    { key: 'all', label: 'All', count: workOrders.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Maintenance Hub
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage work orders across your fleet
          </p>
        </div>
        <Button onClick={() => { setCreatePrefill(undefined); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Work Order
        </Button>
      </div>

      {/* Status Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map(tab => (
          <Button
            key={tab.key}
            variant={statusFilter === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(tab.key)}
            className="gap-1.5"
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {tab.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search work orders or vehicles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          aria-label="Search work orders"
        />
      </div>

      {/* Work Order List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={search ? 'No matching work orders' : 'No work orders yet'}
          description={search ? 'Try adjusting your search' : 'Create your first work order to start tracking maintenance'}
          action={!search ? { label: 'Create Work Order', onClick: () => setShowCreate(true) } : undefined}
        />
      ) : (
        <ScrollArea className="max-h-[calc(100vh-380px)]">
          <div className="space-y-2 pr-2">
            {filteredOrders.map(order => {
              const vehicle = vehicleMap[order.vehicle_id];
              const isOverdue = order.due_at && isPast(new Date(order.due_at)) && !['completed', 'cancelled'].includes(order.status);
              const statusLabel = WORK_ORDER_STATUSES.find(s => s.value === order.status)?.label || order.status;
              const isBlocked = order.status === 'blocked_parts' || order.status === 'blocked_vendor';

              return (
                <Card
                  key={order.id}
                  className={cn(
                    'p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/20',
                    isOverdue && 'border-l-4 border-l-destructive',
                    isBlocked && !isOverdue && 'border-l-4 border-l-amber-500'
                  )}
                  onClick={() => setSelectedOrder(order)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedOrder(order)}
                  aria-label={`Work order: ${order.title}`}
                >
                  <div className="flex items-center gap-4">
                    <VehicleThumbnail
                      vehicleName={vehicle?.name || 'Unknown'}
                      imageUrl={vehicle?.image_url}
                      size="md"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground truncate">{order.title}</h4>
                        {order.out_of_rotation && (
                          <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 flex-shrink-0">
                            <Ban className="h-3 w-3 mr-1" />
                            OOR
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="truncate">{vehicle?.name || 'Unknown Vehicle'}</span>
                        {order.due_at && (
                          <>
                            <span>•</span>
                            <span className={cn('flex items-center gap-1', isOverdue && 'text-destructive font-medium')}>
                              <Clock className="h-3 w-3" />
                              {isOverdue ? 'Overdue' : 'Due'} {formatDistanceToNow(new Date(order.due_at), { addSuffix: true })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[order.status] || '')}>
                        {statusLabel}
                      </Badge>
                      <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[order.priority] || '')}>
                        {order.priority}
                      </Badge>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
                  </div>

                  {(order.estimate_cost || order.actual_cost) && (
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground ml-16">
                      {order.estimate_cost && <span>Est: ${Number(order.estimate_cost).toLocaleString()}</span>}
                      {order.actual_cost && <span>Actual: ${Number(order.actual_cost).toLocaleString()}</span>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Work Order Detail Sheet */}
      <WorkOrderDetailSheet
        workOrder={selectedOrder}
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
        vehicleMap={vehicleMap}
      />

      {/* Create Work Order Dialog */}
      <CreateWorkOrderDialog
        key={createPrefill ? JSON.stringify(createPrefill) : 'default'}
        open={showCreate}
        onOpenChange={setShowCreate}
        prefill={createPrefill}
      />
    </div>
  );
};