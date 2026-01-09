import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TooltipPosition {
  top: number;
  left: number;
}

interface TourTooltipProps {
  targetSelector: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  isVisible: boolean;
  className?: string;
}

export const TourTooltip = ({
  targetSelector,
  content,
  position,
  isVisible,
  className,
}: TourTooltipProps) => {
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) {
      setTooltipPos(null);
      return;
    }

    const updatePosition = () => {
      const element = document.querySelector(targetSelector);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const tooltipHeight = 60; // Approximate
      const tooltipWidth = 200; // Approximate
      const gap = 12;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top - tooltipHeight - gap;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - gap;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + gap;
          break;
      }

      // Keep tooltip in viewport
      top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));
      left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

      setTooltipPos({ top, left });
    };

    updatePosition();

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [targetSelector, position, isVisible]);

  if (!isVisible || !tooltipPos) return null;

  const arrowClasses = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-l-transparent border-r-transparent border-b-transparent border-t-background/95',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-l-transparent border-r-transparent border-t-transparent border-b-background/95',
    left: 'right-0 top-1/2 translate-x-full -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-background/95',
    right: 'left-0 top-1/2 -translate-x-full -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-background/95',
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={tooltipRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "fixed z-[95] pointer-events-none",
          "max-w-[200px] px-3 py-2 rounded-lg",
          "bg-background/95 backdrop-blur-sm",
          "border border-border shadow-lg",
          "text-sm text-foreground",
          className
        )}
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        {content}
        {/* Arrow */}
        <div 
          className={cn(
            "absolute w-0 h-0 border-8",
            arrowClasses[position]
          )}
        />
      </motion.div>
    </AnimatePresence>
  );
};

export default TourTooltip;
