import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SpotlightTarget {
  selector: string;
  tooltip: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  pulse?: boolean;
}

interface TourSpotlightProps {
  targets: SpotlightTarget[];
  isVisible: boolean;
  onTargetClick?: (index: number) => void;
}

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const TourSpotlight = ({ 
  targets, 
  isVisible,
  onTargetClick 
}: TourSpotlightProps) => {
  const [elementRects, setElementRects] = useState<(ElementRect | null)[]>([]);
  const [prevRect, setPrevRect] = useState<ElementRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const primaryTargetIndex = useMemo(() => {
    const pulseIndex = targets.findIndex(t => t.pulse);
    return pulseIndex >= 0 ? pulseIndex : 0;
  }, [targets]);

  useEffect(() => {
    if (!isVisible || targets.length === 0) {
      setElementRects([]);
      return;
    }

    const updateRects = () => {
      const rects = targets.map(target => {
        const element = document.querySelector(target.selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      });
      setElementRects(rects);
    };

    updateRects();

    const handleUpdate = () => requestAnimationFrame(updateRects);
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [targets, isVisible]);

  const primaryRect = elementRects[primaryTargetIndex];
  
  // Track previous rect for zoom transitions
  useEffect(() => {
    if (primaryRect) {
      const timer = setTimeout(() => setPrevRect(primaryRect), 600);
      return () => clearTimeout(timer);
    }
  }, [primaryRect]);

  if (!isVisible || !primaryRect) return null;

  const padding = 10;
  const radius = 14;

  const generateClipPath = () => {
    const x = primaryRect.left - padding;
    const y = primaryRect.top - padding;
    const w = primaryRect.width + padding * 2;
    const h = primaryRect.height + padding * 2;
    
    let path = `M0,0 L${window.innerWidth},0 L${window.innerWidth},${window.innerHeight} L0,${window.innerHeight} Z `;
    path += `M${x + radius},${y} `;
    path += `L${x + w - radius},${y} `;
    path += `Q${x + w},${y} ${x + w},${y + radius} `;
    path += `L${x + w},${y + h - radius} `;
    path += `Q${x + w},${y + h} ${x + w - radius},${y + h} `;
    path += `L${x + radius},${y + h} `;
    path += `Q${x},${y + h} ${x},${y + h - radius} `;
    path += `L${x},${y + radius} `;
    path += `Q${x},${y} ${x + radius},${y} Z `;
    
    return path;
  };

  // Calculate zoom transform origin
  const centerX = primaryRect.left + primaryRect.width / 2;
  const centerY = primaryRect.top + primaryRect.height / 2;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[90] pointer-events-none">
      {/* Cinematic dark overlay with animated cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          {/* Radial gradient for softer edges */}
          <radialGradient id="spotlight-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.8)" />
          </radialGradient>
        </defs>
        <motion.path
          d={generateClipPath()}
          fill="rgba(0, 0, 0, 0.78)"
          fillRule="evenodd"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </svg>

      {/* Cinematic spotlight ring with zoom animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`ring-${primaryTargetIndex}-${primaryRect.left}-${primaryRect.top}`}
          initial={{ 
            opacity: 0, 
            scale: 1.8,
            x: (prevRect ? prevRect.left - primaryRect.left : 0),
            y: (prevRect ? prevRect.top - primaryRect.top : 0),
          }}
          animate={{ 
            opacity: 1, 
            scale: 1,
            x: 0,
            y: 0,
          }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 25,
            mass: 0.8,
          }}
          className="absolute pointer-events-none"
          style={{
            top: primaryRect.top - padding,
            left: primaryRect.left - padding,
            width: primaryRect.width + padding * 2,
            height: primaryRect.height + padding * 2,
          }}
        >
          {/* Outer glow ring */}
          <motion.div
            className="absolute -inset-2 rounded-2xl"
            animate={{
              boxShadow: [
                '0 0 20px 8px hsl(var(--primary) / 0.15), 0 0 60px 20px hsl(var(--primary) / 0.08)',
                '0 0 30px 12px hsl(var(--primary) / 0.25), 0 0 80px 30px hsl(var(--primary) / 0.12)',
                '0 0 20px 8px hsl(var(--primary) / 0.15), 0 0 60px 20px hsl(var(--primary) / 0.08)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Inner animated border */}
          <motion.div
            className="absolute inset-0 rounded-xl overflow-hidden"
            style={{ padding: '2px' }}
          >
            <motion.div
              className="absolute inset-0 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.3), hsl(var(--primary)))',
                backgroundSize: '200% 200%',
              }}
              animate={{
                backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute inset-[2px] rounded-[10px] bg-transparent" />
          </motion.div>

          {/* Pulse ring that expands outward */}
          {targets[primaryTargetIndex]?.pulse && (
            <motion.div
              className="absolute inset-0 rounded-xl border-2 border-primary/40"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.6, 0, 0.6],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          )}

          {/* Sparkle particles */}
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-primary/60"
              style={{
                top: `${[10, 90, 50, 50][i]}%`,
                left: `${[50, 50, 10, 90][i]}%`,
              }}
              animate={{
                scale: [0, 1.5, 0],
                opacity: [0, 0.8, 0],
                y: [0, [-12, 12, -8, 8][i]],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.5,
                ease: 'easeOut',
              }}
            />
          ))}
          
          {/* Click target */}
          <div 
            className="absolute inset-0 rounded-xl cursor-pointer pointer-events-auto"
            onClick={() => onTargetClick?.(primaryTargetIndex)}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TourSpotlight;
