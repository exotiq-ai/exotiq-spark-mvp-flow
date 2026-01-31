import { useState, useEffect, useCallback, useRef } from 'react';
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
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      } catch (error) {
        devError('[OnboardingProgress] Save error:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id, currentTeam?.id, progress?.formData, progress?.teamId, queryClient]
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

  return {
    // State
    progress,
    isLoading,
    error,
    isSaving,
    lastSavedAt,
    
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
    refetch,
  };
}
