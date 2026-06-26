import { UpcomingScheduleWidget } from "@/components/dashboard/UpcomingScheduleWidget";
import { ProgressiveDisclosure } from "@/components/common/ProgressiveDisclosure";
import { Card } from "@/components/ui/card";
import { SkeletonScheduleItem } from "@/components/ui/skeleton-specialized";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, Clock, CalendarDays } from "lucide-react";
import { differenceInDays, format, isToday, isTomorrow } from "date-fns";

interface ScheduleWidgetProps {
  onViewCalendar: () => void;
  isLoading?: boolean;
}

const ScheduleExpandedContent = () => {
  const { bookings } = useLocationFilteredFleet();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const upcoming = bookings
    .filter((b) => {
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);
      return (
        (b.status === "confirmed" || b.status === "pending") &&
        (startDate >= todayStart || endDate >= todayStart)
      );
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 7);

  const totalValue = upcoming.reduce((sum, b) => sum + (b.total_value || 0), 0);
  const avgDuration =
    upcoming.length > 0
      ? Math.round(
          upcoming.reduce(
            (sum, b) => sum + differenceInDays(new Date(b.end_date), new Date(b.start_date)),
            0
          ) / upcoming.length
        )
      : 0;

  const todayCount = upcoming.filter((b) => isToday(new Date(b.start_date))).length;
  const tomorrowCount = upcoming.filter((b) => isTomorrow(new Date(b.start_date))).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <DollarSign className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-xs text-muted-foreground">Pipeline</p>
          <p className="font-semibold text-sm text-foreground">
            {formatCurrency(totalValue)}
          </p>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <Clock className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-xs text-muted-foreground">Avg Duration</p>
          <p className="font-semibold text-sm text-foreground">{avgDuration}d</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <CalendarDays className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-xs text-muted-foreground">Today / Tomorrow</p>
          <p className="font-semibold text-sm text-foreground">
            {todayCount} / {tomorrowCount}
          </p>
        </div>
      </div>
    </div>
  );
};

export const ScheduleWidget = ({ onViewCalendar, isLoading }: ScheduleWidgetProps) => {
  if (isLoading) {
    return (
      <Card className="p-6 border border-border shadow-sm">
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
    <ProgressiveDisclosure
      title="Upcoming Schedule"
      preview={<UpcomingScheduleWidget onViewCalendar={onViewCalendar} />}
      fullContent={<ScheduleExpandedContent />}
      tip="Expand to see booking pipeline and duration insights"
    />
  );
};
