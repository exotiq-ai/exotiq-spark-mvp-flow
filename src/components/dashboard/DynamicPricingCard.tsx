import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useFleet } from "@/contexts/FleetContext";
import { useAIPricingEnhanced } from "@/hooks/useAIPricingEnhanced";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Zap,
  Info,
  Settings,
  Sparkles,
  RefreshCw,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subMonths, subYears } from "date-fns";

interface DynamicPricingCardProps {
  onApplyOptimization: () => void;
}

export const DynamicPricingCard = ({ onApplyOptimization }: DynamicPricingCardProps) => {
  const { vehicles, bookings, applyPriceOptimization } = useFleet();
  const { loading, pricingResult, events, analyzePricing } = useAIPricingEnhanced();
  const [autoPricingEnabled, setAutoPricingEnabled] = useState<Record<string, boolean>>({});
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  // Calculate historical comparison data
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  const lastYear = subYears(now, 1);

  const currentMonthBookings = bookings.filter(b => {
    const date = new Date(b.created_at || b.start_date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  const lastMonthBookings = bookings.filter(b => {
    const date = new Date(b.created_at || b.start_date);
    return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
  });

  const lastYearSameMonthBookings = bookings.filter(b => {
    const date = new Date(b.created_at || b.start_date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === lastYear.getFullYear();
  });

  const currentMonthRevenue = currentMonthBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
  const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
  const lastYearRevenue = lastYearSameMonthBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);

  const momChange = lastMonthRevenue > 0 
    ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1) 
    : 'N/A';
  const yoyChange = lastYearRevenue > 0 
    ? ((currentMonthRevenue - lastYearRevenue) / lastYearRevenue * 100).toFixed(1) 
    : 'N/A';

  const toggleAutoPricing = (vehicleId: string) => {
    setAutoPricingEnabled(prev => ({
      ...prev,
      [vehicleId]: !prev[vehicleId]
    }));
  };

  const handleAnalyzeVehicle = async (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setSelectedVehicle(vehicleId);
      await analyzePricing(vehicle, bookings);
    }
  };

  const handleApplyRate = async (vehicleId: string, newRate: number) => {
    await applyPriceOptimization(vehicleId, newRate);
  };

  // Calculate overall pricing factors based on AI result or defaults
  const pricingFactors = pricingResult ? {
    baseRate: vehicles[0]?.current_rate || 100,
    demandMultiplier: pricingResult.demandMultiplier || 1.15,
    seasonalFactor: pricingResult.factors.find(f => f.name.toLowerCase().includes('season'))?.impact 
      ? 1 + (pricingResult.factors.find(f => f.name.toLowerCase().includes('season'))?.impact || 0) / 100
      : 1.08,
    eventPremium: events.length > 0 
      ? Math.round((events.reduce((sum, e) => sum + e.impactScore, 0) / events.length) / 10)
      : 0,
    utilization: vehicles.reduce((sum, v) => sum + (v.utilization || 0), 0) / Math.max(vehicles.length, 1),
  } : {
    baseRate: vehicles[0]?.current_rate || 100,
    demandMultiplier: 1.15,
    seasonalFactor: 1.08,
    eventPremium: events.length > 0 ? 12 : 0,
    utilization: 78,
  };

  const effectiveMultiplier = pricingFactors.demandMultiplier * pricingFactors.seasonalFactor * 
    (1 + pricingFactors.eventPremium / 100);

  return (
    <Card className="card-premium p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">AI Dynamic Pricing</h3>
            <p className="text-sm text-muted-foreground">Powered by MotorIQ Intelligence</p>
          </div>
        </div>
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <Sparkles className="h-3 w-3 mr-1" />
          AI Active
        </Badge>
      </div>

      {/* Historical Comparison Section */}
      <div className="mb-6 p-4 rounded-lg bg-muted/20 border">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Revenue Comparison</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">${currentMonthRevenue.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{format(now, 'MMM yyyy')}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              {momChange !== 'N/A' && Number(momChange) >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-success" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              )}
              <span className={`text-lg font-bold ${
                momChange !== 'N/A' && Number(momChange) >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                {momChange !== 'N/A' ? `${momChange}%` : '--'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">vs Last Month</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              {yoyChange !== 'N/A' && Number(yoyChange) >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-success" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              )}
              <span className={`text-lg font-bold ${
                yoyChange !== 'N/A' && Number(yoyChange) >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                {yoyChange !== 'N/A' ? `${yoyChange}%` : '--'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">vs Last Year</div>
          </div>
        </div>
      </div>

      {/* Pricing Factors Breakdown */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-sm text-muted-foreground">AI Pricing Factors</h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/30 border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Base Rate</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Average daily rate across fleet</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-2xl font-bold">${Math.round(pricingFactors.baseRate)}</div>
            <div className="text-xs text-muted-foreground">per day</div>
          </div>

          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Demand</span>
              <TrendingUp className="h-3 w-3 text-success" />
            </div>
            <div className="text-2xl font-bold text-success">
              +{((pricingFactors.demandMultiplier - 1) * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">{Math.round(pricingFactors.utilization)}% utilized</div>
          </div>

          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Seasonal</span>
              <Calendar className="h-3 w-3 text-warning" />
            </div>
            <div className="text-2xl font-bold text-warning">
              +{((pricingFactors.seasonalFactor - 1) * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">{format(now, 'MMMM')} rates</div>
          </div>

          <div className={`p-4 rounded-lg ${events.length > 0 ? 'bg-accent/10 border border-accent/20' : 'bg-muted/30 border border-dashed'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Events</span>
              {events.length > 0 ? (
                <Sparkles className="h-3 w-3 text-accent" />
              ) : (
                <Badge variant="outline" className="text-xs">Live</Badge>
              )}
            </div>
            <div className={`text-2xl font-bold ${events.length > 0 ? 'text-accent' : 'text-muted-foreground'}`}>
              {events.length > 0 ? `+${pricingFactors.eventPremium}%` : '--'}
            </div>
            <div className="text-xs text-muted-foreground">
              {events.length > 0 ? `${events.length} events` : 'No events'}
            </div>
          </div>
        </div>

        {/* AI Insight */}
        {pricingResult && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm mb-1">AI Insight</div>
                <p className="text-sm text-muted-foreground">{pricingResult.reasoning}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {pricingResult.confidence}% confidence
                  </Badge>
                  <Badge variant="outline" className="text-xs text-success">
                    {pricingResult.expectedRevenue.improvement > 0 ? '+' : ''}{pricingResult.expectedRevenue.improvement}% potential
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Effective Rate */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Effective Rate Multiplier</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {effectiveMultiplier.toFixed(2)}x
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Example Rate</div>
              <div className="text-2xl font-bold">
                ${Math.round(pricingFactors.baseRate * effectiveMultiplier)}/day
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Per-Vehicle AI Pricing */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Vehicle Pricing Analysis</h4>
          <Select 
            value={selectedVehicle || ''} 
            onValueChange={(v) => handleAnalyzeVehicle(v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Analyze vehicle..." />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 max-h-[200px] overflow-y-auto">
          {vehicles.slice(0, 5).map((vehicle) => {
            const isAnalyzing = loading && selectedVehicle === vehicle.id;
            const hasResult = pricingResult && selectedVehicle === vehicle.id;
            
            return (
              <div
                key={vehicle.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  hasResult ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/30'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{vehicle.name}</div>
                  <div className="text-sm text-muted-foreground">
                    ${vehicle.current_rate}/day
                    {hasResult && pricingResult.suggestedRate > Number(vehicle.current_rate) && (
                      <span className="text-success ml-2">
                        → ${pricingResult.suggestedRate}
                        <span className="text-xs ml-1">
                          (+${pricingResult.suggestedRate - Number(vehicle.current_rate)})
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isAnalyzing ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  ) : hasResult ? (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApplyRate(vehicle.id, pricingResult.suggestedRate)}
                    >
                      Apply ${pricingResult.suggestedRate}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAnalyzeVehicle(vehicle.id)}
                    >
                      Analyze
                    </Button>
                  )}
                  <Switch
                    checked={autoPricingEnabled[vehicle.id] || false}
                    onCheckedChange={() => toggleAutoPricing(vehicle.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Button onClick={onApplyOptimization} className="w-full btn-premium" disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Apply All AI Optimizations
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
