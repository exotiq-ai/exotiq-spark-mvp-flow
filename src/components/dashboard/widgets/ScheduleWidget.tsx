import { UpcomingScheduleWidget } from "@/components/dashboard/UpcomingScheduleWidget";

interface ScheduleWidgetProps {
  onViewCalendar: () => void;
}

export const ScheduleWidget = ({ onViewCalendar }: ScheduleWidgetProps) => {
  return (
    <div className="h-full" role="region" aria-label="Upcoming Schedule">
      <UpcomingScheduleWidget onViewCalendar={onViewCalendar} />
    </div>
  );
};