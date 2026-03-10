import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useDemoScript } from '@/hooks/useDemoScript';
import { useDemoOrchestrator } from '@/hooks/useDemoOrchestrator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { 
  Play, 
  Pause, 
  SkipForward, 
  X, 
  Volume2, 
  VolumeX,
  Brain
} from 'lucide-react';

interface AutomatedDemoTourProps {
  onModuleChange: (moduleId: string) => void;
}

export const AutomatedDemoTour = ({ onModuleChange }: AutomatedDemoTourProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const steps = useDemoScript();
  
  const demo = useDemoOrchestrator({
    steps,
    onModuleChange,
    onComplete: () => {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#0B3D91', '#FF6B35', '#FFD700'],
      });
      toast({
        title: "Full Tour Complete! 🎉",
        description: "You've seen everything Exotiq has to offer.",
        duration: 5000,
      });
      // Mark tour as completed
      if (user?.id) {
        supabase.from('profiles').update({ tour_completed: true }).eq('id', user.id).then(() => {});
      }
    },
  });

  // Listen for 'start-demo-tour' events
  useEffect(() => {
    const handler = () => demo.start();
    window.addEventListener('start-demo-tour', handler);
    return () => window.removeEventListener('start-demo-tour', handler);
  }, [demo.start]);

  if (!demo.isActive) return null;

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <AnimatePresence>
      {/* Cinematic zoom overlay */}
      {demo.zoomTarget && (
        <motion.div
          className="fixed inset-0 z-[80] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Vignette effect */}
          <div 
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at ${demo.zoomTarget.x}px ${demo.zoomTarget.y}px, transparent 30%, rgba(0,0,0,0.4) 100%)`,
            }}
          />
        </motion.div>
      )}

      {/* Subtitle bar */}
      {demo.currentStep && (
        <motion.div
          key={`subtitle-${demo.currentStep.id}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
        >
          <div className={cn(
            'px-6 py-3 rounded-2xl max-w-lg text-center',
            'bg-background/90 backdrop-blur-xl',
            'border border-border/50',
            'shadow-xl'
          )}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">Rari</span>
              {demo.isSpeaking && (
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
            </div>
            <p className="text-sm text-foreground font-medium">
              {demo.currentStep.subtitle}
            </p>
          </div>
        </motion.div>
      )}

      {/* Control bar at bottom */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-auto"
      >
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-2xl',
          'bg-background/95 backdrop-blur-xl',
          'border border-border/50',
          'shadow-2xl'
        )}>
          {/* Step indicator */}
          <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
            {demo.currentStepIndex + 1}/{demo.totalSteps}
          </span>

          {/* Progress bar */}
          <div className="w-32 sm:w-48 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${demo.progress}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={demo.isPaused ? demo.resume : demo.pause}
            >
              {demo.isPaused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </Button>
            
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={demo.skipToNext}
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={demo.stop}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Time remaining */}
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            ~{formatTime(demo.estimatedTimeRemaining)} left
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AutomatedDemoTour;
