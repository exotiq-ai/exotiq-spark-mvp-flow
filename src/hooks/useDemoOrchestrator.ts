import { useState, useCallback, useRef, useEffect } from 'react';
import { DemoStep } from './useDemoScript';

interface UseDemoOrchestratorOptions {
  steps: DemoStep[];
  onModuleChange: (moduleId: string) => void;
  onComplete?: () => void;
}

export const useDemoOrchestrator = ({
  steps,
  onModuleChange,
  onComplete,
}: UseDemoOrchestratorOptions) => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [zoomTarget, setZoomTarget] = useState<{ x: number; y: number; scale: number } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const pausedRef = useRef(false);

  const currentStep = steps[currentStepIndex] || null;
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;
  const estimatedTimeRemaining = steps.slice(currentStepIndex).reduce((sum, s) => sum + s.duration, 0);

  // Keep refs in sync
  useEffect(() => { activeRef.current = isActive; }, [isActive]);
  useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const zoomToElement = useCallback((selector: string, zoomLevel: number = 1.2) => {
    const el = document.querySelector(selector);
    if (!el) {
      setZoomTarget(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    setZoomTarget({ x: centerX, y: centerY, scale: zoomLevel });
  }, []);

  const speakNarration = useCallback(async (text: string): Promise<void> => {
    try {
      setIsSpeaking(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            text, 
            voiceId: 'JBFqnCBsd6RMkjVDRZzb' // George - professional male
          }),
        }
      );

      if (!response.ok) throw new Error('TTS failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      return new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          resolve();
        };
        audio.play().catch(() => {
          setIsSpeaking(false);
          resolve();
        });
      });
    } catch {
      setIsSpeaking(false);
      // Fallback: just wait the duration
      return new Promise<void>(resolve => {
        timerRef.current = setTimeout(resolve, 3000);
      });
    }
  }, []);

  const executeStep = useCallback(async (stepIndex: number) => {
    if (!activeRef.current || stepIndex >= steps.length) {
      if (stepIndex >= steps.length) {
        setIsActive(false);
        setZoomTarget(null);
        onComplete?.();
      }
      return;
    }

    // Wait while paused
    while (pausedRef.current && activeRef.current) {
      await new Promise(r => setTimeout(r, 200));
    }
    if (!activeRef.current) return;

    const step = steps[stepIndex];
    setCurrentStepIndex(stepIndex);
    setIsTransitioning(true);

    // Navigate to module
    onModuleChange(step.module);
    await new Promise(r => setTimeout(r, 400));
    setIsTransitioning(false);

    // Click tab if specified
    if (step.tabSelector) {
      await new Promise(r => setTimeout(r, 200));
      const tabEl = document.querySelector(step.tabSelector);
      if (tabEl instanceof HTMLElement) tabEl.click();
      await new Promise(r => setTimeout(r, 300));
    }

    // Zoom to element
    if (step.selector && step.zoomLevel) {
      zoomToElement(step.selector, step.zoomLevel);
    } else {
      setZoomTarget(null);
    }

    // Scroll element into view
    if (step.selector) {
      const el = document.querySelector(step.selector);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 300));
    }

    // Narrate (or fallback to duration)
    await speakNarration(step.narration);
    
    // Brief pause between steps
    await new Promise(r => setTimeout(r, 500));

    // Move to next
    if (activeRef.current) {
      executeStep(stepIndex + 1);
    }
  }, [steps, onModuleChange, zoomToElement, speakNarration, onComplete]);

  const start = useCallback(() => {
    cleanup();
    setIsActive(true);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setZoomTarget(null);
    // Small delay to let state settle
    setTimeout(() => executeStep(0), 100);
  }, [cleanup, executeStep]);

  const pause = useCallback(() => {
    setIsPaused(true);
    if (audioRef.current) audioRef.current.pause();
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    if (audioRef.current) audioRef.current.play().catch(() => {});
  }, []);

  const skipToNext = useCallback(() => {
    cleanup();
    const next = currentStepIndex + 1;
    if (next < steps.length) {
      executeStep(next);
    } else {
      setIsActive(false);
      setZoomTarget(null);
      onComplete?.();
    }
  }, [cleanup, currentStepIndex, steps.length, executeStep, onComplete]);

  const stop = useCallback(() => {
    cleanup();
    setIsActive(false);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setZoomTarget(null);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  return {
    isActive,
    isPaused,
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
    progress,
    estimatedTimeRemaining,
    isTransitioning,
    zoomTarget,
    isSpeaking,
    start,
    pause,
    resume,
    skipToNext,
    stop,
  };
};
