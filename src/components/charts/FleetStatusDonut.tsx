import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
  colorVar: string;
  route: string;
}

export const FleetStatusDonut = () => {
  const { vehicles, bookings } = useLocationFilteredFleet();
  const navigate = useNavigate();
  const [animationProgress, setAnimationProgress] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const segments: DonutSegment[] = useMemo(() => {
    // Calculate booked vehicles dynamically from active bookings
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Find vehicles with confirmed bookings spanning today
    const bookedVehicleIds = new Set(
      bookings
        .filter(b => 
          b.status === 'confirmed' &&
          new Date(b.start_date) <= todayEnd &&
          new Date(b.end_date) >= todayStart
        )
        .map(b => b.vehicle_id)
    );

    const booked = bookedVehicleIds.size;
    const maintenance = vehicles.filter(v => v.status === 'maintenance').length;
    const available = Math.max(0, vehicles.length - booked - maintenance);

    return [
      { label: 'Available', value: available, color: 'hsl(var(--success))', colorVar: '--success', route: '/fleet?status=available' },
      { label: 'Booked', value: booked, color: 'hsl(var(--primary))', colorVar: '--primary', route: '/dashboard?module=book&filter=active' },
      { label: 'Maintenance', value: maintenance, color: 'hsl(var(--warning))', colorVar: '--warning', route: '/dashboard?module=motoriq' },
    ];
  }, [vehicles, bookings]);

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

  const handleSegmentClick = (route: string) => {
    navigate(route);
  };

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
              onClick={() => handleSegmentClick(segment.route)}
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

      {/* Legend - clickable */}
      <div className="flex flex-wrap justify-center gap-4">
        {segmentPaths.map((segment, index) => (
          <motion.button
            key={segment.label}
            onClick={() => handleSegmentClick(segment.route)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 ${
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
          </motion.button>
        ))}
      </div>
    </div>
  );
};
