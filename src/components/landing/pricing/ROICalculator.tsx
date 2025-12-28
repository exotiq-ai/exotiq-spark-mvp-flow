import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  TrendingUp, DollarSign, Wrench, Percent, Info, Calculator, 
  Clock, Coffee, Zap, Check, ArrowRight, Sparkles, Users,
  Shield, ChevronDown, Timer
} from 'lucide-react';
import { roiDefaults, roiMethodology, pricingTiers, timeSavingsDefaults, competitiveAdvantages, founderSpotsRemaining } from './PricingData';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Animated counter hook
const useAnimatedCounter = (target: number, duration: number = 1500, startOnView: boolean = true) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(!startOnView);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasStarted, startOnView]);

  useEffect(() => {
    if (!hasStarted) return;
    
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(target * easeOutQuart));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [target, duration, hasStarted]);

  return { count, ref };
};

export const ROICalculator = () => {
  const navigate = useNavigate();
  const [fleetSize, setFleetSize] = useState(15);
  const [isAnnual, setIsAnnual] = useState(true);
  const [showMethodology, setShowMethodology] = useState(false);

  // Calculate tier based on fleet size
  const getTier = (size: number) => {
    if (size <= 10) return pricingTiers[0];
    if (size <= 25) return pricingTiers[1];
    if (size <= 75) return pricingTiers[2];
    return pricingTiers[3];
  };

  const tier = getTier(fleetSize);

  // Calculate monthly Exotiq cost
  const getMonthlyExotiqCost = (size: number) => {
    const currentTier = getTier(size);
    if (currentTier.priceType === 'per-vehicle') {
      const basePrice = (currentTier.perVehicleRate || 29) * size;
      return Math.max(basePrice, currentTier.minPrice || 79);
    }
    if (size > currentTier.maxVehicles && currentTier.overageRate) {
      const overageVehicles = size - currentTier.maxVehicles;
      return currentTier.price + (overageVehicles * currentTier.overageRate);
    }
    return currentTier.price;
  };

  const monthlyExotiqCost = getMonthlyExotiqCost(fleetSize);
  const annualExotiqCost = isAnnual ? monthlyExotiqCost * 10 : monthlyExotiqCost * 12;
  const annualSavings = isAnnual ? monthlyExotiqCost * 2 : 0;

  // Daily & per-vehicle cost calculations
  const dailyCost = monthlyExotiqCost / 30;
  const perVehicleDailyCost = dailyCost / fleetSize;

  // ROI metrics
  const currentAnnualRevenue = fleetSize * roiDefaults.avgDailyRate * 365 * (roiDefaults.avgUtilization / 100);
  const projectedAnnualRevenue = currentAnnualRevenue * (1 + roiDefaults.revenueIncreasePercent / 100);
  const revenueIncrease = projectedAnnualRevenue - currentAnnualRevenue;

  const currentMaintenanceCost = fleetSize * roiDefaults.avgMaintenanceCostPerVehicle;
  const maintenanceSavings = currentMaintenanceCost * (roiDefaults.maintenanceSavingsPercent / 100);

  const totalAnnualGain = revenueIncrease + maintenanceSavings;
  const netGain = totalAnnualGain - annualExotiqCost;
  const roi = Math.round((netGain / annualExotiqCost) * 100);
  const paybackDays = Math.max(1, Math.ceil((annualExotiqCost / totalAnnualGain) * 365));

  // Time savings calculations
  const weeklyHoursSaved = fleetSize * timeSavingsDefaults.hoursPerVehiclePerWeek;
  const annualHoursSaved = weeklyHoursSaved * 52;
  const annualTimeSavingsValue = annualHoursSaved * timeSavingsDefaults.hourlyAdminRate;

  // Competitive comparisons
  const turoAnnualFees = currentAnnualRevenue * (competitiveAdvantages.vsTuro.feePercent / 100);
  const exotiqAnnualFees = currentAnnualRevenue * (competitiveAdvantages.vsTuro.ourFeePercent / 100);
  const turoSavings = turoAnnualFees - exotiqAnnualFees;

  // Animated counters
  const roiCounter = useAnimatedCounter(roi);
  const netGainCounter = useAnimatedCounter(netGain);
  const paybackCounter = useAnimatedCounter(paybackDays);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleStartTrial = () => {
    navigate('/auth?trial=true');
  };

  return (
    <section className="py-20 lg:py-28 px-4 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Calculator className="h-4 w-4" />
            ROI Calculator
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
            See What Exotiq Does for Your Fleet
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Real numbers. Real impact. Calculate your personalized ROI in seconds.
          </p>
        </div>

        <Card className="p-6 md:p-10 border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
          {/* Fleet Size Slider */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <label className="text-lg md:text-xl font-semibold">Your Fleet Size</label>
              <div className="text-right">
                <span className="text-4xl md:text-5xl font-bold text-primary">{fleetSize}</span>
                <span className="text-muted-foreground ml-2">vehicles</span>
              </div>
            </div>
            <Slider
              value={[fleetSize]}
              onValueChange={(value) => setFleetSize(value[0])}
              min={1}
              max={150}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground mt-3">
              <span>1</span>
              <span>25</span>
              <span>75</span>
              <span>150</span>
            </div>
          </div>

          {/* ==================== YOUR INVESTMENT SECTION ==================== */}
          <div className="mb-10 p-6 rounded-2xl bg-gradient-to-br from-primary/5 via-background to-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold">Your Investment</h3>
              <Badge variant="outline" className="ml-auto bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                {tier.name} Plan
              </Badge>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-background/50 border border-border">
              <div className="flex items-center gap-3">
                <span className={cn("text-sm", !isAnnual && "font-semibold")}>Monthly</span>
                <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
                <span className={cn("text-sm", isAnnual && "font-semibold")}>Annual</span>
                {isAnnual && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Save {formatCurrency(annualSavings)}/year
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {/* Monthly Cost */}
              <div className="p-4 rounded-xl bg-background border border-border text-center">
                <p className="text-sm text-muted-foreground mb-1">Monthly</p>
                <p className="text-3xl font-bold">
                  {isAnnual && <span className="text-lg text-muted-foreground line-through mr-2">${monthlyExotiqCost}</span>}
                  <span className="text-primary">${isAnnual ? Math.round(monthlyExotiqCost * 10 / 12) : monthlyExotiqCost}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">per month</p>
              </div>

              {/* Daily Cost */}
              <div className="p-4 rounded-xl bg-background border border-border text-center">
                <p className="text-sm text-muted-foreground mb-1">Daily</p>
                <p className="text-3xl font-bold text-primary">${dailyCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">per day</p>
              </div>

              {/* Per Vehicle Daily */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <p className="text-sm text-muted-foreground mb-1">Per Vehicle</p>
                <p className="text-3xl font-bold text-emerald-600">${perVehicleDailyCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">per vehicle/day</p>
              </div>
            </div>

            {/* Coffee Test */}
            <div className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-4">
              <Coffee className="h-8 w-8 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium">Less than a coffee per exotic car</p>
                <p className="text-sm text-muted-foreground">
                  ${perVehicleDailyCost.toFixed(2)}/day per vehicle is less than the cost of a latte. 
                  Each vehicle generates <span className="font-semibold text-foreground">${roiDefaults.avgDailyRate.toLocaleString()}/day</span> in revenue.
                </p>
              </div>
            </div>
          </div>

          {/* ==================== ROI METRICS CARDS ==================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <Card className="p-5 bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="h-6 w-6 text-emerald-500" />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">{roiMethodology.revenueIncreaseExplanation}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Revenue Increase</p>
              <p className="text-2xl md:text-3xl font-bold text-emerald-500">
                {formatCurrency(revenueIncrease)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                +{roiDefaults.revenueIncreasePercent}% from AI pricing
              </p>
            </Card>

            <Card className="p-5 bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <Wrench className="h-6 w-6 text-amber-500" />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">{roiMethodology.maintenanceSavingsExplanation}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Maintenance Saved</p>
              <p className="text-2xl md:text-3xl font-bold text-amber-500">
                {formatCurrency(maintenanceSavings)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {roiDefaults.maintenanceSavingsPercent}% reduction
              </p>
            </Card>

            <Card className="p-5 bg-primary/5 border-primary/20 hover:border-primary/40 transition-colors" ref={netGainCounter.ref}>
              <div className="flex items-center justify-between mb-3">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Net Annual Gain</p>
              <p className="text-2xl md:text-3xl font-bold text-primary">
                {formatCurrency(netGainCounter.count)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                After {formatCurrency(annualExotiqCost)} investment
              </p>
            </Card>

            <Card className="p-5 bg-violet-500/5 border-violet-500/20 hover:border-violet-500/40 transition-colors" ref={roiCounter.ref}>
              <div className="flex items-center justify-between mb-3">
                <Percent className="h-6 w-6 text-violet-500" />
                {roi > 1000 && (
                  <Sparkles className="h-4 w-4 text-violet-500 animate-pulse" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-1">Return on Investment</p>
              <p className="text-2xl md:text-3xl font-bold text-violet-500">
                {roiCounter.count.toLocaleString()}%
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Annual ROI
              </p>
            </Card>
          </div>

          {/* ==================== TIME SAVINGS SECTION ==================== */}
          <div className="mb-10 p-6 rounded-2xl bg-gradient-to-br from-sky-500/5 via-background to-sky-500/10 border border-sky-500/20">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-sky-500" />
              <h3 className="text-xl font-bold">Time You Get Back</h3>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-background border border-border text-center">
                <Timer className="h-6 w-6 text-sky-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-sky-600">{Math.round(weeklyHoursSaved)}</p>
                <p className="text-sm text-muted-foreground">hours/week saved</p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border text-center">
                <Clock className="h-6 w-6 text-sky-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-sky-600">{Math.round(annualHoursSaved).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">hours/year freed up</p>
              </div>
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 text-center">
                <DollarSign className="h-6 w-6 text-sky-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-sky-600">{formatCurrency(annualTimeSavingsValue)}</p>
                <p className="text-sm text-muted-foreground">value of time saved</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {timeSavingsDefaults.tasksAutomated.map((task, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border text-sm">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="truncate">{task.task}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ==================== COMPETITIVE COMPARISON ==================== */}
          <div className="mb-10 p-6 rounded-2xl bg-gradient-to-br from-rose-500/5 via-background to-rose-500/10 border border-rose-500/20">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-rose-500" />
              <h3 className="text-xl font-bold">vs. The Alternative</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* vs Turo */}
              <Card className="p-5 border-rose-500/20 bg-background">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">vs. Listing on Turo</span>
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30">
                    25% fees
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-rose-600 mb-2">
                  {formatCurrency(turoSavings)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Annual savings by keeping {100 - competitiveAdvantages.vsTuro.ourFeePercent}% of your revenue instead of paying 25% to Turo
                </p>
              </Card>

              {/* vs Manual */}
              <Card className="p-5 border-amber-500/20 bg-background">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">vs. Spreadsheets & Manual</span>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                    {competitiveAdvantages.vsManual.hoursPerWeekManual}+ hrs/week
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-amber-600 mb-2">
                  {formatCurrency(annualTimeSavingsValue)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Value of admin time saved by automating pricing, bookings, documents, and customer communications
                </p>
              </Card>
            </div>
          </div>

          {/* ==================== PERSONALIZED SUMMARY ==================== */}
          <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-primary/10 via-emerald-500/10 to-primary/10 border border-primary/20 mb-8" ref={paybackCounter.ref}>
            <Badge className="bg-primary/20 text-primary mb-4">
              Your {fleetSize}-Vehicle Fleet Summary
            </Badge>
            
            <div className="grid sm:grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-4xl md:text-5xl font-bold text-emerald-500">
                  {paybackCounter.count}
                </p>
                <p className="text-sm text-muted-foreground">days to payback</p>
              </div>
              <div>
                <p className="text-4xl md:text-5xl font-bold text-primary">
                  {formatCurrency(netGain)}
                </p>
                <p className="text-sm text-muted-foreground">net annual profit</p>
              </div>
              <div>
                <p className="text-4xl md:text-5xl font-bold text-violet-500">
                  {roi.toLocaleString()}%
                </p>
                <p className="text-sm text-muted-foreground">return on investment</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Invest <span className="font-semibold text-foreground">${perVehicleDailyCost.toFixed(2)}/vehicle/day</span> → 
              Generate <span className="font-semibold text-emerald-600">{formatCurrency(netGain)}</span> additional profit
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={handleStartTrial}
                className="gap-2 text-lg px-8"
              >
                <Zap className="h-5 w-5" />
                Start 14-Day Free Trial
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="font-medium text-primary">{founderSpotsRemaining}</span> founder spots left
              </div>
            </div>
          </div>

          {/* What You Get */}
          <div className="mb-8 p-6 rounded-xl bg-muted/30 border border-border">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              What's Included in {tier.name}
            </h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tier.features.slice(0, 6).map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">AI Forecasting</p>
                <p className="font-semibold text-primary">{tier.aiForecasting}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Locations</p>
                <p className="font-semibold">{tier.locations}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Support</p>
                <p className="font-semibold">{tier.supportSLA}</p>
              </div>
              <div>
                <p className="text-muted-foreground">API Access</p>
                <p className="font-semibold">{tier.apiAccess ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>

          {/* Methodology Disclosure */}
          <Collapsible open={showMethodology} onOpenChange={setShowMethodology}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 group">
                <Info className="h-4 w-4" />
                <span className="underline underline-offset-4">How we calculate these numbers</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showMethodology && "rotate-180")} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-6 p-6 rounded-xl bg-muted/30 border border-border text-sm space-y-4">
                <h4 className="font-semibold text-base mb-3">Calculation Methodology</h4>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-foreground">Daily Rate: ${roiDefaults.avgDailyRate.toLocaleString()}</p>
                    <p className="text-muted-foreground text-xs mt-1">{roiMethodology.dailyRateExplanation}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Utilization: {roiDefaults.avgUtilization}%</p>
                    <p className="text-muted-foreground text-xs mt-1">{roiMethodology.utilizationExplanation}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Revenue Increase: +{roiDefaults.revenueIncreasePercent}%</p>
                    <p className="text-muted-foreground text-xs mt-1">{roiMethodology.revenueIncreaseExplanation}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Maintenance Savings: {roiDefaults.maintenanceSavingsPercent}%</p>
                    <p className="text-muted-foreground text-xs mt-1">{roiMethodology.maintenanceSavingsExplanation}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground italic">
                    {roiMethodology.disclaimer}
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </section>
  );
};
