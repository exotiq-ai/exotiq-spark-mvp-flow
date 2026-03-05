import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
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
  const { vehicles, bookings, applyPriceOptimization } = useLocationFilteredFleet();
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

  // Calculate overall pricing factors from real data + PEAK_SEASONS
  const PEAK_SEASONS_CLIENT = [
    { name: 'Art Basel Miami', start: '12-01', end: '12-08', city: 'miami', surge: 1.35 },
    { name: 'Miami Boat Show', start: '02-12', end: '02-16', city: 'miami', surge: 1.30 },
    { name: 'Ultra Music Festival', start: '03-28', end: '03-30', city: 'miami', surge: 1.35 },
    { name: 'Miami Grand Prix', start: '05-02', end: '05-04', city: 'miami', surge: 1.40 },
    { name: 'Miami Open Tennis', start: '03-17', end: '03-30', city: 'miami', surge: 1.25 },
    { name: 'Spring Break', start: '03-10', end: '03-25', city: 'miami', surge: 1.25 },
    { name: 'Barrett-Jackson Auction', start: '01-18', end: '01-26', city: 'scottsdale', surge: 1.35 },
    { name: 'WM Phoenix Open', start: '02-03', end: '02-09', city: 'scottsdale', surge: 1.40 },
    { name: 'Christmas & New Years', start: '12-20', end: '01-03', city: 'all', surge: 1.45 },
    { name: 'Super Bowl Weekend', start: '02-05', end: '02-12', city: 'all', surge: 1.50 },
    { name: 'Memorial Day Weekend', start: '05-23', end: '05-26', city: 'all', surge: 1.25 },
    { name: 'Independence Day', start: '07-01', end: '07-06', city: 'all', surge: 1.30 },
    { name: 'Summer Peak', start: '06-15', end: '08-15', city: 'all', surge: 1.15 },
    { name: 'Thanksgiving Week', start: '11-24', end: '11-30', city: 'all', surge: 1.30 },
  ];

  // Find active peak season
  const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const activeSeason = PEAK_SEASONS_CLIENT.find(s => {
    const inRange = monthDay >= s.start && monthDay <= s.end;
    return inRange; // Match all cities for now
  });

  // Calculate real utilization from vehicle data
  const realUtilization = vehicles.length > 0
    ? vehicles.reduce((sum, v) => sum + (v.utilization || 0), 0) / vehicles.length
    : 0;

  // Derive seasonal factor from booking density (current month vs 3-month avg)
  const threeMonthsAgo = subMonths(now, 3);
  const recentBookings = bookings.filter(b => new Date(b.created_at || b.start_date) >= threeMonthsAgo);
  const monthlyAvg = recentBookings.length / 3;
  const currentMonthCount = currentMonthBookings.length;
  const seasonalFactor = monthlyAvg > 0 ? Math.max(0.8, Math.min(1.5, currentMonthCount / monthlyAvg)) : 1.0;

  const pricingFactors = pricingResult ? {
    baseRate: vehicles[0]?.current_rate || 100,
    demandMultiplier: pricingResult.demandMultiplier || (activeSeason?.surge || 1.0),
    seasonalFactor: pricingResult.factors.find(f => f.name.toLowerCase().includes('season'))?.impact 
      ? 1 + (pricingResult.factors.find(f => f.name.toLowerCase().includes('season'))?.impact || 0) / 100
      : seasonalFactor,
    eventPremium: events.length > 0 
      ? Math.round((events.reduce((sum, e) => sum + e.impactScore, 0) / events.length) / 10)
      : (activeSeason ? Math.round((activeSeason.surge - 1) * 100) : 0),
    activeSeason: activeSeason?.name || null,
    utilization: realUtilization,
  } : {
    baseRate: vehicles[0]?.current_rate || 100,
    demandMultiplier: activeSeason?.surge || 1.0,
    seasonalFactor,
    eventPremium: activeSeason ? Math.round((activeSeason.surge - 1) * 100) : 0,
    activeSeason: activeSeason?.name || null,
    utilization: realUtilization,
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

          <div className={`p-4 rounded-lg ${pricingFactors.eventPremium > 0 ? 'bg-accent/10 border border-accent/20' : 'bg-muted/30 border border-dashed'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Events</span>
              {pricingFactors.eventPremium > 0 ? (
                <Sparkles className="h-3 w-3 text-accent" />
              ) : (
                <Badge variant="outline" className="text-xs">None</Badge>
              )}
            </div>
            <div className={`text-2xl font-bold ${pricingFactors.eventPremium > 0 ? 'text-accent' : 'text-muted-foreground'}`}>
              {pricingFactors.eventPremium > 0 ? `+${pricingFactors.eventPremium}%` : '--'}
            </div>
            <div className="text-xs text-muted-foreground">
              {pricingFactors.activeSeason 
                ? pricingFactors.activeSeason 
                : (events.length > 0 ? `${events.length} events` : 'No active events')}
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
            value={selectedVehicle ?? undefined} 
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

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {vehicles.map((vehicle) => {
            const isAnalyzing = loading && selectedVehicle === vehicle.id;
            const hasResult = pricingResult && selectedVehicle === vehicle.id;
            
            return (
              <div
                key={vehicle.id}
                className={`group flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                  hasResult ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/30 hover:border-primary/30'
                }`}
                onClick={() => {
                  // Dispatch a custom event to open the quick price editor
                  const event = new CustomEvent('openQuickPriceEditor', { detail: vehicle });
                  window.dispatchEvent(event);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate group-hover:text-primary transition-colors">
                      {vehicle.name}
                    </span>
                    <Badge 
                      variant="outline" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      Edit
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ${Number(vehicle.current_rate).toLocaleString()}/day
                    {hasResult && pricingResult.suggestedRate > Number(vehicle.current_rate) && (
                      <span className="text-success ml-2">
                        → ${pricingResult.suggestedRate.toLocaleString()}
                        <span className="text-xs ml-1">
                          (+${(pricingResult.suggestedRate - Number(vehicle.current_rate)).toLocaleString()})
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  {isAnalyzing ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  ) : hasResult ? (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyRate(vehicle.id, pricingResult.suggestedRate);
                      }}
                    >
                      Apply ${pricingResult.suggestedRate.toLocaleString()}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAnalyzeVehicle(vehicle.id);
                      }}
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
