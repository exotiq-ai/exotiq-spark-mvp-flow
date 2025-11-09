import { LiveFleetStatusWidget } from "@/components/dashboard/LiveFleetStatusWidget";

interface FleetStatusWidgetProps {
  onViewAll: () => void;
}

export const FleetStatusWidget = ({ onViewAll }: FleetStatusWidgetProps) => {
  return (
    <div className="h-full" role="region" aria-label="Live Fleet Status">
      <LiveFleetStatusWidget onViewAll={onViewAll} />
    </div>
  );
};