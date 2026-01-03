import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { VehicleImageDialog } from "@/components/dialogs/VehicleImageDialog";
import { PriceUtilizationScatterPlot } from "@/components/charts/PriceUtilizationScatterPlot";
import { DynamicPricingCard } from "@/components/dashboard/DynamicPricingCard";
import { DemandForecastCard } from "@/components/dashboard/DemandForecastCard";
import { LocationBadge } from "@/components/common/LocationBadge";

import { SkeletonMetric, SkeletonCard, SkeletonBarChart, SkeletonTable } from "@/components/ui/skeleton-card";
import { SkeletonAIInsight, SkeletonVehicleCard, SkeletonStatsRow } from "@/components/ui/skeleton-specialized";
import { EmptyState, NoVehiclesState } from "@/components/common/EmptyState";
import { AddVehicleDialog } from "@/components/dialogs/AddVehicleDialog";
import { 
  TrendingUp, 
  Zap,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Brain,
  Car,
  DollarSign,
  BarChart3,
  Download
} from "lucide-react";
import { createExportActions } from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";

export const MotorIQEnhanced = () => {
  const { vehicles, applyPriceOptimization, loading, createVehicle } = useLocationFilteredFleet();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const [showVehicleImage, setShowVehicleImage] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{
    name: string;
    make: string;
    model: string;
    year: number;
    status: string;
    dailyRate: number;
  } | null>(null);

  const handleExportFleetData = () => {
    const exportData = vehicles.map(v => ({
      name: v.name,
      make: v.make,
      model: v.model,
      year: v.year,
      status: v.status,
      currentRate: v.current_rate,
      suggestedRate: v.suggested_rate || v.current_rate,
      utilization: v.utilization || 0,
      revenue: v.revenue || 0,
    }));

    const actions = createExportActions(exportData, `fleet-data-${new Date().toISOString().split('T')[0]}`);
    actions.exportCSV();
    toast({ title: "Fleet data exported", description: "CSV file downloaded successfully" });
  };

  const handleVehicleClick = (vehicle: typeof vehicles[0]) => {
    setSelectedVehicle({
      name: vehicle.name,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      status: vehicle.status,
      dailyRate: Number(vehicle.current_rate),
    });
    setShowVehicleImage(true);
  };

  const vehiclesWithOptimization = vehicles
    .filter(v => v.name !== 'Lotus Evija')
    .map(v => ({
      ...v,
      opportunity: v.suggested_rate && v.suggested_rate > v.current_rate 
        ? `$${((v.suggested_rate - v.current_rate) * 30).toFixed(0)}` 
        : null
    }));

  const validOptimizations = vehiclesWithOptimization.filter(v => 
    v.suggested_rate && v.suggested_rate > v.current_rate
  );
  
  const topRecommendation = validOptimizations[0] || null;
  const potentialIncrease = topRecommendation?.suggested_rate 
    ? (topRecommendation.suggested_rate - topRecommendation.current_rate) * 30 
    : 0;

  // Show empty state if no vehicles
  if (!loading && vehicles.length === 0) {
    return (
      <div className="space-y-6">
        <NoVehiclesState onAddVehicle={() => setShowAddVehicle(true)} />
        <AddVehicleDialog 
          open={showAddVehicle}
          onOpenChange={setShowAddVehicle}
          onSubmit={createVehicle}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* AI Recommendation skeleton */}
        <SkeletonAIInsight />
        
        {/* Metrics skeleton */}
        <SkeletonStatsRow count={3} />
        
        {/* Chart skeleton */}
        <SkeletonBarChart height={200} bars={8} />
        
        {/* Fleet list skeleton */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
              <div className="h-4 w-32 bg-muted/60 rounded animate-pulse" />
            </div>
            <div className="h-9 w-28 bg-muted rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            <SkeletonVehicleCard />
            <SkeletonVehicleCard />
            <SkeletonVehicleCard />
          </div>
        </Card>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={<Car className="h-16 w-16" />}
        title="No vehicles in your fleet"
        description="Add vehicles to your fleet to start tracking pricing and performance optimization opportunities."
        action={{
          label: "Add Vehicle",
          onClick: () => window.location.href = '/dashboard?module=vault'
        }}
      />
    );
  }

  return (
    <>
      <PriceOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        vehicles={vehiclesWithOptimization}
        onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
      />

      {selectedVehicle && (
        <VehicleImageDialog
          open={showVehicleImage}
          onOpenChange={setShowVehicleImage}
          vehicleName={selectedVehicle.name}
          vehicleDetails={selectedVehicle}
        />
      )}

      <div className="space-y-4 sm:space-y-6 overflow-x-hidden w-full">
        {/* Module Tabs */}
        <ModuleTabs
          tabs={[
            { id: "overview", label: "Overview", shortLabel: "Overview", icon: Brain },
            { id: "pricing", label: "Dynamic Pricing", shortLabel: "Pricing", icon: DollarSign },
            { id: "forecast", label: "Demand Forecast", shortLabel: "Forecast", icon: BarChart3 },
          ]}
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsContent value="overview" className="space-y-6">
        {topRecommendation && potentialIncrease > 0 ? (
          <Card className="card-premium bg-gradient-to-br from-success/10 via-primary/5 to-accent/10 border-success/20 p-4 sm:p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-6 w-6 text-success animate-pulse" />
                  <Badge className="bg-success/20 text-success border-success/30 font-semibold">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Recommendation
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-success to-primary bg-clip-text text-transparent">
                  Top Revenue Opportunity Identified
                </h3>
                <p className="text-muted-foreground mb-4">
                  Based on market analysis, we've identified a high-value opportunity for your fleet
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div>
                    <p 
                      className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleVehicleClick(topRecommendation)}
                    >
                      {topRecommendation.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${topRecommendation.current_rate}/day → ${topRecommendation.suggested_rate}/day
                    </p>
                  </div>
                  <div className="h-12 w-px bg-border hidden sm:block"></div>
                  <div>
                    <p className="text-3xl font-bold text-success">
                      +${potentialIncrease.toFixed(0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Monthly opportunity</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => setShowOptimizationDialog(true)}
                  className="btn-premium group"
                  size="lg"
                >
                  <Zap className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                  Apply Now
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="card-premium p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-success" />
              <div>
                <h3 className="text-lg font-semibold">All Prices Optimized</h3>
                <p className="text-sm text-muted-foreground">Your fleet is already at peak market rates</p>
              </div>
            </div>
          </Card>
        )}

        {/* Key Fleet Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          <Card className="card-module p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <Badge className="bg-success/20 text-success">+8.2%</Badge>
            </div>
            <div className="text-2xl font-bold mb-1">$47,230</div>
            <div className="text-sm text-muted-foreground">Total Fleet Revenue</div>
            <div className="text-xs text-muted-foreground mt-1">This week</div>
          </Card>

          <Card className="card-module p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-warning/10 rounded-lg">
                <Zap className="h-5 w-5 text-warning" />
              </div>
              <Badge className="bg-warning/20 text-warning">{validOptimizations.length}</Badge>
            </div>
            <div className="text-2xl font-bold mb-1">Active</div>
            <div className="text-sm text-muted-foreground">Optimization Opportunities</div>
            <div className="text-xs text-muted-foreground mt-1">Ready to apply</div>
          </Card>

          <Card className="card-module p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <Badge className="bg-primary/20 text-primary">78%</Badge>
            </div>
            <div className="text-2xl font-bold mb-1">Average</div>
            <div className="text-sm text-muted-foreground">Fleet Utilization</div>
            <div className="text-xs text-muted-foreground mt-1">Past 30 days</div>
          </Card>
        </div>

        {/* Price vs Utilization Scatter Plot */}
        <PriceUtilizationScatterPlot />

        {/* Fleet Performance Details */}
        <Card className="card-premium p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6 mb-4 sm:mb-6">
            <div>
              <h3 className="text-xl font-semibold">Fleet Performance</h3>
              <p className="text-sm text-muted-foreground">Individual vehicle insights</p>
            </div>
            {validOptimizations.length > 0 && (
              <Button 
                onClick={() => setShowOptimizationDialog(true)}
                variant="outline"
                className="hidden md:flex"
              >
                <Zap className="h-4 w-4 mr-2" />
                Optimize All
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {vehiclesWithOptimization.map(vehicle => (
              <div
                key={vehicle.id}
                className="p-4 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 
                      className="font-semibold cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleVehicleClick(vehicle)}
                    >
                      {vehicle.name}
                    </h4>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                      <LocationBadge locationId={vehicle.location_id} />
                    </div>
                  </div>
                  {vehicle.opportunity && (
                    <Badge className="bg-success/20 text-success border-success/30">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {vehicle.opportunity}/mo
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">Current Rate</div>
                    <div className="font-semibold">${vehicle.current_rate}/day</div>
                  </div>
                  {vehicle.suggested_rate && vehicle.suggested_rate > vehicle.current_rate && (
                    <div>
                      <div className="text-muted-foreground mb-1">Suggested Rate</div>
                      <div className="font-semibold text-success">${vehicle.suggested_rate}/day</div>
                    </div>
                  )}
                  <div>
                    <div className="text-muted-foreground mb-1">Utilization</div>
                    <div className="font-semibold">{vehicle.utilization}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Status</div>
                    <Badge variant="outline" className="capitalize">{vehicle.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-6">
            <DynamicPricingCard onApplyOptimization={() => setShowOptimizationDialog(true)} />
          </TabsContent>

          <TabsContent value="forecast" className="space-y-6">
            <DemandForecastCard />
          </TabsContent>
        </ModuleTabs>
      </div>
    </>
  );
};