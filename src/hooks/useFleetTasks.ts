import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useToast } from '@/hooks/use-toast';

export type TaskType = 'wash' | 'fuel' | 'inspection' | 'maintenance' | 'check_in' | 'check_out' | 'detail' | 'repair' | 'other';
export type TaskPriority = 'low' | 'normal' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface VehicleTask {
  id: string;
  vehicle_id: string;
  team_id: string | null;
  location_id: string | null;
  assigned_to: string | null;
  created_by: string;
  task_type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  vehicle_id: string;
  task_type: TaskType;
  title: string;
  priority?: TaskPriority;
  notes?: string;
  assigned_to?: string;
  location_id?: string;
  due_at?: string;
}

export const useFleetTasks = () => {
  const { user } = useAuth();
  const { currentTeam, selectedLocationId } = useTeam();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<VehicleTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user || !currentTeam) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('vehicle_tasks')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false });

      // Filter by location if selected
      if (selectedLocationId && selectedLocationId !== 'all') {
        query = query.eq('location_id', selectedLocationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks((data || []) as VehicleTask[]);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error loading tasks',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, currentTeam, selectedLocationId, toast]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchTasks();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('vehicle_tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicle_tasks',
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  const createTask = useCallback(async (input: CreateTaskInput): Promise<VehicleTask | null> => {
    if (!user || !currentTeam) return null;

    try {
      const { data, error } = await supabase
        .from('vehicle_tasks')
        .insert({
          vehicle_id: input.vehicle_id,
          team_id: currentTeam.id,
          location_id: input.location_id || (selectedLocationId !== 'all' ? selectedLocationId : null),
          created_by: user.id,
          assigned_to: input.assigned_to || null,
          task_type: input.task_type,
          priority: input.priority || 'normal',
          title: input.title,
          notes: input.notes || null,
          due_at: input.due_at || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Task created',
        description: `"${input.title}" has been added`,
      });

      return data as VehicleTask;
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error creating task',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [user, currentTeam, selectedLocationId, toast]);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus): Promise<boolean> => {
    if (!user) return false;

    try {
      const updates: Partial<VehicleTask> = { status };
      
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = user.id;
      }

      const { error } = await supabase
        .from('vehicle_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      toast({
        title: status === 'completed' ? 'Task completed' : 'Task updated',
        description: `Task status changed to ${status}`,
      });

      return true;
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error updating task',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast]);

  const claimTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('vehicle_tasks')
        .update({
          assigned_to: user.id,
          status: 'in_progress',
        })
        .eq('id', taskId)
        .is('assigned_to', null)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: 'Task already claimed',
          description: 'Someone else claimed this task before you',
          variant: 'destructive',
        });
        await fetchTasks();
        return false;
      }

      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }

      toast({
        title: 'Task claimed',
        description: 'You are now assigned to this task',
      });

      return true;
    } catch (error: any) {
      console.error('Error claiming task:', error);
      toast({
        title: 'Error claiming task',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast, fetchTasks]);

  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('vehicle_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task deleted',
      });

      return true;
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error deleting task',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Derived data
  const myTasks = tasks.filter(t => t.assigned_to === user?.id && t.status !== 'completed' && t.status !== 'cancelled');
  const unassignedTasks = tasks.filter(t => !t.assigned_to && t.status === 'pending');
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return {
    tasks,
    myTasks,
    unassignedTasks,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    loading,
    createTask,
    updateTaskStatus,
    claimTask,
    deleteTask,
    refreshTasks: fetchTasks,
  };
};
