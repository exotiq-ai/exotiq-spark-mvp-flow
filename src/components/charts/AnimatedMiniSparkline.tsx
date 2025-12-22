import { useEffect, useState, useRef, useMemo } from "react";
import { motion, useInView } from "framer-motion";

interface AnimatedMiniSparklineProps {
  data: number[];
  color?: string;
  height?: number;
  showGradient?: boolean;
  showGlow?: boolean;
  animated?: boolean;
}

export const AnimatedMiniSparkline = ({ 
  data, 
  color = "hsl(var(--primary))",
  height = 40,
  showGradient = true,
  showGlow = true,
  animated = true
}: AnimatedMiniSparklineProps) => {
  const [animationProgress, setAnimationProgress] = useState(0);
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  
  const width = 100;
  const padding = 2;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;

  // Calculate min/max for scaling
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue || 1;

  // Generate points
  const points = useMemo(() => {
    return data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * effectiveWidth;
      const y = padding + effectiveHeight - ((value - minValue) / range) * effectiveHeight;
      return { x, y };
    });
  }, [data, effectiveWidth, effectiveHeight, minValue, range, padding]);

  // Create path for line
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      
      // Smooth curve using quadratic bezier
      const prevPoint = points[index - 1];
      const midX = (prevPoint.x + point.x) / 2;
      return `${path} Q ${prevPoint.x + (point.x - prevPoint.x) / 4} ${prevPoint.y}, ${midX} ${(prevPoint.y + point.y) / 2} T ${point.x} ${point.y}`;
    }, '');
  }, [points]);

  // Create path for gradient fill area
  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const line = points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const prevPoint = points[index - 1];
      const midX = (prevPoint.x + point.x) / 2;
      return `${path} Q ${prevPoint.x + (point.x - prevPoint.x) / 4} ${prevPoint.y}, ${midX} ${(prevPoint.y + point.y) / 2} T ${point.x} ${point.y}`;
    }, '');
    
    // Close the path to create area
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    return `${line} L ${lastPoint.x} ${height - padding} L ${firstPoint.x} ${height - padding} Z`;
  }, [points, height, padding]);

  // Animate on view
  useEffect(() => {
    if (isInView && animated) {
      const duration = 1200;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimationProgress(eased);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    } else if (!animated) {
      setAnimationProgress(1);
    }
  }, [isInView, animated]);

  // Generate unique gradient IDs
  const gradientId = useMemo(() => `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  const glowId = useMemo(() => `sparkline-glow-${Math.random().toString(36).substr(2, 9)}`, []);

  // Calculate path length for animation
  const pathLength = useMemo(() => {
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', linePath);
    return tempPath.getTotalLength() || 200;
  }, [linePath]);

  return (
    <svg 
      ref={ref}
      width="100%" 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        {/* Gradient for area fill */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
        
        {/* Glow filter */}
        {showGlow && (
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Gradient fill area */}
      {showGradient && (
        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: animationProgress }}
          transition={{ duration: 0.8, delay: 0.4 }}
        />
      )}

      {/* Main line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter: showGlow ? `url(#${glowId})` : 'none'
        }}
        strokeDasharray={pathLength}
        strokeDashoffset={pathLength * (1 - animationProgress)}
        initial={{ strokeDashoffset: pathLength }}
        animate={{ strokeDashoffset: pathLength * (1 - animationProgress) }}
      />

      {/* End point dot */}
      {points.length > 0 && (
        <motion.circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill={color}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: animationProgress, 
            opacity: animationProgress 
          }}
          transition={{ delay: 0.8, duration: 0.3 }}
          style={{
            filter: showGlow ? `drop-shadow(0 0 4px ${color})` : 'none'
          }}
        />
      )}
    </svg>
  );
};
