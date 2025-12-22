import { ReactNode, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdaptiveChartContainerProps {
  children: ReactNode;
  mobileHeight?: number;
  tabletHeight?: number;
  desktopHeight?: number;
  className?: string;
}

// Hook to get responsive chart height
export const useChartHeight = (
  mobileHeight = 160,
  tabletHeight = 220,
  desktopHeight = 280
) => {
  const [height, setHeight] = useState(desktopHeight);
  
  useEffect(() => {
    const updateHeight = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setHeight(mobileHeight);
      } else if (width < 1024) {
        setHeight(tabletHeight);
      } else {
        setHeight(desktopHeight);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [mobileHeight, tabletHeight, desktopHeight]);
  
  return height;
};

// Hook for detecting touch devices
export const useIsTouchDevice = () => {
  const [isTouch, setIsTouch] = useState(false);
  
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  
  return isTouch;
};

// Adaptive chart container component
export const AdaptiveChartContainer = ({
  children,
  mobileHeight = 160,
  tabletHeight = 220,
  desktopHeight = 280,
  className = ""
}: AdaptiveChartContainerProps) => {
  const height = useChartHeight(mobileHeight, tabletHeight, desktopHeight);
  
  return (
    <div 
      className={`w-full transition-all duration-300 ${className}`}
      style={{ height }}
    >
      {children}
    </div>
  );
};

// Touch-friendly tooltip styles
export const touchTooltipStyle = {
  padding: '12px 16px',
  borderRadius: '12px',
  boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.2)',
  minWidth: '140px',
  maxWidth: '220px',
};

// Mobile-optimized legend configuration
export const getMobileLegendProps = (isMobile: boolean) => ({
  wrapperStyle: {
    paddingTop: isMobile ? '8px' : '16px',
    fontSize: isMobile ? '11px' : '12px',
  },
  iconSize: isMobile ? 8 : 10,
  layout: isMobile ? 'horizontal' as const : 'horizontal' as const,
  align: 'center' as const,
  verticalAlign: 'bottom' as const,
});

// Responsive axis tick configuration
export const getResponsiveAxisConfig = (isMobile: boolean) => ({
  xAxis: {
    tick: { 
      fill: 'hsl(var(--muted-foreground))', 
      fontSize: isMobile ? 10 : 12 
    },
    tickLine: false,
    axisLine: { stroke: 'hsl(var(--border))' },
    angle: isMobile ? -45 : 0,
    textAnchor: isMobile ? 'end' as const : 'middle' as const,
    height: isMobile ? 50 : 30,
  },
  yAxis: {
    tick: { 
      fill: 'hsl(var(--muted-foreground))', 
      fontSize: isMobile ? 10 : 12 
    },
    tickLine: false,
    axisLine: false,
    width: isMobile ? 35 : 50,
  }
});

// Format large numbers for mobile (e.g., 1500 -> 1.5k)
export const formatCompactNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
};

// Date formatter for mobile (shorter format)
export const formatMobileDate = (date: string): string => {
  // Assuming date is in format like "Jan 15" or similar
  const parts = date.split(' ');
  if (parts.length >= 2) {
    return `${parts[0].slice(0, 1)}${parts[1]}`;
  }
  return date.slice(0, 3);
};
