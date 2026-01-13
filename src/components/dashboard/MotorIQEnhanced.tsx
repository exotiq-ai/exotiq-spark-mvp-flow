import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { QuickPriceEditorDialog } from "@/components/dialogs/QuickPriceEditorDialog";
import { PriceUtilizationScatterPlot } from "@/components/charts/PriceUtilizationScatterPlot";
import { DynamicPricingCard } from "@/components/dashboard/DynamicPricingCard";
import { DemandForecastCard } from "@/components/dashboard/DemandForecastCard";
import { LocationBadge } from "@/components/common/LocationBadge";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

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
  Download,
  X,
  Pencil
} from "lucide-react";
import { createExportActions } from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";

export const MotorIQEnhanced = () => {
  const { vehicles, applyPriceOptimization, loading, createVehicle } = useLocationFilteredFleet();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [dismissedRecommendationId, setDismissedRecommendationId] = useState<string | null>(null);
  const [selectedVehicleForPricing, setSelectedVehicleForPricing] = useState<typeof vehicles[0] | null>(null);

  // Check localStorage for dismissed recommendation on mount
  useEffect(() => {
    const stored = localStorage.getItem('motoriq_dismissed_recommendation');
    if (stored) {
      try {
        const { id, dismissedAt } = JSON.parse(stored);
        // Clear dismissal if older than 24 hours
        const dismissedTime = new Date(dismissedAt).getTime();
        const now = Date.now();
        if (now - dismissedTime < 24 * 60 * 60 * 1000) {
          setDismissedRecommendationId(id);
        } else {
          localStorage.removeItem('motoriq_dismissed_recommendation');
        }
      } catch {
        localStorage.removeItem('motoriq_dismissed_recommendation');
      }
    }
  }, []);

  // Listen for custom event from DynamicPricingCard to open quick price editor
  useEffect(() => {
    const handleOpenQuickPriceEditor = (event: CustomEvent) => {
      setSelectedVehicleForPricing(event.detail);
      setShowPriceEditor(true);
    };

    window.addEventListener('openQuickPriceEditor', handleOpenQuickPriceEditor as EventListener);
    return () => {
      window.removeEventListener('openQuickPriceEditor', handleOpenQuickPriceEditor as EventListener);
    };
  }, []);

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

  const handleEditPricing = (vehicle: typeof vehicles[0]) => {
    setSelectedVehicleForPricing(vehicle);
    setShowPriceEditor(true);
  };

  const handleApplyRate = async (vehicleId: string, newRate: number) => {
    await applyPriceOptimization(vehicleId, newRate);
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

  // Show recommendation card only if not dismissed or if it's a different recommendation
  const showRecommendationCard = topRecommendation && 
    potentialIncrease > 0 && 
    dismissedRecommendationId !== topRecommendation.id;

  const handleDismissRecommendation = () => {
    if (topRecommendation) {
      setDismissedRecommendationId(topRecommendation.id);
      localStorage.setItem('motoriq_dismissed_recommendation', JSON.stringify({
        id: topRecommendation.id,
        dismissedAt: new Date().toISOString()
      }));
      toast({
        title: "Recommendation dismissed",
        description: "View pricing details in the Pricing tab",
      });
    }
  };

  // Swipe gesture for mobile dismiss
  const { handlers: swipeHandlers, dragOffset, isDragging } = useSwipeGesture({
    onSwipeLeft: handleDismissRecommendation,
    onSwipeRight: handleDismissRecommendation,
    threshold: 80,
  });

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

      <QuickPriceEditorDialog
        open={showPriceEditor}
        onOpenChange={setShowPriceEditor}
        vehicle={selectedVehicleForPricing}
        onApplyRate={handleApplyRate}
      />

      <div className="space-y-4 sm:space-y-6 overflow-x-hidden w-full">
        {/* Module Tabs */}
        <ModuleTabs
          tabs={[
            { id: "overview", label: "Overview", shortLabel: "Home", icon: Brain },
            { id: "pricing", label: "Dynamic Pricing", shortLabel: "Price", icon: DollarSign },
            { id: "forecast", label: "Demand Forecast", shortLabel: "Trends", icon: BarChart3 },
          ]}
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsContent value="overview" className="space-y-6">
        <AnimatePresence mode="wait">
          {showRecommendationCard ? (
            <motion.div
              key="recommendation-card"
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                height: "auto",
                x: isDragging ? dragOffset : 0,
              }}
              exit={{ opacity: 0, x: dragOffset > 0 ? 100 : -100, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              {...swipeHandlers}
              style={{ 
                opacity: isDragging ? Math.max(0.3, 1 - Math.abs(dragOffset) / 150) : 1,
              }}
            >
              <Card className="card-premium bg-gradient-to-br from-success/10 via-primary/5 to-accent/10 border-success/20 p-3 sm:p-4 md:p-5 relative overflow-hidden">
                {/* Dismiss button */}
                <button
                  onClick={handleDismissRecommendation}
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50 transition-colors z-10 group"
                  aria-label="Dismiss recommendation"
                >
                  <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 pr-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-5 w-5 text-success animate-pulse" />
                      <Badge className="bg-success/20 text-success border-success/30 font-semibold text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI Recommendation
                      </Badge>
                    </div>
                    <h3 className="text-xl font-bold mb-1 bg-gradient-to-r from-success to-primary bg-clip-text text-transparent">
                      Top Revenue Opportunity
                    </h3>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div>
                      <p 
                        className="text-base font-semibold cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleEditPricing(topRecommendation)}
                      >
                        {topRecommendation.name}
                      </p>
                        <p className="text-xs text-muted-foreground">
                          ${Number(topRecommendation.current_rate).toLocaleString()}/day → ${Number(topRecommendation.suggested_rate).toLocaleString()}/day
                        </p>
                      </div>
                      <div className="h-10 w-px bg-border hidden sm:block"></div>
                      <div>
                        <p className="text-2xl font-bold text-success">
                          +${Math.round(potentialIncrease).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Monthly opportunity</p>
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowOptimizationDialog(true)}
                    className="btn-premium group"
                  >
                    <Zap className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                    Apply Now
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="optimized-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="card-premium p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-success" />
                  <div>
                    <h3 className="text-lg font-semibold">All Prices Optimized</h3>
                    <p className="text-sm text-muted-foreground">Your fleet is already at peak market rates</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

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
                className="group p-4 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent hover:border-primary/40 hover:shadow-md cursor-pointer transition-all"
                onClick={() => handleEditPricing(vehicle)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold group-hover:text-primary transition-colors">
                        {vehicle.name}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit Pricing
                      </Badge>
                    </div>
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