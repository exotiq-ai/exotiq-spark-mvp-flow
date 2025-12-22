import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useFleet } from "@/contexts/FleetContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
  colorVar: string;
}

export const FleetStatusDonut = () => {
  const { vehicles } = useFleet();
  const [animationProgress, setAnimationProgress] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const segments: DonutSegment[] = useMemo(() => {
    const available = vehicles.filter(v => v.status === 'available').length;
    const booked = vehicles.filter(v => v.status === 'booked').length;
    const maintenance = vehicles.filter(v => v.status === 'maintenance').length;

    return [
      { label: 'Available', value: available, color: 'hsl(var(--success))', colorVar: '--success' },
      { label: 'Booked', value: booked, color: 'hsl(var(--primary))', colorVar: '--primary' },
      { label: 'Maintenance', value: maintenance, color: 'hsl(var(--warning))', colorVar: '--warning' },
    ];
  }, [vehicles]);

  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const size = isMobile ? 140 : 180;
  const strokeWidth = isMobile ? 20 : 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationProgress(1);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const getSegmentPath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(center, center, radius, endAngle);
    const end = polarToCartesian(center, center, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(' ');
  };

  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = (angle - 90) * Math.PI / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  };

  let currentAngle = 0;
  const segmentPaths = segments.map((segment) => {
    const segmentAngle = total > 0 ? (segment.value / total) * 360 : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + segmentAngle * animationProgress;
    currentAngle += segmentAngle;
    
    return {
      ...segment,
      path: getSegmentPath(startAngle, endAngle),
      startAngle,
      endAngle: startAngle + segmentAngle,
      percentage: total > 0 ? Math.round((segment.value / total) * 100) : 0
    };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg 
          width={size} 
          height={size} 
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
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
          
          {/* Animated segments */}
          {segmentPaths.map((segment, index) => (
            <motion.path
              key={segment.label}
              d={segment.path}
              fill="none"
              stroke={segment.color}
              strokeWidth={hoveredSegment === segment.label ? strokeWidth + 4 : strokeWidth}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ 
                pathLength: animationProgress, 
                opacity: 1,
                strokeWidth: hoveredSegment === segment.label ? strokeWidth + 4 : strokeWidth
              }}
              transition={{ 
                duration: 1.2,
                delay: index * 0.2,
                ease: [0.4, 0, 0.2, 1]
              }}
              onMouseEnter={() => setHoveredSegment(segment.label)}
              onMouseLeave={() => setHoveredSegment(null)}
              className="cursor-pointer transition-all duration-200 drop-shadow-sm"
              style={{
                filter: hoveredSegment === segment.label 
                  ? `drop-shadow(0 0 8px ${segment.color})` 
                  : 'none'
              }}
            />
          ))}
        </svg>

        {/* Center content */}
        <motion.div 
          className="absolute inset-0 flex flex-col items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.span 
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.3 }}
          >
            {total}
          </motion.span>
          <span className="text-xs text-muted-foreground font-medium">
            Total Vehicles
          </span>
        </motion.div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4">
        {segmentPaths.map((segment, index) => (
          <motion.div
            key={segment.label}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
              hoveredSegment === segment.label 
                ? 'bg-muted scale-105' 
                : 'hover:bg-muted/50'
            }`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + index * 0.1, duration: 0.3 }}
            onMouseEnter={() => setHoveredSegment(segment.label)}
            onMouseLeave={() => setHoveredSegment(null)}
          >
            <motion.div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: segment.color }}
              animate={{
                scale: hoveredSegment === segment.label ? 1.2 : 1,
                boxShadow: hoveredSegment === segment.label 
                  ? `0 0 8px ${segment.color}` 
                  : 'none'
              }}
            />
            <span className="text-sm font-medium text-foreground">
              {segment.value}
            </span>
            <span className="text-xs text-muted-foreground">
              {segment.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
