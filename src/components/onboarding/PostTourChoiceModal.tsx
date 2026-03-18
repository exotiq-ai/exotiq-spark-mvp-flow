import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Car, Upload, Compass, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface PostTourChoiceModalProps {
  open: boolean;
  onAddVehicle: () => void;
  onImportFleet: () => void;
  onExplore: () => void;
}

const fireFullScreenConfetti = () => {
  confetti({ particleCount: 120, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors: ['#0B3D91', '#FF6B35', '#FFD700'] });
  confetti({ particleCount: 120, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: ['#0B3D91', '#FF6B35', '#FFD700'] });
};

export const PostTourChoiceModal = ({
  open,
  onAddVehicle,
  onImportFleet,
  onExplore,
}: PostTourChoiceModalProps) => {
  const handleChoice = (action: () => void) => {
    fireFullScreenConfetti();
    action();
  };

  if (!open) return null;

  const choices = [
    {
      id: 'add',
      icon: Car,
      title: 'Add Your First Vehicle',
      description: 'Manually enter vehicle details and photos',
      action: onAddVehicle,
      primary: true,
    },
    {
      id: 'import',
      icon: Upload,
      title: 'Import Fleet from CSV',
      description: 'Bulk import your entire inventory at once',
      action: onImportFleet,
      primary: false,
    },
    {
      id: 'explore',
      icon: Compass,
      title: 'Explore on My Own',
      description: 'Browse around freely — setup checklist will guide you',
      action: onExplore,
      primary: false,
    },
  ];

  return (
    <AnimatePresence>
      {/* Backdrop — clicking it does NOT dismiss */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onExplore}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      >
        {/* Inner card — stop propagation to be safe */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'w-full max-w-lg rounded-2xl p-6 sm:p-8',
            'bg-card border border-border',
            'shadow-2xl'
          )}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 15 }}
              className="inline-flex h-12 w-12 rounded-full bg-primary/10 items-center justify-center mb-3"
            >
              <Sparkles className="h-6 w-6 text-primary" />
            </motion.div>
            <h2 className="text-xl font-bold text-foreground">
              Ready to set up your fleet?
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              You've seen what Exotiq can do. Now let's make it yours.
            </p>
          </div>

          {/* Choice Cards */}
          <div className="space-y-3">
            {choices.map((choice, i) => {
              const Icon = choice.icon;
              return (
                <motion.button
                  key={choice.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  onClick={() => handleChoice(choice.action)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all',
                    'border hover:shadow-md',
                    choice.primary
                      ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <div className={cn(
                    'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                    choice.primary
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={cn(
                      'font-medium text-sm',
                      choice.primary ? 'text-primary' : 'text-foreground'
                    )}>
                      {choice.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {choice.description}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
