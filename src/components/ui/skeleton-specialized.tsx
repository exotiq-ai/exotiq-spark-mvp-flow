import { Skeleton } from './skeleton';
import { Card, CardContent, CardHeader } from './card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Quick Actions skeleton - horizontal pill buttons
export const SkeletonQuickActions = ({ count = 5 }: { count?: number }) => (
  <Card className="p-3 sm:p-4 border border-border/50">
    <div className="flex items-center justify-between gap-2 sm:gap-4">
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 flex-1">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="h-8 sm:h-9 w-20 sm:w-24 rounded-full flex-shrink-0 animate-pulse-soft" 
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
      <Skeleton className="h-8 sm:h-9 w-24 rounded-full flex-shrink-0 bg-primary/20 animate-pulse-soft" />
    </div>
  </Card>
);

// AI Insight skeleton with "thinking" animation
export const SkeletonAIInsight = ({ className }: { className?: string }) => (
  <Card className={cn("overflow-hidden border-2 border-primary/20", className)}>
    <CardHeader className="pb-2">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Skeleton className="h-10 w-10 rounded-xl bg-primary/10" />
          {/* Thinking dots animation */}
          <motion.div 
            className="absolute -bottom-1 -right-1 flex gap-0.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary/60"
                animate={{ 
                  y: [0, -4, 0],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{ 
                  duration: 0.8, 
                  repeat: Infinity, 
                  delay: i * 0.15,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.div>
        </div>
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
          <Skeleton className="h-3 w-48 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" style={{ animationDelay: '0.1s' }} />
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-24 rounded-lg animate-pulse-soft" />
        <Skeleton className="h-12 w-20 rounded-lg animate-pulse-soft" style={{ animationDelay: '0.1s' }} />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-lg animate-pulse-soft" />
        <Skeleton className="h-9 w-28 rounded-lg animate-pulse-soft" style={{ animationDelay: '0.1s' }} />
      </div>
    </CardContent>
  </Card>
);

// Hero Metric skeleton - large number with trend indicator
export const SkeletonHeroMetric = ({ className }: { className?: string }) => (
  <Card className={cn("p-4 md:p-6 border-2 border-border", className)}>
    <div className="flex items-start justify-between mb-4">
      <Skeleton className="h-12 w-12 rounded-xl animate-pulse-soft" />
      <Skeleton className="h-5 w-5 rounded animate-pulse-soft" />
    </div>
    <Skeleton className="h-8 md:h-10 w-24 mb-2 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
    <Skeleton className="h-4 w-32 mb-4 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" style={{ animationDelay: '0.1s' }} />
    <Skeleton className="h-10 w-full rounded-lg animate-pulse-soft" style={{ animationDelay: '0.2s' }} />
  </Card>
);

// Schedule Item skeleton - single booking/event row
export const SkeletonScheduleItem = ({ className }: { className?: string }) => (
  <div className={cn("p-3 bg-muted/50 rounded-lg", className)}>
    <div className="flex items-start justify-between mb-2">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
        <Skeleton className="h-3 w-24 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" style={{ animationDelay: '0.05s' }} />
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Skeleton className="h-3 w-3 rounded animate-pulse-soft" />
      <Skeleton className="h-3 w-16 animate-pulse-soft" style={{ animationDelay: '0.1s' }} />
    </div>
  </div>
);

// Vehicle Card skeleton - vehicle list item with image placeholder
export const SkeletonVehicleCard = ({ className }: { className?: string }) => (
  <Card className={cn("p-4 overflow-hidden", className)}>
    <div className="flex gap-4">
      <Skeleton className="h-20 w-28 rounded-lg flex-shrink-0 animate-pulse-soft" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-36 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
        <Skeleton className="h-4 w-24 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" style={{ animationDelay: '0.05s' }} />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full animate-pulse-soft" />
          <Skeleton className="h-6 w-20 rounded-full animate-pulse-soft" style={{ animationDelay: '0.1s' }} />
        </div>
      </div>
    </div>
  </Card>
);

// Banner skeleton - hero banner placeholder
export const SkeletonBanner = ({ className }: { className?: string }) => (
  <Card className={cn("overflow-hidden", className)}>
    <Skeleton className="h-32 sm:h-40 md:h-48 w-full animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
  </Card>
);

// Module Navigation skeleton - bottom navigation cards
export const SkeletonModuleNav = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton 
        key={i} 
        className="h-14 sm:h-16 rounded-lg sm:rounded-xl animate-pulse-soft" 
        style={{ animationDelay: `${i * 0.05}s` }}
      />
    ))}
  </div>
);

// Dashboard Section skeleton - collapsible section header with content
export const SkeletonSection = ({ 
  title = true, 
  contentHeight = 200,
  className 
}: { 
  title?: boolean; 
  contentHeight?: number;
  className?: string;
}) => (
  <Card className={cn("overflow-hidden", className)}>
    {title && (
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded animate-pulse-soft" />
            <Skeleton className="h-5 w-28 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full animate-pulse-soft" />
        </div>
      </CardHeader>
    )}
    <CardContent>
      <Skeleton 
        className="w-full rounded-lg animate-pulse-soft" 
        style={{ height: contentHeight }}
      />
    </CardContent>
  </Card>
);

// Document Row skeleton - for vault/document lists
export const SkeletonDocumentRow = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-4 p-3 rounded-lg bg-muted/30", className)}>
    <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0 animate-pulse-soft" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-40 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-20 animate-pulse-soft" />
        <Skeleton className="h-3 w-16 animate-pulse-soft" style={{ animationDelay: '0.05s' }} />
      </div>
    </div>
    <Skeleton className="h-8 w-8 rounded-md flex-shrink-0 animate-pulse-soft" />
  </div>
);

// Payment Row skeleton
export const SkeletonPaymentRow = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center justify-between p-3 rounded-lg bg-muted/30", className)}>
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full animate-pulse-soft" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-28 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
        <Skeleton className="h-3 w-20 animate-pulse-soft" />
      </div>
    </div>
    <div className="text-right space-y-2">
      <Skeleton className="h-5 w-16 ml-auto animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
      <Skeleton className="h-5 w-14 rounded-full ml-auto animate-pulse-soft" />
    </div>
  </div>
);

// Stats Row skeleton - for inline stats
export const SkeletonStatsRow = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="p-3">
        <Skeleton className="h-3 w-16 mb-2 animate-pulse-soft" style={{ animationDelay: `${i * 0.05}s` }} />
        <Skeleton className="h-6 w-12 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" style={{ animationDelay: `${i * 0.05 + 0.1}s` }} />
      </Card>
    ))}
  </div>
);

// Alert Card skeleton
export const SkeletonAlertCard = ({ variant = 'warning' }: { variant?: 'warning' | 'error' | 'info' }) => {
  const bgColor = variant === 'error' ? 'bg-destructive/10' : variant === 'warning' ? 'bg-warning/10' : 'bg-primary/10';
  
  return (
    <Card className={cn("p-4 border-l-4", bgColor, 
      variant === 'error' ? 'border-l-destructive' : 
      variant === 'warning' ? 'border-l-warning' : 
      'border-l-primary'
    )}>
      <div className="flex items-start gap-3">
        <Skeleton className="h-5 w-5 rounded animate-pulse-soft" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
          <Skeleton className="h-3 w-48 animate-pulse-soft" style={{ animationDelay: '0.1s' }} />
        </div>
      </div>
    </Card>
  );
};
