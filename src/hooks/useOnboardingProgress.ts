import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { devLog, devError } from '@/lib/logger';

export interface OnboardingFormData {
  companyName: string;
  businessAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    formatted: string;
  } | null;
  website: string;
  phone: string;
  email: string;
  fleetSize: string;
  businessType: string;
  locations: Array<{
    id: string;
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      formatted: string;
    };
    isPrimary: boolean;
  }>;
}

export interface OnboardingProgress {
  id: string;
  userId: string;
  teamId: string | null;
  currentStep: number;
  stepsCompleted: number[];
  formData: OnboardingFormData;
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  source: string;
  onboardingType: 'owner' | 'team_member';
}

const defaultFormData: OnboardingFormData = {
  companyName: '',
  businessAddress: null,
  website: '',
  phone: '',
  email: '',
  fleetSize: '',
  businessType: '',
  locations: [],
};

export function useOnboardingProgress() {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // localStorage keys for fallback
  const FALLBACK_KEY = useMemo(() => `onboarding-fallback-${user?.id}`, [user?.id]);
  const PENDING_SYNC_KEY = useMemo(() => `onboarding-pending-sync-${user?.id}`, [user?.id]);

  // Fetch progress from database
  const { data: progress, isLoading, error, refetch } = useQuery({
    queryKey: ['onboarding-progress', user?.id],
    queryFn: async (): Promise<OnboardingProgress | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        devError('[OnboardingProgress] Error fetching:', error);
        throw error;
      }

      if (!data) return null;

      // Transform snake_case to camelCase
      return {
        id: data.id,
        userId: data.user_id,
        teamId: data.team_id,
        currentStep: data.current_step,
        stepsCompleted: data.steps_completed || [],
        formData: (data.form_data as unknown as OnboardingFormData) || defaultFormData,
        startedAt: data.started_at,
        lastActivityAt: data.last_activity_at,
        completedAt: data.completed_at,
        source: data.source || 'web',
        onboardingType: (data.onboarding_type as 'owner' | 'team_member') || 'owner',
      };
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });

  // Initialize progress record if it doesn't exist
  const initializeProgress = useMutation({
    mutationFn: async (type: 'owner' | 'team_member' = 'owner') => {
      if (!user?.id) throw new Error('No user');

      const { data, error } = await supabase
        .from('onboarding_progress')
        .insert({
          user_id: user.id,
          team_id: currentTeam?.id || null,
          current_step: 1,
          steps_completed: [],
          form_data: { ...defaultFormData, email: user.email || '' },
          source: 'web',
          onboarding_type: type,
        })
        .select()
        .single();

      if (error) {
        // If record exists (unique constraint), fetch it instead
        if (error.code === '23505') {
          devLog('[OnboardingProgress] Record exists, fetching...');
          return refetch();
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', user?.id] });
    },
  });

  // Sync pending localStorage changes to database
  const syncPendingChanges = useCallback(async () => {
    if (!user?.id) return false;

    const pendingData = localStorage.getItem(FALLBACK_KEY);
    const hasPending = localStorage.getItem(PENDING_SYNC_KEY);

    if (!pendingData || !hasPending) return true;

    try {
      const parsed = JSON.parse(pendingData);
      const { error } = await supabase
        .from('onboarding_progress')
        .update({
          current_step: parsed.currentStep,
          form_data: parsed.formData,
          steps_completed: parsed.stepsCompleted,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      localStorage.removeItem(PENDING_SYNC_KEY);
      setHasPendingSync(false);
      setIsOffline(false);
      devLog('[OnboardingProgress] Synced pending changes to database');
      
      // Refresh the query data
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', user.id] });
      return true;
    } catch (err) {
      devError('[OnboardingProgress] Failed to sync pending changes:', err);
      return false;
    }
  }, [user?.id, FALLBACK_KEY, PENDING_SYNC_KEY, queryClient]);

  // Update progress (debounced)
  const updateProgress = useCallback(
    async (updates: Partial<{
      currentStep: number;
      stepsCompleted: number[];
      formData: Partial<OnboardingFormData>;
      completedAt: string | null;
    }>) => {
      if (!user?.id) return;

      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setIsSaving(true);

      // Build the update object
      const dbUpdates: Record<string, unknown> = {};
      
      if (updates.currentStep !== undefined) {
        dbUpdates.current_step = updates.currentStep;
      }
      if (updates.stepsCompleted !== undefined) {
        dbUpdates.steps_completed = updates.stepsCompleted;
      }
      if (updates.formData !== undefined) {
        // Merge with existing form data
        const existingFormData = progress?.formData || defaultFormData;
        dbUpdates.form_data = { ...existingFormData, ...updates.formData };
      }
      if (updates.completedAt !== undefined) {
        dbUpdates.completed_at = updates.completedAt;
      }
      if (currentTeam?.id && !progress?.teamId) {
        dbUpdates.team_id = currentTeam.id;
      }

      try {
        const { error } = await supabase
          .from('onboarding_progress')
          .update(dbUpdates)
          .eq('user_id', user.id);

        if (error) throw error;

        setLastSavedAt(new Date());
        devLog('[OnboardingProgress] Saved:', dbUpdates);

        // Success - also update localStorage cache
        localStorage.setItem(FALLBACK_KEY, JSON.stringify({
          currentStep: updates.currentStep ?? progress?.currentStep,
          formData: dbUpdates.form_data ?? progress?.formData,
          stepsCompleted: updates.stepsCompleted ?? progress?.stepsCompleted,
        }));
        localStorage.removeItem(PENDING_SYNC_KEY);
        setIsOffline(false);

        // Optimistically update cache
        queryClient.setQueryData(['onboarding-progress', user.id], (old: OnboardingProgress | null) => {
          if (!old) return old;
          return {
            ...old,
            ...updates,
            formData: updates.formData ? { ...old.formData, ...updates.formData } : old.formData,
            lastActivityAt: new Date().toISOString(),
          };
        });
      } catch (err) {
        // Network failure - fall back to localStorage
        devError('[OnboardingProgress] DB save failed, using localStorage fallback:', err);

        localStorage.setItem(FALLBACK_KEY, JSON.stringify({
          currentStep: updates.currentStep ?? progress?.currentStep,
          formData: updates.formData ? { ...progress?.formData, ...updates.formData } : progress?.formData,
          stepsCompleted: updates.stepsCompleted ?? progress?.stepsCompleted,
        }));
        localStorage.setItem(PENDING_SYNC_KEY, 'true');

        setIsOffline(true);
        setHasPendingSync(true);

        // Still update local cache for UI consistency
        queryClient.setQueryData(['onboarding-progress', user.id], (old: OnboardingProgress | null) => {
          if (!old) return old;
          return {
            ...old,
            ...updates,
            formData: updates.formData ? { ...old.formData, ...updates.formData } : old.formData,
            lastActivityAt: new Date().toISOString(),
          };
        });
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id, currentTeam?.id, progress?.formData, progress?.teamId, progress?.currentStep, progress?.stepsCompleted, queryClient, FALLBACK_KEY, PENDING_SYNC_KEY]
  );

  // Debounced form data update (auto-save every 2 seconds of inactivity)
  const updateFormDataDebounced = useCallback(
    (formData: Partial<OnboardingFormData>) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        updateProgress({ formData });
      }, 2000);
    },
    [updateProgress]
  );

  // Mark step as complete
  const completeStep = useCallback(
    async (stepNumber: number) => {
      const currentCompleted = progress?.stepsCompleted || [];
      if (!currentCompleted.includes(stepNumber)) {
        const newCompleted = [...currentCompleted, stepNumber].sort((a, b) => a - b);
        await updateProgress({ stepsCompleted: newCompleted });
      }
    },
    [progress?.stepsCompleted, updateProgress]
  );

  // Go to next step
  const goToStep = useCallback(
    async (stepNumber: number) => {
      await updateProgress({ currentStep: stepNumber });
    },
    [updateProgress]
  );

  // Mark onboarding as complete
  const markComplete = useCallback(async () => {
    await updateProgress({ completedAt: new Date().toISOString() });
  }, [updateProgress]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-initialize if no progress exists
  useEffect(() => {
    if (!isLoading && !progress && user?.id) {
      devLog('[OnboardingProgress] No existing progress, initializing...');
      initializeProgress.mutate('owner');
    }
  }, [isLoading, progress, user?.id]);

  // Auto-sync on mount and when coming back online
  useEffect(() => {
    const handleOnline = () => {
      devLog('[OnboardingProgress] Network online, attempting sync...');
      syncPendingChanges();
    };
    
    window.addEventListener('online', handleOnline);

    // Check for pending sync on mount
    if (user?.id && localStorage.getItem(PENDING_SYNC_KEY)) {
      setHasPendingSync(true);
      syncPendingChanges();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [syncPendingChanges, user?.id, PENDING_SYNC_KEY]);

  return {
    // State
    progress,
    isLoading,
    error,
    isSaving,
    lastSavedAt,
    isOffline,
    hasPendingSync,
    
    // Current values (convenience)
    currentStep: progress?.currentStep || 1,
    stepsCompleted: progress?.stepsCompleted || [],
    formData: progress?.formData || defaultFormData,
    onboardingType: progress?.onboardingType || 'owner',
    
    // Actions
    initializeProgress: initializeProgress.mutate,
    updateProgress,
    updateFormDataDebounced,
    completeStep,
    goToStep,
    markComplete,
    syncPendingChanges,
    refetch,
  };
}
