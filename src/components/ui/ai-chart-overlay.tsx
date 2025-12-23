import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface AIChartOverlayProps {
  isProcessing: boolean;
  children: React.ReactNode;
  className?: string;
  message?: string;
}

export const AIChartOverlay = ({ 
  isProcessing, 
  children, 
  className,
  message = "Rari is analyzing data..."
}: AIChartOverlayProps) => {
  if (!isProcessing) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      {/* Blurred chart content */}
      <div className="blur-sm opacity-50 pointer-events-none">
        {children}
      </div>
      
      {/* Overlay with gradient wave animation */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-background/60 via-background/80 to-background/60 backdrop-blur-[2px] rounded-lg overflow-hidden">
        {/* Animated gradient wave background */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute inset-0 bg-gradient-to-r from-chart-1/10 via-chart-4/15 to-chart-1/10 animate-gradient-flow"
            style={{ backgroundSize: '200% 100%' }}
          />
          
          {/* Animated wave lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="wave-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
                <stop offset="50%" stopColor="hsl(var(--chart-1))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="wave-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity="0" />
                <stop offset="50%" stopColor="hsl(var(--chart-4))" stopOpacity="0.25" />
                <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Wave 1 */}
            <path
              d="M-50,100 Q50,60 150,100 T350,100 T550,100"
              fill="none"
              stroke="url(#wave-gradient-1)"
              strokeWidth="2"
              className="animate-pulse-soft"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values="-100,0;100,0;-100,0"
                dur="4s"
                repeatCount="indefinite"
              />
            </path>
            
            {/* Wave 2 */}
            <path
              d="M-50,120 Q50,80 150,120 T350,120 T550,120"
              fill="none"
              stroke="url(#wave-gradient-2)"
              strokeWidth="2"
              className="animate-pulse-soft"
              style={{ animationDelay: '0.5s' }}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values="100,0;-100,0;100,0"
                dur="5s"
                repeatCount="indefinite"
              />
            </path>
            
            {/* Wave 3 */}
            <path
              d="M-50,80 Q50,120 150,80 T350,80 T550,80"
              fill="none"
              stroke="url(#wave-gradient-1)"
              strokeWidth="1.5"
              className="animate-pulse-soft"
              style={{ animationDelay: '1s' }}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values="-50,0;50,0;-50,0"
                dur="3s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
          
          {/* Pulsing data points */}
          <div className="absolute inset-0 flex items-center justify-center gap-12">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-chart-1/40 animate-pulse-soft"
                style={{ 
                  animationDelay: `${i * 0.2}s`,
                  transform: `translateY(${Math.sin(i * 1.5) * 20}px)`
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center gap-3 p-4">
          <div className="relative">
            <Sparkles className="w-8 h-8 text-chart-1 animate-pulse-soft" />
            <div className="absolute inset-0 w-8 h-8 bg-chart-1/20 rounded-full blur-xl animate-breathing-glow" />
          </div>
          <span className="text-sm font-medium text-foreground/80 animate-pulse-soft">
            {message}
          </span>
          
          {/* Loading dots */}
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-chart-1/60 animate-wave"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Smaller inline version for sparklines and mini charts
export const AISparklineOverlay = ({ 
  isProcessing, 
  children, 
  className 
}: Omit<AIChartOverlayProps, 'message'>) => {
  if (!isProcessing) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      <div className="blur-sm opacity-40 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1 bg-chart-1/50 rounded-full animate-wave"
              style={{ 
                height: '16px',
                animationDelay: `${i * 0.1}s` 
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
