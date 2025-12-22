import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";

interface RadialProgressProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  showPercentage?: boolean;
  animated?: boolean;
  glowOnComplete?: boolean;
}

export const RadialProgress = ({
  value,
  maxValue = 100,
  size = 120,
  strokeWidth = 10,
  color = "hsl(var(--primary))",
  label,
  showPercentage = true,
  animated = true,
  glowOnComplete = true
}: RadialProgressProps) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  const percentage = Math.min((value / maxValue) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;
  const isComplete = percentage >= 100;

  useEffect(() => {
    if (isInView && animated) {
      const duration = 1500;
      const startTime = Date.now();
      
      const animateValue = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out-cubic)
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatedValue(percentage * eased);
        
        if (progress < 1) {
          requestAnimationFrame(animateValue);
        }
      };
      
      requestAnimationFrame(animateValue);
    } else if (!animated) {
      setAnimatedValue(percentage);
    }
  }, [isInView, percentage, animated]);

  return (
    <div ref={ref} className="relative inline-flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
          {glowOnComplete && isComplete && (
            <filter id={`glow-${label}`}>
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          className="opacity-30"
        />

        {/* Progress circle */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#gradient-${label})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
          style={{
            filter: glowOnComplete && isComplete ? `url(#glow-${label})` : 'none'
          }}
        />
      </svg>

      {/* Center content */}
      <motion.div 
        className="absolute inset-0 flex flex-col items-center justify-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        {showPercentage && (
          <motion.span 
            className="text-xl font-bold text-foreground"
            key={Math.round(animatedValue)}
          >
            {Math.round(animatedValue)}%
          </motion.span>
        )}
      </motion.div>

      {/* Label */}
      {label && (
        <motion.span 
          className="mt-2 text-xs text-muted-foreground font-medium text-center"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        >
          {label}
        </motion.span>
      )}
    </div>
  );
};
