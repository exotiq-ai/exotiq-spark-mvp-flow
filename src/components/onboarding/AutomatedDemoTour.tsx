import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useDemoScript } from '@/hooks/useDemoScript';
import { useDemoOrchestrator } from '@/hooks/useDemoOrchestrator';
import { useAuth } from '@/contexts/AuthContext';
import { useTourData } from '@/contexts/TourDataContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RariCursor } from './RariCursor';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { 
  Play, Pause, SkipForward, X, 
  Volume2, VolumeX, Brain
} from 'lucide-react';

interface AutomatedDemoTourProps {
  onModuleChange: (moduleId: string) => void;
}

const fireFullScreenConfetti = () => {
  // Left burst
  confetti({ particleCount: 120, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors: ['#0B3D91', '#FF6B35', '#FFD700'] });
  // Right burst
  confetti({ particleCount: 120, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: ['#0B3D91', '#FF6B35', '#FFD700'] });
  // Center burst for extra density
  setTimeout(() => {
    confetti({ particleCount: 80, spread: 100, origin: { x: 0.5, y: 0.5 }, colors: ['#0B3D91', '#FF6B35', '#FFD700'] });
  }, 200);
};

export const AutomatedDemoTour = ({ onModuleChange }: AutomatedDemoTourProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activateTour, deactivateTour } = useTourData();
  const steps = useDemoScript();
  
  const demo = useDemoOrchestrator({
    steps,
    onModuleChange,
    onComplete: () => {
      deactivateTour(true);
      fireFullScreenConfetti();
      toast({
        title: "Tour Complete! 🎉",
        description: "Now let's set up your fleet.",
        duration: 5000,
      });
      if (user?.id) {
        supabase.from('profiles').update({ tour_completed: true }).eq('id', user.id).then(() => {});
      }
    },
  });

  // Listen for 'start-demo-tour' events
  useEffect(() => {
    const handler = async () => {
      const success = await activateTour();
      if (success) {
        setTimeout(() => demo.start(), 300);
      }
    };
    window.addEventListener('start-demo-tour', handler);
    return () => window.removeEventListener('start-demo-tour', handler);
  }, [demo.start, activateTour]);

  // Keyboard controls
  useEffect(() => {
    if (!demo.isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': e.preventDefault(); demo.stop(); break;
        case ' ': e.preventDefault(); demo.isPaused ? demo.resume() : demo.pause(); break;
        case 'ArrowRight': e.preventDefault(); demo.skipToNext(); break;
        case 'm': case 'M': e.preventDefault(); demo.toggleMute(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [demo.isActive, demo.isPaused, demo.stop, demo.pause, demo.resume, demo.skipToNext, demo.toggleMute]);

  const formatTime = useCallback((ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }, []);

  if (!demo.isActive) return null;

  return (
    <AnimatePresence>
      {/* Rari animated cursor */}
      <RariCursor
        target={demo.cursorTarget}
        clicking={demo.cursorClicking}
        visible={demo.isActive}
      />

      {/* Cinematic vignette overlay */}
      {demo.zoomTarget && (
        <motion.div
          className="fixed inset-0 z-[80] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div 
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at ${demo.zoomTarget.x}px ${demo.zoomTarget.y}px, transparent 30%, rgba(0,0,0,0.4) 100%)`,
            }}
          />
        </motion.div>
      )}

      {/* Subtitle bar — top center */}
      {demo.currentStep && (
        <motion.div
          key={`subtitle-${demo.currentStep.id}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-none max-w-[90vw]"
        >
          <div className={cn(
            'px-4 sm:px-6 py-3 rounded-2xl max-w-lg text-center',
            'bg-background/90 backdrop-blur-xl',
            'border border-border/50',
            'shadow-xl'
          )}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">Rari</span>
              {demo.isSpeaking && !demo.isMuted && (
                <motion.div
                  className="flex gap-0.5"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-primary rounded-full"
                      animate={{ height: [4, 12, 4] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </motion.div>
              )}
              {demo.isMuted && (
                <VolumeX className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-foreground font-medium">
              {demo.currentStep.subtitle}
            </p>
          </div>
        </motion.div>
      )}

      {/* Control bar — bottom center */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-auto max-w-[95vw]"
      >
        <div className={cn(
          'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl',
          'bg-background/95 backdrop-blur-xl',
          'border border-border/50',
          'shadow-2xl'
        )}>
          <span className="text-[10px] sm:text-xs text-muted-foreground font-mono min-w-[40px] sm:min-w-[60px] text-center">
            {demo.currentStepIndex + 1}/{demo.totalSteps}
          </span>

          <div className="w-20 sm:w-32 md:w-48 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${demo.progress}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8" onClick={demo.toggleMute} title={demo.isMuted ? 'Unmute (M)' : 'Mute (M)'}>
              {demo.isMuted ? <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8" onClick={demo.isPaused ? demo.resume : demo.pause} title={demo.isPaused ? 'Resume (Space)' : 'Pause (Space)'}>
              {demo.isPaused ? <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8" onClick={demo.skipToNext} title="Skip (→)">
              <SkipForward className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive" onClick={demo.stop} title="Exit (Esc)">
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>

          <span className="text-[10px] text-muted-foreground hidden md:block whitespace-nowrap">
            ~{formatTime(demo.estimatedTimeRemaining)}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AutomatedDemoTour;
