import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useAIPricingEnhanced } from "@/hooks/useAIPricingEnhanced";
import { SuccessCheckmark } from "@/components/ui/success-checkmark";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Zap,
  Sparkles,
  RefreshCw,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Car,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subMonths, subYears } from "date-fns";

interface AppliedVehicle {
  oldRate: number;
  newRate: number;
  appliedAt: Date;
}

export interface PricingContext {
  reasoning: string;
  factors: Array<{ name: string; impact: number; description: string }>;
  confidence: number;
  expectedRevenue: { daily: number; monthly: number; improvement: number };
  events: Array<{ id: string; name: string; date: string; category: string; attendance: number; impactScore: number }>;
  demandMultiplier?: number;
}

interface DynamicPricingCardProps {
  onApplyOptimization: () => void;
  onOpenPriceEditor?: (vehicle: any, context: PricingContext | null) => void;
}

export const DynamicPricingCard = ({ onApplyOptimization, onOpenPriceEditor }: DynamicPricingCardProps) => {
  const { vehicles, bookings, applyPriceOptimization } = useLocationFilteredFleet();
  const { loading, pricingResult, events, analyzePricing } = useAIPricingEnhanced();
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [appliedVehicles, setAppliedVehicles] = useState<Record<string, AppliedVehicle>>({});

  // Compute real utilization from bookings for each vehicle
  const vehicleUtilizations = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const utils: Record<string, number> = {};
    vehicles.forEach(v => {
      const vehicleBookings = bookings.filter(b => 
        b.vehicle_id === v.id && 
        (b.status === 'active' || b.status === 'confirmed' || b.status === 'completed')
      );
      
      let bookedDays = 0;
      vehicleBookings.forEach(b => {
        const start = new Date(Math.max(new Date(b.start_date).getTime(), thirtyDaysAgo.getTime()));
        const end = new Date(Math.min(new Date(b.end_date).getTime(), now.getTime()));
        if (end > start) {
          bookedDays += Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }
      });
      
      utils[v.id] = Math.min(100, Math.round((bookedDays / 30) * 100));
    });
    return utils;
  }, [vehicles, bookings]);

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
    : null;
  const yoyChange = lastYearRevenue > 0 
    ? ((currentMonthRevenue - lastYearRevenue) / lastYearRevenue * 100).toFixed(1) 
    : null;

  const handleAnalyzeVehicle = async (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setSelectedVehicle(vehicleId);
      const vehicleWithRealUtil = {
        ...vehicle,
        utilization: vehicleUtilizations[vehicleId] ?? 0,
      };
      await analyzePricing(vehicleWithRealUtil, bookings);
    }
  };

  const handleApplyRate = async (vehicleId: string, newRate: number) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    const oldRate = vehicle ? Number(vehicle.current_rate) : 0;
    await applyPriceOptimization(vehicleId, newRate);
    setAppliedVehicles(prev => ({
      ...prev,
      [vehicleId]: { oldRate, newRate, appliedAt: new Date() },
    }));
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

  const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const activeSeason = PEAK_SEASONS_CLIENT.find(s => monthDay >= s.start && monthDay <= s.end);

  // Calculate real fleet utilization from bookings
  const realUtilization = useMemo(() => {
    if (vehicles.length === 0) return 0;
    const totalUtil = vehicles.reduce((sum, v) => sum + (vehicleUtilizations[v.id] ?? 0), 0);
    return Math.round(totalUtil / vehicles.length);
  }, [vehicles, vehicleUtilizations]);

  // Derive seasonal factor from booking density
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

  // Fleet summary metrics
  const avgRate = vehicles.length > 0 
    ? Math.round(vehicles.reduce((sum, v) => sum + Number(v.current_rate), 0) / vehicles.length) 
    : 0;
  const optimizedCount = Object.keys(appliedVehicles).length;

  // Sort vehicles: highest opportunity first, applied last
  const sortedVehicles = useMemo(() => {
    return [...vehicles].sort((a, b) => {
      const aApplied = !!appliedVehicles[a.id];
      const bApplied = !!appliedVehicles[b.id];
      if (aApplied !== bApplied) return aApplied ? 1 : -1;
      
      const aGain = (a.suggested_rate && a.suggested_rate > a.current_rate) 
        ? (a.suggested_rate - a.current_rate) : 0;
      const bGain = (b.suggested_rate && b.suggested_rate > b.current_rate) 
        ? (b.suggested_rate - b.current_rate) : 0;
      return bGain - aGain;
    });
  }, [vehicles, appliedVehicles]);

  // Build pricing context for the dialog
  const buildPricingContext = (): PricingContext | null => {
    if (!pricingResult) return null;
    return {
      reasoning: pricingResult.reasoning,
      factors: pricingResult.factors,
      confidence: pricingResult.confidence,
      expectedRevenue: pricingResult.expectedRevenue,
      events: pricingResult.events || [],
      demandMultiplier: pricingResult.demandMultiplier,
    };
  };

  const handleVehicleClick = (vehicle: any) => {
    if (onOpenPriceEditor) {
      const context = selectedVehicle === vehicle.id ? buildPricingContext() : null;
      onOpenPriceEditor(vehicle, context);
    } else {
      const event = new CustomEvent('openQuickPriceEditor', { detail: vehicle });
      window.dispatchEvent(event);
    }
  };

  return (
    <Card className="card-premium p-6">
      {/* Header */}
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
        <Badge className="bg-primary/20 text-primary border-primary/30 gap-1.5">
          <Sparkles className="h-3 w-3" />
          FleetCopilot™ Active
        </Badge>
      </div>

      {/* Revenue Comparison — Compact Row */}
      <div className="mb-6 p-3 rounded-lg bg-muted/20 border">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="font-semibold text-lg">${currentMonthRevenue.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">{format(now, 'MMM yyyy')}</span>
          </div>
          <div className="flex items-center gap-4">
            {/* MoM */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-default">
                    {momChange !== null ? (
                      <>
                        {Number(momChange) >= 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span className={`text-sm font-semibold ${Number(momChange) >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {momChange}%
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                    <span className="text-xs text-muted-foreground">MoM</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {momChange !== null 
                    ? <p>${lastMonthRevenue.toLocaleString()} in {format(lastMonth, 'MMM yyyy')}</p>
                    : <p>No prior month data available</p>
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-4 w-px bg-border" />

            {/* YoY */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-default">
                    {yoyChange !== null ? (
                      <>
                        {Number(yoyChange) >= 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span className={`text-sm font-semibold ${Number(yoyChange) >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {yoyChange}%
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                    <span className="text-xs text-muted-foreground">YoY</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {yoyChange !== null 
                    ? <p>${lastYearRevenue.toLocaleString()} in {format(lastYear, 'MMM yyyy')}</p>
                    : <p>No prior year data available</p>
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Compact Pricing Factor Chips */}
      <div className="mb-6">
        <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-3">Pricing Factors</h4>
        <div className="flex flex-wrap gap-2">
          {/* Base Rate */}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Badge variant="outline" className="cursor-pointer px-3 py-1.5 text-sm gap-1.5 hover:bg-muted/50 transition-colors">
                <DollarSign className="h-3 w-3" />
                Base ${Math.round(pricingFactors.baseRate)}
              </Badge>
            </HoverCardTrigger>
            <HoverCardContent className="w-64">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Base Rate</h4>
                <p className="text-xs text-muted-foreground">Average daily rate across your fleet, calculated from current vehicle rates.</p>
                <div className="text-xs text-muted-foreground">{vehicles.length} vehicles in fleet</div>
              </div>
            </HoverCardContent>
          </HoverCard>

          {/* Demand */}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Badge className="cursor-pointer px-3 py-1.5 text-sm gap-1.5 bg-success/15 text-success border-success/30 hover:bg-success/25 transition-colors">
                <TrendingUp className="h-3 w-3" />
                Demand +{((pricingFactors.demandMultiplier - 1) * 100).toFixed(0)}%
              </Badge>
            </HoverCardTrigger>
            <HoverCardContent className="w-64">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Demand Multiplier</h4>
                <p className="text-xs text-muted-foreground">Based on current booking velocity and fleet utilization ({pricingFactors.utilization}% utilized).</p>
                <div className="text-xs">{currentMonthBookings.length} bookings this month</div>
              </div>
            </HoverCardContent>
          </HoverCard>

          {/* Seasonal */}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Badge className="cursor-pointer px-3 py-1.5 text-sm gap-1.5 bg-warning/15 text-warning border-warning/30 hover:bg-warning/25 transition-colors">
                <Calendar className="h-3 w-3" />
                Season +{((pricingFactors.seasonalFactor - 1) * 100).toFixed(0)}%
              </Badge>
            </HoverCardTrigger>
            <HoverCardContent className="w-64">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Seasonal Adjustment</h4>
                <p className="text-xs text-muted-foreground">{format(now, 'MMMM')} booking density compared to 3-month rolling average.</p>
                <div className="text-xs">{monthlyAvg.toFixed(0)} avg monthly bookings</div>
              </div>
            </HoverCardContent>
          </HoverCard>

          {/* Events */}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Badge className={`cursor-pointer px-3 py-1.5 text-sm gap-1.5 transition-colors ${
                pricingFactors.eventPremium > 0 
                  ? 'bg-accent/15 text-accent border-accent/30 hover:bg-accent/25' 
                  : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
              }`}>
                <Sparkles className="h-3 w-3" />
                {pricingFactors.eventPremium > 0 
                  ? `🎪 ${pricingFactors.activeSeason || 'Events'} +${pricingFactors.eventPremium}%`
                  : 'No Events'
                }
              </Badge>
            </HoverCardTrigger>
            <HoverCardContent className="w-72">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Event Impact</h4>
                {pricingFactors.activeSeason ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{pricingFactors.activeSeason}</span> is driving a {pricingFactors.eventPremium}% premium on luxury vehicle demand.
                  </p>
                ) : events.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Upcoming events in market:</p>
                    {events.slice(0, 3).map(e => (
                      <div key={e.id} className="text-xs flex justify-between">
                        <span>{e.name}</span>
                        <span className="text-muted-foreground">Impact: {e.impactScore}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No major events detected in your market this period.</p>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      </div>

      {/* AI Insight (when analysis is available) */}
      {pricingResult && (
        <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
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
              {pricingResult.events && pricingResult.events.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-primary/10">
                  <span className="text-xs text-muted-foreground">Events factored:</span>
                  {pricingResult.events.slice(0, 3).map((event) => (
                    <Badge key={event.id} variant="outline" className="text-xs gap-1">
                      <Calendar className="h-3 w-3" />
                      {event.name}
                      <span className="text-muted-foreground">({event.impactScore})</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fleet Pricing Summary */}
      <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Fleet Pricing Summary</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Avg Rate</div>
            <div className="text-xl font-bold">${avgRate}/day</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Fleet Revenue</div>
            <div className="text-xl font-bold">
              ${currentMonthRevenue >= 1000 
                ? `${(currentMonthRevenue / 1000).toFixed(0)}K` 
                : currentMonthRevenue.toLocaleString()
              }
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Optimized</div>
            <div className="text-xl font-bold">{optimizedCount}/{vehicles.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Utilization</div>
            <div className="text-xl font-bold">{realUtilization}%</div>
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
                  <span className="flex items-center gap-2">
                    {vehicle.name}
                    {appliedVehicles[vehicle.id] && (
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {sortedVehicles.map((vehicle) => {
            const isAnalyzing = loading && selectedVehicle === vehicle.id;
            const hasResult = pricingResult && selectedVehicle === vehicle.id;
            const isApplied = appliedVehicles[vehicle.id];
            const computedUtil = vehicleUtilizations[vehicle.id] ?? 0;
            const gain = hasResult && pricingResult.suggestedRate > Number(vehicle.current_rate) 
              ? (pricingResult.suggestedRate - Number(vehicle.current_rate)) * 30 
              : 0;
            
            return (
              <div
                key={vehicle.id}
                className={`group flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                  isApplied 
                    ? 'bg-success/5 border-success/30' 
                    : hasResult 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'hover:bg-muted/30 hover:border-primary/30'
                }`}
                onClick={() => handleVehicleClick(vehicle)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isApplied && <SuccessCheckmark size="sm" />}
                      <span className={`font-medium truncate text-sm ${isApplied ? 'text-success' : 'group-hover:text-primary'} transition-colors`}>
                        {vehicle.name}
                      </span>
                      {isApplied && (
                        <Badge className="bg-success/20 text-success border-success/30 text-[10px] px-1.5 py-0">
                          Updated
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      {isApplied ? (
                        <>
                          <span className="line-through">${isApplied.oldRate.toLocaleString()}</span>
                          <span className="text-success font-medium">→ ${isApplied.newRate.toLocaleString()}/day</span>
                        </>
                      ) : (
                        <>
                          ${Number(vehicle.current_rate).toLocaleString()}/day
                          <span className="text-muted-foreground/60">•</span>
                          <span>{computedUtil}% util</span>
                          {hasResult && gain > 0 && (
                            <>
                              <span className="text-muted-foreground/60">•</span>
                              <span className="text-success">+${gain.toLocaleString()}/mo</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {isApplied ? (
                    <Badge variant="outline" className="text-xs text-success border-success/30">
                      ✓ ${isApplied.newRate.toLocaleString()}
                    </Badge>
                  ) : isAnalyzing ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  ) : hasResult ? (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVehicleClick(vehicle);
                      }}
                    >
                      Review ${pricingResult.suggestedRate.toLocaleString()}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAnalyzeVehicle(vehicle.id);
                      }}
                    >
                      Analyze
                    </Button>
                  )}
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
