import { Skeleton } from './skeleton';
import { Card, CardContent, CardHeader } from './card';
import { cn } from '@/lib/utils';

export const SkeletonCard = () => (
  <Card className="overflow-hidden">
    <CardHeader>
      <Skeleton className="h-5 w-32 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
      <Skeleton className="h-4 w-48 mt-2 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" style={{ animationDelay: '0.1s' }} />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-24 w-full animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" style={{ animationDelay: '0.2s' }} />
    </CardContent>
  </Card>
);

export const SkeletonTable = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 animate-slide-up-fade" style={{ animationDelay: `${i * 0.05}s` }}>
        <Skeleton className="h-12 w-12 rounded-full animate-pulse-soft" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
          <Skeleton className="h-3 w-3/4 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" style={{ animationDelay: '0.1s' }} />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonMetric = () => (
  <Card className="overflow-hidden">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-4 w-24 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
      <Skeleton className="h-4 w-4 rounded animate-pulse-soft" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-32 mb-2 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" style={{ animationDelay: '0.1s' }} />
      <Skeleton className="h-3 w-40 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" style={{ animationDelay: '0.2s' }} />
    </CardContent>
  </Card>
);

// Chart-shaped skeleton for line/area charts
export const SkeletonLineChart = ({ className, height = 200 }: { className?: string; height?: number }) => (
  <Card className={cn("overflow-hidden", className)}>
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
        <Skeleton className="h-6 w-20 rounded-full animate-pulse-soft" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="relative" style={{ height }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3 w-6 animate-pulse-soft" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        
        {/* Chart area with wave animation */}
        <div className="absolute left-10 right-0 top-0 bottom-6 overflow-hidden rounded-lg bg-muted/30">
          <svg className="w-full h-full" viewBox="0 0 400 150" preserveAspectRatio="none">
            <defs>
              <linearGradient id="skeleton-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.3">
                  <animate attributeName="offset" values="-1;1" dur="2s" repeatCount="indefinite" />
                </stop>
                <stop offset="50%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.15">
                  <animate attributeName="offset" values="-0.5;1.5" dur="2s" repeatCount="indefinite" />
                </stop>
                <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.3">
                  <animate attributeName="offset" values="0;2" dur="2s" repeatCount="indefinite" />
                </stop>
              </linearGradient>
            </defs>
            <path
              d="M0,100 Q50,80 100,90 T200,70 T300,85 T400,60 L400,150 L0,150 Z"
              fill="url(#skeleton-gradient)"
              className="animate-pulse-soft"
            />
            <path
              d="M0,100 Q50,80 100,90 T200,70 T300,85 T400,60"
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity="0.2"
              strokeWidth="2"
              className="animate-pulse-soft"
            />
          </svg>
        </div>
        
        {/* X-axis labels */}
        <div className="absolute left-10 right-0 bottom-0 flex justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-3 w-8 animate-pulse-soft" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
);

// Chart-shaped skeleton for bar charts
export const SkeletonBarChart = ({ className, height = 200, bars = 6 }: { className?: string; height?: number; bars?: number }) => (
  <Card className={cn("overflow-hidden", className)}>
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
        <Skeleton className="h-6 w-16 rounded-full animate-pulse-soft" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="relative" style={{ height }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3 w-6 animate-pulse-soft" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        
        {/* Bars */}
        <div className="absolute left-10 right-0 top-0 bottom-6 flex items-end justify-around gap-2 px-2">
          {Array.from({ length: bars }).map((_, i) => {
            const heightPercent = 40 + Math.random() * 50;
            return (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-muted via-muted-foreground/10 to-muted rounded-t animate-pulse-soft"
                style={{ 
                  height: `${heightPercent}%`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            );
          })}
        </div>
        
        {/* X-axis labels */}
        <div className="absolute left-10 right-0 bottom-0 flex justify-around">
          {Array.from({ length: bars }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-6 animate-pulse-soft" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
);

// Chart-shaped skeleton for donut/pie charts
export const SkeletonDonutChart = ({ className, size = 160 }: { className?: string; size?: number }) => (
  <Card className={cn("overflow-hidden", className)}>
    <CardHeader className="pb-2">
      <Skeleton className="h-5 w-24 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
    </CardHeader>
    <CardContent className="flex items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id="donut-skeleton-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.1" />
              <stop offset="50%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.2" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          
          {/* Background ring */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="12"
          />
          
          {/* Animated segments */}
          {[0, 1, 2, 3].map((i) => {
            const segmentLength = 15 + i * 5;
            const offset = i * 25;
            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="url(#donut-skeleton-gradient)"
                strokeWidth="12"
                strokeDasharray={`${segmentLength} ${100 - segmentLength}`}
                strokeDashoffset={-offset}
                className="animate-pulse-soft"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            );
          })}
        </svg>
        
        {/* Center text skeleton */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Skeleton className="h-6 w-12 mb-1 animate-pulse-soft" />
          <Skeleton className="h-3 w-8 animate-pulse-soft" style={{ animationDelay: '0.1s' }} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Inline sparkline skeleton
export const SkeletonSparkline = ({ className, width = 80, height = 24 }: { className?: string; width?: number; height?: number }) => (
  <div className={cn("overflow-hidden rounded", className)} style={{ width, height }}>
    <svg viewBox="0 0 80 24" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="sparkline-skeleton-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.5">
            <animate attributeName="offset" values="-0.5;1.5" dur="1.5s" repeatCount="indefinite" />
          </stop>
          <stop offset="50%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.3">
            <animate attributeName="offset" values="0;2" dur="1.5s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.5">
            <animate attributeName="offset" values="0.5;2.5" dur="1.5s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
      </defs>
      <path
        d="M0,18 Q10,12 20,14 T40,10 T60,16 T80,8"
        fill="none"
        stroke="url(#sparkline-skeleton-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  </div>
);
