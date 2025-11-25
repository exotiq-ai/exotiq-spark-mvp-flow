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
