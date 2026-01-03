import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DriverPerformanceTrend } from "@/components/charts/DriverPerformanceTrend";
import { FleetStatusDonut } from "@/components/charts/FleetStatusDonut";
import { TodaySnapshot } from "@/components/dashboard/pulse/TodaySnapshot";
import { VehiclesOutNow } from "@/components/dashboard/pulse/VehiclesOutNow";
import { AttentionRequired } from "@/components/dashboard/pulse/AttentionRequired";
import { NextFourHours } from "@/components/dashboard/pulse/NextFourHours";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import { SkeletonCard, SkeletonMetric } from "@/components/ui/skeleton-card";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { 
  Activity, 
  User
} from "lucide-react";

export const PulseEnhanced = () => {
  const { loading } = useLocationFilteredFleet();

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Today's Snapshot skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <SkeletonMetric key={i} />
          ))}
        </div>
        
        {/* Vehicles Out skeleton */}
        <SkeletonCard />
        
        {/* Attention Required skeleton */}
        <SkeletonCard />
        
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Live badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Activity className="w-3 h-3 mr-1" />
            Live
          </Badge>
          <AskRariQuickAction
            variant="icon"
            prompt="Give me a quick overview of today's operations. Any concerns or opportunities I should know about?"
          />
        </div>
      </div>

      {/* Today's Snapshot - Compact metrics row */}
      <TodaySnapshot />

      {/* Vehicles Out Now - Hero section */}
      <VehiclesOutNow />

      {/* Attention Required - Actionable alerts */}
      <AttentionRequired />

      {/* Two column layout for remaining sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Status Donut */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Fleet Status</h3>
          <FleetStatusDonut />
        </Card>

        {/* Next 4 Hours Timeline */}
        <NextFourHours />
      </div>

      {/* Driver Telematics Section - Ready for API */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Driver Telematics</h3>
            <p className="text-sm text-muted-foreground mt-1">Real-time driver performance monitoring</p>
          </div>
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Activity className="w-3 h-3 mr-1" />
            Live
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Driver 1 - High Performance */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-success/20 rounded-lg">
                  <User className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h4 className="font-semibold">Marcus Chen</h4>
                  <p className="text-xs text-muted-foreground">Lamborghini Huracán</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Performance Score</span>
                  <span className="text-2xl font-bold text-success">86%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success" style={{ width: '86%' }}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="text-xs">
                  <div className="text-muted-foreground">Smooth Driving</div>
                  <div className="font-semibold">Excellent</div>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground">Safety</div>
                  <div className="font-semibold">95/100</div>
                </div>
              </div>
            </div>
            
            <DriverPerformanceTrend
              driverName="Marcus Chen"
              currentScore={86}
              vehicle="Lamborghini Huracán"
              status="excellent"
            />
          </div>

          {/* Driver 2 - Needs Improvement */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-destructive/20 rounded-lg">
                  <User className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h4 className="font-semibold">Sarah Mitchell</h4>
                  <p className="text-xs text-muted-foreground">Ferrari 488</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Performance Score</span>
                  <span className="text-2xl font-bold text-destructive">72%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-destructive" style={{ width: '72%' }}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="text-xs">
                  <div className="text-muted-foreground">Smooth Driving</div>
                  <div className="font-semibold">Fair</div>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground">Safety</div>
                  <div className="font-semibold">78/100</div>
                </div>
              </div>
            </div>
            
            <DriverPerformanceTrend
              driverName="Sarah Mitchell"
              currentScore={72}
              vehicle="Ferrari 488"
              status="needs-improvement"
            />
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          💡 API Integration Ready: Connect your telematics provider to display live driver data
        </div>
      </Card>
    </div>
  );
};
