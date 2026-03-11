import { LiveFleetStatusWidget } from "@/components/dashboard/LiveFleetStatusWidget";
import { ProgressiveDisclosure } from "@/components/common/ProgressiveDisclosure";
import { SkeletonDonutChart } from "@/components/ui/skeleton-card";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { Car, CheckCircle, Clock, Wrench, XCircle } from "lucide-react";
import { useMemo } from "react";

interface FleetStatusWidgetProps {
  onViewAll: () => void;
  isLoading?: boolean;
}

const FleetExpandedContent = () => {
  const { vehicles, bookings } = useLocationFilteredFleet();

  const { statusItems, utilization } = useMemo(() => {
    // Exclude retired from active fleet
    const activeVehicles = vehicles.filter(v => v.status !== 'retired');
    const retiredCount = vehicles.filter(v => v.status === 'retired').length;

    // Booking-aware: find vehicles with active/confirmed bookings spanning today
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const bookedVehicleIds = new Set(
      bookings
        .filter(b =>
          b.status === 'confirmed' &&
          new Date(b.start_date) <= todayEnd &&
          new Date(b.end_date) >= todayStart
        )
        .map(b => b.vehicle_id)
    );

    const bookedCount = bookedVehicleIds.size;
    const maintenanceCount = activeVehicles.filter(v => v.status === 'maintenance').length;
    const availableCount = Math.max(0, activeVehicles.length - bookedCount - maintenanceCount);

    const activeTotal = activeVehicles.length || 1;
    const util = Math.round((bookedCount / activeTotal) * 100);

    return {
      utilization: util,
      statusItems: [
        { label: "Available", count: availableCount, icon: CheckCircle, color: "text-green-500" },
        { label: "Booked", count: bookedCount, icon: Car, color: "text-primary" },
        { label: "Maintenance", count: maintenanceCount, icon: Wrench, color: "text-yellow-500" },
        { label: "Retired", count: retiredCount, icon: XCircle, color: "text-muted-foreground" },
      ],
    };
  }, [vehicles, bookings]);

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
