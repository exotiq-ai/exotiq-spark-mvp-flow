import { UpcomingScheduleWidget } from "@/components/dashboard/UpcomingScheduleWidget";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { SkeletonScheduleItem } from "@/components/ui/skeleton-specialized";
import { Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ScheduleWidgetProps {
  onViewCalendar: () => void;
  isLoading?: boolean;
}

export const ScheduleWidget = ({ onViewCalendar, isLoading }: ScheduleWidgetProps) => {
  if (isLoading) {
    return (
      <Card className="p-6 border-2 border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded animate-pulse-soft" />
            <Skeleton className="h-5 w-32 animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:1000px_100%]" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md animate-pulse-soft" />
        </div>
        <div className="space-y-3">
          <SkeletonScheduleItem />
          <SkeletonScheduleItem />
          <SkeletonScheduleItem />
        </div>
      </Card>
    );
  }

  return (
    <div className="h-full" role="region" aria-label="Upcoming Schedule">
      <UpcomingScheduleWidget onViewCalendar={onViewCalendar} />
    </div>
  );
};