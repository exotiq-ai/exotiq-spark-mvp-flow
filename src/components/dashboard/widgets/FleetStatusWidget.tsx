import { LiveFleetStatusWidget } from "@/components/dashboard/LiveFleetStatusWidget";
import { ProgressiveDisclosure } from "@/components/common/ProgressiveDisclosure";
import { SkeletonDonutChart } from "@/components/ui/skeleton-card";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { Car, CheckCircle, Clock, Wrench, XCircle } from "lucide-react";

interface FleetStatusWidgetProps {
  onViewAll: () => void;
  isLoading?: boolean;
}

const FleetExpandedContent = () => {
  const { vehicles } = useLocationFilteredFleet();

  const statusCounts = vehicles.reduce(
    (acc, v) => {
      const status = v.status || "available";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const total = vehicles.length || 1;
  const utilization = total > 0
    ? Math.round(((statusCounts["rented"] || 0) / total) * 100)
    : 0;

  const statusItems = [
    { label: "Available", count: statusCounts["available"] || 0, icon: CheckCircle, color: "text-green-500" },
    { label: "Rented", count: statusCounts["rented"] || 0, icon: Car, color: "text-primary" },
    { label: "Maintenance", count: statusCounts["maintenance"] || 0, icon: Wrench, color: "text-yellow-500" },
    { label: "Reserved", count: statusCounts["reserved"] || 0, icon: Clock, color: "text-blue-500" },
    { label: "Unavailable", count: statusCounts["unavailable"] || 0, icon: XCircle, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Fleet Utilization</span>
        <span className="font-semibold text-foreground">{utilization}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${utilization}%` }}
        />
      </div>
      <div className="space-y-2">
        {statusItems.map(({ label, count, icon: Icon, color }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-foreground">{label}</span>
            </div>
            <span className="font-medium text-foreground">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const FleetStatusWidget = ({ onViewAll, isLoading }: FleetStatusWidgetProps) => {
  if (isLoading) {
    return <SkeletonDonutChart size={160} />;
  }

  return (
    <ProgressiveDisclosure
      title="Live Fleet Status"
      badge="Live"
      preview={<LiveFleetStatusWidget onViewAll={onViewAll} />}
      fullContent={<FleetExpandedContent />}
      tip="Expand to see fleet utilization and status breakdown"
    />
  );
};
