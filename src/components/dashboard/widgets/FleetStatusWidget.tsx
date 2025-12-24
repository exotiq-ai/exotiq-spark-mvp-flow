import { LiveFleetStatusWidget } from "@/components/dashboard/LiveFleetStatusWidget";
import { SkeletonDonutChart } from "@/components/ui/skeleton-card";

interface FleetStatusWidgetProps {
  onViewAll: () => void;
  isLoading?: boolean;
}

export const FleetStatusWidget = ({ onViewAll, isLoading }: FleetStatusWidgetProps) => {
  if (isLoading) {
    return <SkeletonDonutChart size={160} />;
  }

  return (
    <div className="h-full" role="region" aria-label="Live Fleet Status">
      <LiveFleetStatusWidget onViewAll={onViewAll} />
    </div>
  );
};