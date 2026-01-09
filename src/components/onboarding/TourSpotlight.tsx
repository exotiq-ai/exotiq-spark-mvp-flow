import { useEffect, useState, useRef } from 'react';
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

  const validRects = elementRects.filter(rect => rect !== null);
  if (!isVisible || validRects.length === 0) return null;

  // Generate SVG path for spotlight cutouts
  const generateClipPath = () => {
    const padding = 8;
    const radius = 12;
    
    // Start with full screen rect
    let path = `M0,0 L${window.innerWidth},0 L${window.innerWidth},${window.innerHeight} L0,${window.innerHeight} Z `;
    
    // Add cutout for each valid element
    elementRects.forEach(rect => {
      if (!rect) return;
      
      const x = rect.left - padding;
      const y = rect.top - padding;
      const w = rect.width + padding * 2;
      const h = rect.height + padding * 2;
      
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
    });
    
    return path;
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-[90] pointer-events-none">
      {/* Dark overlay with spotlight cutouts */}
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ mixBlendMode: 'normal' }}
      >
        <defs>
          <filter id="tour-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" />
          </filter>
        </defs>
        <path
          d={generateClipPath()}
          fill="rgba(0, 0, 0, 0.75)"
          fillRule="evenodd"
        />
      </svg>

      {/* Spotlight rings around elements */}
      <AnimatePresence>
        {elementRects.map((rect, idx) => {
          if (!rect) return null;
          const target = targets[idx];
          
          return (
            <motion.div
              key={`ring-${idx}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "absolute pointer-events-auto rounded-xl",
                "ring-2 ring-primary ring-offset-2 ring-offset-transparent",
                target.pulse && "animate-pulse"
              )}
              style={{
                top: rect.top - 4,
                left: rect.left - 4,
                width: rect.width + 8,
                height: rect.height + 8,
              }}
              onClick={() => onTargetClick?.(idx)}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default TourSpotlight;
