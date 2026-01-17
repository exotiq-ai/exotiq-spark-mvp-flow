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
  const containerRef = useRef<HTMLDivElement>(null);

  // Only show the FIRST target with pulse=true, or the first target overall
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
        return {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      });
      setElementRects(rects);
    };

    // Initial update
    updateRects();

    // Update on scroll/resize
    const handleUpdate = () => {
      requestAnimationFrame(updateRects);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [targets, isVisible]);

  // Only show the primary target's rect
  const primaryRect = elementRects[primaryTargetIndex];
  if (!isVisible || !primaryRect) return null;

  const padding = 8;
  const radius = 12;

  // Generate SVG path for spotlight cutout - only for primary target
  const generateClipPath = () => {
    const x = primaryRect.left - padding;
    const y = primaryRect.top - padding;
    const w = primaryRect.width + padding * 2;
    const h = primaryRect.height + padding * 2;
    
    // Start with full screen rect
    let path = `M0,0 L${window.innerWidth},0 L${window.innerWidth},${window.innerHeight} L0,${window.innerHeight} Z `;
    
    // Rounded rectangle cutout (drawn counter-clockwise to create hole)
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

  return (
    <div ref={containerRef} className="fixed inset-0 z-[90] pointer-events-none">
      {/* Dark overlay with spotlight cutout - animated path */}
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ mixBlendMode: 'normal' }}
      >
        <motion.path
          d={generateClipPath()}
          fill="rgba(0, 0, 0, 0.75)"
          fillRule="evenodd"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </svg>

      {/* Spotlight ring with glow effect - only for primary target */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`ring-${primaryTargetIndex}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute pointer-events-none"
          style={{
            top: primaryRect.top - padding,
            left: primaryRect.left - padding,
            width: primaryRect.width + padding * 2,
            height: primaryRect.height + padding * 2,
          }}
        >
          {/* Glow effect */}
          <div 
            className="absolute inset-0 rounded-xl"
            style={{
              boxShadow: '0 0 30px 10px hsl(var(--primary) / 0.25)',
            }}
          />
          
          {/* Animated ring */}
          <motion.div
            className={cn(
              "absolute inset-0 rounded-xl",
              "ring-2 ring-primary",
              targets[primaryTargetIndex]?.pulse && "animate-pulse"
            )}
            animate={{
              boxShadow: [
                '0 0 0 0 hsl(var(--primary) / 0.4)',
                '0 0 0 8px hsl(var(--primary) / 0)',
              ],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
          
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
