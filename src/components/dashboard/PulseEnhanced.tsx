import { Badge } from "@/components/ui/badge";
import { FleetStatusDonut } from "@/components/charts/FleetStatusDonut";
import { TodaySnapshot } from "@/components/dashboard/pulse/TodaySnapshot";
import { VehiclesOutNow } from "@/components/dashboard/pulse/VehiclesOutNow";
import { AttentionRequired } from "@/components/dashboard/pulse/AttentionRequired";
import { NextFourHours } from "@/components/dashboard/pulse/NextFourHours";
import { DriverTelematics } from "@/components/dashboard/pulse/DriverTelematics";
import { CollapsibleSection } from "@/components/dashboard/pulse/CollapsibleSection";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import { SkeletonCard, SkeletonMetric } from "@/components/ui/skeleton-card";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { 
  Activity,
  PieChart
} from "lucide-react";

export const PulseEnhanced = () => {
  const { loading } = useLocationFilteredFleet();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <SkeletonMetric key={i} />
          ))}
        </div>
        <SkeletonCard />
        <SkeletonCard />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Live badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Activity className="w-3 h-3 mr-1 animate-pulse" />
            Live
          </Badge>
          <AskRariQuickAction
            variant="icon"
            prompt="Give me a quick overview of today's operations. Any concerns or opportunities I should know about?"
          />
        </div>
      </div>

      {/* Today's Snapshot - Compact metrics row (not collapsible) */}
      <TodaySnapshot />

      {/* Vehicles Out Now */}
      <VehiclesOutNow />

      {/* Attention Required */}
      <AttentionRequired />

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fleet Status */}
        <CollapsibleSection
          id="fleet-status"
          title="Fleet Status"
          icon={<PieChart className="h-4 w-4 text-primary" />}
        >
          <FleetStatusDonut />
        </CollapsibleSection>

        {/* Next 4 Hours */}
        <NextFourHours />
      </div>

      {/* Driver Telematics */}
      <DriverTelematics />
    </div>
  );
};
