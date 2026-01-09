import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAuth } from '@/contexts/AuthContext';

export interface TourStep {
  id: string;
  module: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  spotlights: SpotlightTarget[];
  microInteraction?: MicroInteraction;
  duration?: number;
}

export interface SpotlightTarget {
  selector: string;
  tooltip: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  pulse?: boolean;
}

export interface MicroInteraction {
  type: 'click' | 'hover' | 'input';
  target: string;
  prompt: string;
  onComplete?: () => void;
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
  const storageKey = user?.id ? `interactive-tour-complete-${user.id}` : 'interactive-tour-complete';
  const [tourComplete, setTourComplete] = useLocalStorage(storageKey, false);
  
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [spotlightsReady, setSpotlightsReady] = useState(false);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  
  // Estimate remaining time (roughly 20 seconds per step)
  const remainingSteps = steps.length - currentStepIndex - 1;
  const estimatedTimeRemaining = Math.ceil(remainingSteps * 0.3); // in minutes

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
      onComplete?.();
    }
  }, [setTourComplete, onComplete]);

  const goToStep = useCallback(async (stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= steps.length) return;
    
    const targetStep = steps[stepIndex];
    
    // If module is different, navigate first
    if (targetStep.module !== currentStep.module) {
      setIsTransitioning(true);
      setSpotlightsReady(false);
      onModuleChange(targetStep.module);
      
      // Wait for module to render
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsTransitioning(false);
    }
    
    setCurrentStepIndex(stepIndex);
    
    // Wait for spotlights to find elements
    if (targetStep.spotlights.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 300));
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
    endTour(false);
  }, [endTour]);

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
    estimatedTimeRemaining,
    tourComplete,
    startTour,
    endTour,
    nextStep,
    prevStep,
    skipTour,
    goToStep,
  };
};
