import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { TrendingUp, DollarSign, Wrench, Percent, Info, Calculator } from 'lucide-react';
import { roiDefaults, roiMethodology, pricingTiers } from './PricingData';
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

export const ROICalculator = () => {
  const [fleetSize, setFleetSize] = useState(15);
  const [showMethodology, setShowMethodology] = useState(false);

  // Calculate tier based on fleet size
  const getTier = (size: number) => {
    if (size <= 10) return pricingTiers[0]; // Starter
    if (size <= 25) return pricingTiers[1]; // Professional
    if (size <= 75) return pricingTiers[2]; // Business
    return pricingTiers[3]; // Enterprise
  };

  const tier = getTier(fleetSize);

  // Calculate monthly Exotiq cost based on hybrid pricing
  const getMonthlyExotiqCost = (size: number) => {
    const currentTier = getTier(size);
    if (currentTier.priceType === 'per-vehicle') {
      const basePrice = (currentTier.perVehicleRate || 29) * size;
      return Math.max(basePrice, currentTier.minPrice || 79);
    }
    // Flat rate with potential overage
    if (size > currentTier.maxVehicles && currentTier.overageRate) {
      const overageVehicles = size - currentTier.maxVehicles;
      return currentTier.price + (overageVehicles * currentTier.overageRate);
    }
    return currentTier.price;
  };

  // Calculate ROI metrics using realistic exotic car data
  const currentAnnualRevenue = fleetSize * roiDefaults.avgDailyRate * 365 * (roiDefaults.avgUtilization / 100);
  const projectedAnnualRevenue = currentAnnualRevenue * (1 + roiDefaults.revenueIncreasePercent / 100);
  const revenueIncrease = projectedAnnualRevenue - currentAnnualRevenue;

  const currentMaintenanceCost = fleetSize * roiDefaults.avgMaintenanceCostPerVehicle;
  const maintenanceSavings = currentMaintenanceCost * (roiDefaults.maintenanceSavingsPercent / 100);

  const totalAnnualGain = revenueIncrease + maintenanceSavings;
  const annualExotiqCost = getMonthlyExotiqCost(fleetSize) * 12;
  const netGain = totalAnnualGain - annualExotiqCost;
  const roi = Math.round((netGain / annualExotiqCost) * 100);
  const paybackMonths = Math.max(1, Math.ceil((annualExotiqCost / totalAnnualGain) * 12));

  // Get price display for tier
  const getPriceDisplay = () => {
    if (tier.priceType === 'per-vehicle') {
      return `$${tier.perVehicleRate}/vehicle/month`;
    }
    return `$${tier.price}/month flat`;
  };

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
            Calculate Your Fleet ROI
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            See the projected impact of AI-powered fleet management on your exotic car rental business
          </p>
        </div>

        <Card className="p-6 md:p-10 border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
          {/* Fleet Size Slider */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <label className="text-lg md:text-xl font-semibold">Fleet Size</label>
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
              <span>1 vehicle</span>
              <span>25</span>
              <span>75</span>
              <span>150</span>
            </div>
          </div>

          {/* Tier & Assumptions */}
          <div className="grid md:grid-cols-2 gap-4 mb-10">
            <div className="p-5 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Your Plan</p>
              <p className="text-2xl font-bold text-primary">
                {tier.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {getPriceDisplay()}
              </p>
            </div>
            <div className="p-5 rounded-xl bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground mb-1">Calculation Basis</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">
                  ${roiDefaults.avgDailyRate.toLocaleString()}/day avg × {roiDefaults.avgUtilization}% utilization
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">{roiMethodology.dailyRateExplanation}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Exotic fleet industry average (Ferrari, Lamborghini, McLaren)
              </p>
            </div>
          </div>

          {/* ROI Cards */}
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

            <Card className="p-5 bg-primary/5 border-primary/20 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Net Annual Gain</p>
              <p className="text-2xl md:text-3xl font-bold text-primary">
                {formatCurrency(netGain)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                After {formatCurrency(annualExotiqCost)} Exotiq cost
              </p>
            </Card>

            <Card className="p-5 bg-violet-500/5 border-violet-500/20 hover:border-violet-500/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <Percent className="h-6 w-6 text-violet-500" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Return on Investment</p>
              <p className="text-2xl md:text-3xl font-bold text-violet-500">
                {roi.toLocaleString()}%
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Annual ROI
              </p>
            </Card>
          </div>

          {/* Payback Summary */}
          <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-primary/10 mb-8">
            <p className="text-lg text-muted-foreground mb-3">
              Based on your {fleetSize}-vehicle exotic fleet
            </p>
            <p className="text-2xl md:text-3xl font-bold mb-2">
              Exotiq pays for itself in{' '}
              <span className="text-emerald-500">
                {paybackMonths} {paybackMonths === 1 ? 'month' : 'months'}
              </span>
            </p>
            <p className="text-muted-foreground">
              Then generates <span className="font-semibold text-foreground">{formatCurrency(netGain)}</span> in additional annual profit
            </p>
          </div>

          {/* Methodology Disclosure */}
          <Collapsible open={showMethodology} onOpenChange={setShowMethodology}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 group">
                <Info className="h-4 w-4" />
                <span className="underline underline-offset-4">How we calculate these numbers</span>
                <span className={`transition-transform ${showMethodology ? 'rotate-180' : ''}`}>↓</span>
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
