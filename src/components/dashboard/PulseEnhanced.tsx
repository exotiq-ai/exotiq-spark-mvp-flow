import { ModuleTabs, TabsContent } from "@/components/common/ModuleTabs";
import { HappeningNow } from "@/components/dashboard/pulse/HappeningNow";
import { AttentionRequiredTab } from "@/components/dashboard/pulse/AttentionRequiredTab";
import { TelematicsTab } from "@/components/dashboard/pulse/TelematicsTab";
import { FleetMapTab } from "@/components/dashboard/pulse/FleetMapTab";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import { SkeletonCard, SkeletonMetric } from "@/components/ui/skeleton-card";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useTeam } from "@/contexts/TeamContext";
import { 
  Activity,
  AlertTriangle,
  Gauge,
  MapPin
} from "lucide-react";

const pulseTabs = [
  { id: 'now', label: 'Happening Now', shortLabel: 'Now', icon: Activity },
  { id: 'attention', label: 'Attention Required', shortLabel: 'Attention', icon: AlertTriangle },
  { id: 'telematics', label: 'Telematics', shortLabel: 'Telematics', icon: Gauge },
  { id: 'map', label: 'Fleet Map', shortLabel: 'Map', icon: MapPin },
];

export const PulseEnhanced = () => {
  const { loading } = useLocationFilteredFleet();
  const { selectedLocationId, currentLocation, locations } = useTeam();
  
  const showLocationIndicator = selectedLocationId !== 'all' && locations.length > 1;

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
      {/* Tabbed navigation with Rari action */}
      <ModuleTabs 
        tabs={pulseTabs} 
        defaultValue="now" 
        data-tour="pulse-tabs"
        rightContent={
          <AskRariQuickAction
            variant="icon"
            prompt="Give me a quick overview of today's operations. Any concerns or opportunities I should know about?"
          />
        }
      >
        {/* Compact location indicator */}
        {showLocationIndicator && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1 py-1.5 -mt-2 mb-2">
            <MapPin className="h-3 w-3 text-primary" />
            <span>{currentLocation?.name}</span>
          </div>
        )}
        
        <TabsContent value="now">
          <HappeningNow />
        </TabsContent>

        <TabsContent value="attention">
          <AttentionRequiredTab />
        </TabsContent>

        <TabsContent value="telematics">
          <TelematicsTab />
        </TabsContent>

        <TabsContent value="map">
          <FleetMapTab />
        </TabsContent>
      </ModuleTabs>
    </div>
  );
};
