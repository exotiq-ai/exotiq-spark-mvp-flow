import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  const [isMuted, setIsMuted] = useState(false);
  const [cursorTarget, setCursorTarget] = useState<{ x: number; y: number } | null>(null);
  const [cursorClicking, setCursorClicking] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const pausedRef = useRef(false);
  const mutedRef = useRef(false);
  const stepIndexRef = useRef(0);

  const currentStep = steps[currentStepIndex] || null;
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;
  const estimatedTimeRemaining = steps.slice(currentStepIndex).reduce((sum, s) => sum + s.duration, 0);

  // Keep refs in sync
  useEffect(() => { activeRef.current = isActive; }, [isActive]);
  useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { mutedRef.current = isMuted; }, [isMuted]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setCursorTarget(null);
    setCursorClicking(false);
  }, []);

  const getElementCenter = useCallback((selector: string): { x: number; y: number } | null => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  const zoomToElement = useCallback((selector: string, zoomLevel: number = 1.2) => {
    const center = getElementCenter(selector);
    if (!center) {
      setZoomTarget(null);
      return;
    }
    setZoomTarget({ x: center.x, y: center.y, scale: zoomLevel });
  }, [getElementCenter]);

  // Pronunciation fixes for ElevenLabs
  const fixPronunciation = (text: string): string => {
    return text
      .replace(/\bRari\b/g, 'Rarri')
      .replace(/\bExotiq\b/g, 'Exotique')
      .replace(/\bMotorIQ\b/g, 'Motor I.Q.');
  };

  const speakNarration = useCallback(async (text: string, fallbackDuration: number): Promise<void> => {
    if (mutedRef.current) {
      setIsSpeaking(true);
      return new Promise<void>((resolve) => {
        timerRef.current = setTimeout(() => {
          setIsSpeaking(false);
          resolve();
        }, fallbackDuration);
      });
    }

    try {
      setIsSpeaking(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No auth session');

      const processedText = fixPronunciation(text);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ text: processedText }),
        }
      );

      if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
      const data = await response.json();
      if (!data.audioContent) throw new Error('No audio content in response');

      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      return new Promise<void>((resolve) => {
        const finish = () => {
          setIsSpeaking(false);
          resolve();
        };
        audio.onended = finish;
        audio.onerror = () => {
          console.warn('Audio playback error, using fallback duration');
          finish();
        };
        audio.play().catch(() => {
          timerRef.current = setTimeout(finish, fallbackDuration);
        });
      });
    } catch (err) {
      console.warn('TTS error, using fallback duration:', err);
      setIsSpeaking(false);
      return new Promise<void>(resolve => {
        timerRef.current = setTimeout(resolve, fallbackDuration);
      });
    }
  }, []);

  const waitWhilePaused = useCallback(async () => {
    if (pausedRef.current && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    while (pausedRef.current && activeRef.current) {
      await new Promise(r => setTimeout(r, 200));
    }
    if (!pausedRef.current && audioRef.current && audioRef.current.paused && audioRef.current.currentTime > 0) {
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const executeStep = useCallback(async (stepIndex: number) => {
    if (!activeRef.current || stepIndex >= steps.length) {
      if (stepIndex >= steps.length) {
        setIsActive(false);
        setZoomTarget(null);
        setCursorTarget(null);
        onComplete?.();
      }
      return;
    }

    await waitWhilePaused();
    if (!activeRef.current) return;

    const step = steps[stepIndex];
    setCurrentStepIndex(stepIndex);
    stepIndexRef.current = stepIndex;
    setIsTransitioning(true);

    // Navigate to module — slower transition
    onModuleChange(step.module);
    await new Promise(r => setTimeout(r, 1200));
    setIsTransitioning(false);

    // Move cursor to tab and click if specified
    if (step.tabSelector) {
      const tabCenter = getElementCenter(step.tabSelector);
      if (tabCenter) {
        setCursorTarget(tabCenter);
        await new Promise(r => setTimeout(r, 800)); // cursor travel time
        
        // Click animation
        setCursorClicking(true);
        await new Promise(r => setTimeout(r, 300));
        const tabEl = document.querySelector(step.tabSelector);
        if (tabEl instanceof HTMLElement) tabEl.click();
        await new Promise(r => setTimeout(r, 200));
        setCursorClicking(false);
        
        await new Promise(r => setTimeout(r, 1200)); // let tab content settle
      }
    }

    // Move cursor to target element, then zoom
    if (step.selector) {
      const elCenter = getElementCenter(step.selector);
      if (elCenter) {
        setCursorTarget(elCenter);
        await new Promise(r => setTimeout(r, 600)); // cursor travel
      }

      if (step.zoomLevel) {
        zoomToElement(step.selector, step.zoomLevel);
      }

      const el = document.querySelector(step.selector);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 800));
    } else {
      setZoomTarget(null);
      // For module-level steps with no selector, park cursor off-screen
      setCursorTarget(null);
    }

    // Check pause again before narration
    await waitWhilePaused();
    if (!activeRef.current) return;

    // Narrate
    await speakNarration(step.narration, step.duration);
    
    // Longer pause between steps for breathing room
    await new Promise(r => setTimeout(r, 1500));

    // Move to next step
    if (activeRef.current) {
      executeStep(stepIndex + 1);
    }
  }, [steps, onModuleChange, zoomToElement, getElementCenter, speakNarration, waitWhilePaused, onComplete]);

  const start = useCallback(() => {
    cleanup();
    setIsActive(true);
    setIsPaused(false);
    setCurrentStepIndex(0);
    stepIndexRef.current = 0;
    setZoomTarget(null);
    setCursorTarget(null);
    setTimeout(() => executeStep(0), 150);
  }, [cleanup, executeStep]);

  const pause = useCallback(() => {
    setIsPaused(true);
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    if (audioRef.current && audioRef.current.paused && audioRef.current.currentTime > 0) {
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const skipToNext = useCallback(() => {
    cleanup();
    const next = stepIndexRef.current + 1;
    if (next < steps.length) {
      executeStep(next);
    } else {
      setIsActive(false);
      setZoomTarget(null);
      setCursorTarget(null);
      onComplete?.();
    }
  }, [cleanup, steps.length, executeStep, onComplete]);

  const stop = useCallback(() => {
    cleanup();
    setIsActive(false);
    setIsPaused(false);
    setCurrentStepIndex(0);
    stepIndexRef.current = 0;
    setZoomTarget(null);
    setCursorTarget(null);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  return {
    isActive,
    isPaused,
    isMuted,
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
    progress,
    estimatedTimeRemaining,
    isTransitioning,
    zoomTarget,
    isSpeaking,
    cursorTarget,
    cursorClicking,
    start,
    pause,
    resume,
    skipToNext,
    stop,
    toggleMute,
  };
};
