import { TodaySnapshot } from "./TodaySnapshot";
import { VehiclesOutNow } from "./VehiclesOutNow";
import { NextFourHours } from "./NextFourHours";
import { FleetStatusDonut } from "@/components/charts/FleetStatusDonut";
import { CollapsibleSection } from "./CollapsibleSection";
import { PieChart } from "lucide-react";

export const HappeningNow = () => {
  return (
    <div className="space-y-4">
      {/* Today's Snapshot - Compact metrics row */}
      <div data-tour="fleet-snapshot">
        <TodaySnapshot />
      </div>

      {/* Two column layout: Fleet Status + Next 4 Hours */}
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

      {/* Vehicles Out Now - Moved below for better hierarchy */}
      <VehiclesOutNow />
    </div>
  );
};
