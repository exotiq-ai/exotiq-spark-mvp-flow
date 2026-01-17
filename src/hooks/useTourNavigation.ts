import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface TourStep {
  id: string;
  module: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  spotlights: SpotlightTarget[];
  duration?: number;
}

export interface SpotlightTarget {
  selector: string;
  tooltip: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  pulse?: boolean;
}

interface UseTourNavigationOptions {
  steps: TourStep[];
  onModuleChange: (moduleId: string) => void;
  onComplete?: () => void;
}

export const useTourNavigation = ({
  steps,
  onModuleChange,
  onComplete,
}: UseTourNavigationOptions) => {
  const { user } = useAuth();
  
  // Database-backed tour completion status
  const [tourComplete, setTourComplete] = useState<boolean | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [spotlightsReady, setSpotlightsReady] = useState(false);

  const currentStep = steps[currentStepIndex] || null;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Fetch tour_completed from database on mount
  useEffect(() => {
    const fetchTourStatus = async () => {
      if (!user?.id) {
        setTourComplete(null);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('tour_completed')
        .eq('id', user.id)
        .single();

      setTourComplete(data?.tour_completed ?? false);
    };

    fetchTourStatus();
  }, [user?.id]);

  // Update database when tour is completed
  const markTourCompletedInDB = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ tour_completed: true })
        .eq('id', user.id);
    } catch {
      // Silent fail - we tried
    }
  }, [user?.id]);

  // Reset tour_completed in database (for restart)
  const resetTourInDB = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ tour_completed: false })
        .eq('id', user.id);
      setTourComplete(false);
    } catch {
      // Silent fail
    }
  }, [user?.id]);

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
    setSpotlightsReady(false);
  }, []);

  const endTour = useCallback((completed: boolean = false) => {
    setIsActive(false);
    setCurrentStepIndex(0);
    setSpotlightsReady(false);
    
    if (completed) {
      setTourComplete(true);
      void markTourCompletedInDB();
      onComplete?.();
    }
  }, [markTourCompletedInDB, onComplete]);

  const goToStep = useCallback(async (stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= steps.length) return;
    
    const targetStep = steps[stepIndex];
    
    // If module is different, navigate first
    if (targetStep.module !== currentStep?.module) {
      setIsTransitioning(true);
      setSpotlightsReady(false);
      onModuleChange(targetStep.module);
      
      // Wait for module to render (reduced for snappier transitions)
      await new Promise(resolve => setTimeout(resolve, 300));
      setIsTransitioning(false);
    }
    
    setCurrentStepIndex(stepIndex);
    
    // Wait for spotlights to find elements
    if (targetStep.spotlights.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    setSpotlightsReady(true);
  }, [steps, currentStep, onModuleChange]);

  const nextStep = useCallback(() => {
    if (isLastStep) {
      endTour(true);
    } else {
      goToStep(currentStepIndex + 1);
    }
  }, [isLastStep, currentStepIndex, goToStep, endTour]);

  const prevStep = useCallback(() => {
    if (!isFirstStep) {
      goToStep(currentStepIndex - 1);
    }
  }, [isFirstStep, currentStepIndex, goToStep]);

  const skipTour = useCallback(() => {
    // Skipping also marks as completed to prevent re-showing
    setTourComplete(true);
    void markTourCompletedInDB();
    setIsActive(false);
    setCurrentStepIndex(0);
    setSpotlightsReady(false);
  }, [markTourCompletedInDB]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          nextStep();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prevStep();
          break;
        case 'Escape':
          e.preventDefault();
          skipTour();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, prevStep, skipTour]);

  // Auto-advance for steps with duration
  useEffect(() => {
    if (!isActive || !currentStep?.duration || isTransitioning) return;

    const timer = setTimeout(() => {
      nextStep();
    }, currentStep.duration);

    return () => clearTimeout(timer);
  }, [isActive, currentStep, isTransitioning, nextStep]);

  return {
    isActive,
    currentStep,
    currentStepIndex,
    isFirstStep,
    isLastStep,
    isTransitioning,
    spotlightsReady,
    progress,
    tourComplete,
    startTour,
    endTour,
    nextStep,
    prevStep,
    skipTour,
    goToStep,
    resetTourInDB,
  };
};
