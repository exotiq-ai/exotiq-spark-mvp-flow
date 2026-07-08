import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useToast } from '@/hooks/use-toast';

export type WorkOrderStatus = 'new' | 'triaged' | 'scheduled' | 'in_progress' | 'blocked_parts' | 'blocked_vendor' | 'qa_review' | 'completed' | 'cancelled';
export type WorkOrderPriority = 'low' | 'normal' | 'urgent';
export type WorkOrderSource = 'inspection' | 'check_in_out' | 'manual' | 'task';
export type IssueType = 'mechanical' | 'electrical' | 'body' | 'interior' | 'tire' | 'fluid' | 'safety' | 'general';

export interface WorkOrder {
  id: string;
  team_id: string;
  vehicle_id: string;
  location_id: string | null;
  title: string;
  issue_type: string;
  priority: string;
  status: string;
  source: string;
  source_id: string | null;
  assigned_to: string | null;
  created_by: string;
  due_at: string | null;
  internal_or_outsourced: string;
  vendor_name: string | null;
  estimate_cost: number | null;
  actual_cost: number | null;
  notes: string | null;
  resolution_summary: string | null;
  out_of_rotation: boolean;
  expected_return_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface WorkOrderEvent {
  id: string;
  work_order_id: string;
  event_type: string;
  actor_id: string | null;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateWorkOrderInput {
  vehicle_id: string;
  title: string;
  issue_type?: string;
  priority?: string;
  source?: string;
  source_id?: string;
  assigned_to?: string;
  due_at?: string;
  internal_or_outsourced?: string;
  vendor_name?: string;
  estimate_cost?: number;
  notes?: string;
  location_id?: string;
}

export const WORK_ORDER_STATUSES: { value: WorkOrderStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked_parts', label: 'Blocked: Parts' },
  { value: 'blocked_vendor', label: 'Blocked: Vendor' },
  { value: 'qa_review', label: 'QA Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const ISSUE_TYPES: { value: IssueType; label: string }[] = [
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'body', label: 'Body / Exterior' },
  { value: 'interior', label: 'Interior' },
  { value: 'tire', label: 'Tire' },
  { value: 'fluid', label: 'Fluid' },
  { value: 'safety', label: 'Safety' },
  { value: 'general', label: 'General' },
];

const ACTIVE_STATUSES = ['new', 'triaged', 'scheduled', 'in_progress', 'blocked_parts', 'blocked_vendor', 'qa_review'];

export const useWorkOrders = () => {
  const { user } = useAuth();
  const { currentTeam, selectedLocationId } = useTeam();
  const { toast } = useToast();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkOrders = useCallback(async () => {
    if (!user || !currentTeam) {
      setWorkOrders([]);
      setLoading(false);
      return;
    }

    try {
      let query = (supabase as any)
        .from('work_orders')
        .select('id,team_id,vehicle_id,location_id,title,issue_type,priority,status,source,source_id,assigned_to,created_by,due_at,internal_or_outsourced,vendor_name,estimate_cost,actual_cost,notes,resolution_summary,out_of_rotation,expected_return_at,created_at,updated_at,completed_at')
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedLocationId && selectedLocationId !== 'all') {
        query = query.eq('location_id', selectedLocationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setWorkOrders((data || []) as WorkOrder[]);
    } catch (error: any) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentTeam, selectedLocationId]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Lazy realtime — only when hook is mounted (maintenance tab active)
  useEffect(() => {
    if (!currentTeam?.id) return;
    const channel = supabase
      .channel('work_orders_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => fetchWorkOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentTeam?.id, fetchWorkOrders]);

  const createWorkOrder = useCallback(async (input: CreateWorkOrderInput): Promise<WorkOrder | null> => {
    if (!user || !currentTeam) return null;

    try {
      const { data, error } = await (supabase as any)
        .from('work_orders')
        .insert({
          team_id: currentTeam.id,
          vehicle_id: input.vehicle_id,
          location_id: input.location_id || (selectedLocationId !== 'all' ? selectedLocationId : null),
          title: input.title,
          issue_type: input.issue_type || 'general',
          priority: input.priority || 'normal',
          status: 'new',
          source: input.source || 'manual',
          source_id: input.source_id || null,
          assigned_to: input.assigned_to || null,
          created_by: user.id,
          due_at: input.due_at || null,
          internal_or_outsourced: input.internal_or_outsourced || 'internal',
          vendor_name: input.vendor_name || null,
          estimate_cost: input.estimate_cost || null,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Log creation event
      await (supabase as any).from('work_order_events').insert({
        work_order_id: (data as any).id,
        event_type: 'created',
        actor_id: user.id,
        new_value: 'new',
      });

      toast({ title: 'Work order created', description: `"${input.title}" has been created` });
      return data as WorkOrder;
    } catch (error: any) {
      console.error('Error creating work order:', error);
      toast({ title: 'Error creating work order', description: error.message, variant: 'destructive' });
      return null;
    }
  }, [user, currentTeam, selectedLocationId, toast]);

  const syncVehicleStatusForOOR = useCallback(async (vehicleId: string) => {
    if (!currentTeam) return;
    try {
      const { data: activeOOR } = await (supabase as any)
        .from('work_orders')
        .select('id')
        .eq('team_id', currentTeam.id)
        .eq('vehicle_id', vehicleId)
        .eq('out_of_rotation', true)
        .in('status', ACTIVE_STATUSES)
        .limit(1);

      const shouldBeOOS = (activeOOR?.length || 0) > 0;

      const { data: vehicle } = await (supabase as any)
        .from('vehicles')
        .select('status')
        .eq('id', vehicleId)
        .maybeSingle();

      if (!vehicle) return;

      if (shouldBeOOS && vehicle.status !== 'maintenance' && vehicle.status !== 'retired') {
        await (supabase as any).from('vehicles').update({ status: 'maintenance' }).eq('id', vehicleId);
      } else if (!shouldBeOOS && vehicle.status === 'maintenance') {
        await (supabase as any).from('vehicles').update({ status: 'available' }).eq('id', vehicleId);
      }
    } catch (err) {
      console.error('Vehicle status sync failed:', err);
    }
  }, [currentTeam]);

  const updateWorkOrderStatus = useCallback(async (
    workOrderId: string,
    newStatus: WorkOrderStatus,
    extras?: { resolution_summary?: string; actual_cost?: number }
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const current = workOrders.find(wo => wo.id === workOrderId);
      const updates: Record<string, any> = { status: newStatus };

      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
        if (extras?.resolution_summary) updates.resolution_summary = extras.resolution_summary;
        if (extras?.actual_cost !== undefined) updates.actual_cost = extras.actual_cost;
      }

      const { error } = await (supabase as any)
        .from('work_orders')
        .update(updates)
        .eq('id', workOrderId);

      if (error) throw error;

      await (supabase as any).from('work_order_events').insert({
        work_order_id: workOrderId,
        event_type: 'status_changed',
        actor_id: user.id,
        old_value: current?.status || null,
        new_value: newStatus,
      });

      // When a work order becomes terminal, clear its OOR flag and re-sync vehicle status.
      if ((newStatus === 'completed' || newStatus === 'cancelled') && current?.out_of_rotation) {
        await (supabase as any)
          .from('work_orders')
          .update({ out_of_rotation: false })
          .eq('id', workOrderId);
      }
      if (current?.vehicle_id && (newStatus === 'completed' || newStatus === 'cancelled')) {
        await syncVehicleStatusForOOR(current.vehicle_id);
      }

      if (navigator.vibrate) navigator.vibrate(10);
      const label = WORK_ORDER_STATUSES.find(s => s.value === newStatus)?.label || newStatus;
      toast({ title: newStatus === 'completed' ? 'Work order completed' : 'Status updated', description: `Status changed to ${label}` });
      return true;
    } catch (error: any) {
      console.error('Error updating work order:', error);
      toast({ title: 'Error updating work order', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [user, workOrders, toast, syncVehicleStatusForOOR]);

  const updateWorkOrder = useCallback(async (workOrderId: string, updates: Partial<WorkOrder>): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await (supabase as any).from('work_orders').update(updates).eq('id', workOrderId);
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error updating work order:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [user, toast]);


  const toggleOutOfRotation = useCallback(async (workOrderId: string, outOfRotation: boolean, expectedReturnAt?: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const current = workOrders.find(wo => wo.id === workOrderId);
      const { error } = await (supabase as any)
        .from('work_orders')
        .update({
          out_of_rotation: outOfRotation,
          expected_return_at: outOfRotation ? expectedReturnAt || null : null,
        })
        .eq('id', workOrderId);

      if (error) throw error;

      await (supabase as any).from('work_order_events').insert({
        work_order_id: workOrderId,
        event_type: outOfRotation ? 'out_of_rotation' : 'back_in_rotation',
        actor_id: user.id,
        new_value: outOfRotation ? 'true' : 'false',
      });

      if (current?.vehicle_id) await syncVehicleStatusForOOR(current.vehicle_id);
      await fetchWorkOrders();

      toast({
        title: outOfRotation ? 'Vehicle marked Out of Service' : 'Vehicle back in service',
        description: outOfRotation
          ? 'This vehicle will be blocked from new bookings until the expected return date.'
          : 'This vehicle can be booked again.',
      });
      return true;
    } catch (error: any) {
      console.error('Error toggling out of service:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [user, workOrders, toast, syncVehicleStatusForOOR, fetchWorkOrders]);

  const deleteWorkOrder = useCallback(async (workOrderId: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any).from('work_orders').delete().eq('id', workOrderId);
      if (error) throw error;
      toast({ title: 'Work order deleted' });
      return true;
    } catch (error: any) {
      console.error('Error deleting work order:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [toast]);

  const fetchEvents = useCallback(async (workOrderId: string): Promise<WorkOrderEvent[]> => {
    const { data, error } = await (supabase as any)
      .from('work_order_events')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: true });
    if (error) { console.error('Error fetching events:', error); return []; }
    return (data || []) as WorkOrderEvent[];
  }, []);

  // Derived data
  const activeOrders = useMemo(() => workOrders.filter(wo => ACTIVE_STATUSES.includes(wo.status)), [workOrders]);
  const myOrders = useMemo(() => activeOrders.filter(wo => wo.assigned_to === user?.id), [activeOrders, user]);
  const unassignedOrders = useMemo(() => activeOrders.filter(wo => !wo.assigned_to), [activeOrders]);
  const overdueOrders = useMemo(() => activeOrders.filter(wo => wo.due_at && new Date(wo.due_at) < new Date()), [activeOrders]);
  const blockedOrders = useMemo(() => activeOrders.filter(wo => wo.status === 'blocked_parts' || wo.status === 'blocked_vendor'), [activeOrders]);
  const completedOrders = useMemo(() => workOrders.filter(wo => wo.status === 'completed'), [workOrders]);

  return {
    workOrders, activeOrders, myOrders, unassignedOrders, overdueOrders, blockedOrders, completedOrders,
    loading, createWorkOrder, updateWorkOrderStatus, updateWorkOrder, toggleOutOfRotation, deleteWorkOrder,
    fetchEvents, refreshWorkOrders: fetchWorkOrders,
  };
};