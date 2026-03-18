import { motion, AnimatePresence } from 'framer-motion';
import { Brain } from 'lucide-react';

interface RariCursorProps {
  target: { x: number; y: number } | null;
  clicking: boolean;
  visible: boolean;
}

export const RariCursor = ({ target, clicking, visible }: RariCursorProps) => {
  if (!visible || !target) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed z-[190] pointer-events-none"
        initial={{ opacity: 0, x: target.x - 16, y: target.y - 16 }}
        animate={{
          opacity: 1,
          x: target.x - 16,
          y: target.y - 16,
          scale: clicking ? 0.8 : 1,
        }}
        transition={{
          x: { type: 'spring', stiffness: 120, damping: 20 },
          y: { type: 'spring', stiffness: 120, damping: 20 },
          scale: { duration: 0.15 },
          opacity: { duration: 0.3 },
        }}
      >
        {/* Pointer arrow tip */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          className="absolute -top-2 -left-2 drop-shadow-lg"
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
        >
          <path
            d="M4 4 L4 24 L10 18 L18 18 Z"
            fill="hsl(var(--primary))"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="1.5"
          />
        </svg>

        {/* Rari brain badge */}
        <motion.div
          className="absolute top-3 left-3 h-7 w-7 rounded-full bg-primary flex items-center justify-center shadow-lg"
          animate={clicking ? { scale: [1, 0.7, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Brain className="h-3.5 w-3.5 text-primary-foreground" />
        </motion.div>

        {/* Click ripple */}
        {clicking && (
          <motion.div
            className="absolute top-0 left-0 h-8 w-8 rounded-full border-2 border-primary/50"
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}

        {/* Subtle pulsing glow when hovering */}
        {!clicking && (
          <motion.div
            className="absolute top-2 left-2 h-8 w-8 rounded-full bg-primary/20"
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.15, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
