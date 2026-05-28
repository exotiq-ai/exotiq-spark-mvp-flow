import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  TrendingUp, DollarSign, Info, Calculator,
  Clock, Coffee, Zap, Check, ArrowRight, Sparkles,
  Shield, ChevronDown, Timer, PhoneCall
} from 'lucide-react';
import { roiDefaults, roiMethodology, timeSavingsDefaults, competitiveAdvantages, pickTierForFleetSize } from './PricingData';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Animated counter hook
const useAnimatedCounter = (target: number, duration: number = 1200) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setHasStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted) return;
    let startTime: number;
    const animate = (t: number) => {
      if (!startTime) startTime = t;
      const progress = Math.min((t - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(target * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration, hasStarted]);

  return { count, ref };
};

export const ROICalculator = () => {
  const navigate = useNavigate();
  const [fleetSize, setFleetSize] = useState(15);
  const [avgDailyRate, setAvgDailyRate] = useState(roiDefaults.avgDailyRate);
  const [utilization, setUtilization] = useState(roiDefaults.avgUtilization);
  const [isAnnual, setIsAnnual] = useState(true);
  const [showMethodology, setShowMethodology] = useState(false);

  const tier = pickTierForFleetSize(fleetSize);
  const isEnterprise = tier.priceType === 'custom';

  // --- Core math (matches exotiq.ai formulas exactly) ---
  // Revenue: fleetSize × dailyRate × 365 × utilization
  const currentRevenue = fleetSize * avgDailyRate * 365 * (utilization / 100);
  const projectedRevenue = currentRevenue * (1 + roiDefaults.revenueIncreasePercent / 100);
  const revenueUplift = projectedRevenue - currentRevenue;

  // Cost: per-vehicle rate × fleet size. Annual = monthly × 10 (2 months free).
  const monthlyCost = isEnterprise ? 0 : (tier.perVehicleRate ?? 39) * fleetSize;
  const annualCost = isAnnual ? monthlyCost * 10 : monthlyCost * 12;
  const annualSavings = isAnnual ? monthlyCost * 2 : 0;
  const effectiveMonthly = isAnnual ? annualCost / 12 : monthlyCost;
  const perVehicleDailyCost = isEnterprise ? 0 : (effectiveMonthly / fleetSize) / 30;

  // ROI = uplift / cost (multiplier). Payback in days based on uplift only (conservative).
  const netGain = revenueUplift - annualCost;
  const roiMultiplier = isEnterprise || annualCost === 0 ? 0 : revenueUplift / annualCost;
  const roiPercent = Math.round(roiMultiplier * 100);
  const paybackDays = isEnterprise || revenueUplift === 0
    ? 0
    : Math.max(1, Math.ceil((annualCost / revenueUplift) * 365));

  // Time savings (kept as secondary section)
  const weeklyHoursSaved = fleetSize * timeSavingsDefaults.hoursPerVehiclePerWeek;
  const annualHoursSaved = weeklyHoursSaved * 52;
  const annualTimeSavingsValue = annualHoursSaved * timeSavingsDefaults.hourlyAdminRate;

  // vs Turo
  const turoSavings = currentRevenue * (competitiveAdvantages.vsTuro.feePercent / 100);

  // Animated counters
  const netGainCounter = useAnimatedCounter(netGain);
  const paybackCounter = useAnimatedCounter(paybackDays);
  const roiCounter = useAnimatedCounter(roiMultiplier);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);
  };

  const handleStartTrial = () => navigate('/auth?trial=true');
  const handleContactSales = () => {
    window.location.href = 'mailto:sales@exotiq.ai?subject=Enterprise%20Pricing%20Inquiry';
  };

  return (
    <section className="py-20 lg:py-28 px-4 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Calculator className="h-4 w-4" />
            ROI Calculator
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
            See your numbers in seconds
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Move the sliders. Watch the math. No assumptions — your fleet, your rates.
          </p>
        </div>

        <Card className="p-6 md:p-10 border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
          {/* ============ INPUTS ============ */}
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            {/* Fleet Size */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-medium text-muted-foreground">Fleet size</label>
                <div>
                  <span className="text-2xl font-bold text-primary">{fleetSize}</span>
                  <span className="text-muted-foreground text-sm ml-1">vehicles</span>
                </div>
              </div>
              <Slider value={[fleetSize]} onValueChange={(v) => setFleetSize(v[0])} min={1} max={150} step={1} />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>1</span><span>50</span><span>150</span>
              </div>
            </div>

            {/* Avg Daily Rate */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-medium text-muted-foreground">Avg daily rate</label>
                <div>
                  <span className="text-2xl font-bold text-primary">${avgDailyRate.toLocaleString()}</span>
                  <span className="text-muted-foreground text-sm ml-1">/day</span>
                </div>
              </div>
              <Slider value={[avgDailyRate]} onValueChange={(v) => setAvgDailyRate(v[0])} min={500} max={3500} step={50} />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>$500</span><span>$1.5k</span><span>$3.5k</span>
              </div>
            </div>

            {/* Utilization */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-medium text-muted-foreground">Utilization</label>
                <div>
                  <span className="text-2xl font-bold text-primary">{utilization}</span>
                  <span className="text-muted-foreground text-sm ml-1">%</span>
                </div>
              </div>
              <Slider value={[utilization]} onValueChange={(v) => setUtilization(v[0])} min={20} max={85} step={1} />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>20%</span><span>52%</span><span>85%</span>
              </div>
            </div>
          </div>

          {/* ============ YOUR PROJECTED ANNUAL IMPACT (cohesive headline) ============ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-5 bg-background border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Current Revenue</p>
              <p className="text-2xl md:text-3xl font-bold">{formatCurrency(currentRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-2">At {utilization}% utilization</p>
            </Card>

            <Card className="p-5 bg-emerald-500/5 border-emerald-500/20">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">With AI Pricing</p>
              <p className="text-2xl md:text-3xl font-bold text-emerald-600">{formatCurrency(projectedRevenue)}</p>
              <p className="text-xs text-emerald-600/80 mt-2">+{formatCurrency(revenueUplift)} uplift</p>
            </Card>

            <Card className="p-5 bg-background border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Exotiq Cost</p>
              {isEnterprise ? (
                <>
                  <p className="text-2xl md:text-3xl font-bold">Custom</p>
                  <p className="text-xs text-muted-foreground mt-2">~$20–28/vehicle</p>
                </>
              ) : (
                <>
                  <p className="text-2xl md:text-3xl font-bold">{formatCurrency(annualCost)}</p>
                  <p className="text-xs text-muted-foreground mt-2">{isAnnual ? 'Annual (2 mo free)' : 'Monthly × 12'}</p>
                </>
              )}
            </Card>

            <Card className="p-5 bg-primary/5 border-primary/30" ref={netGainCounter.ref}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Net Annual Gain</p>
              <p className="text-2xl md:text-3xl font-bold text-primary">
                {isEnterprise ? formatCurrency(revenueUplift) : formatCurrency(netGainCounter.count)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {isEnterprise ? 'Uplift before custom fee' : 'After Exotiq cost'}
              </p>
            </Card>
          </div>

          {/* ============ HERO STAT — payback + ROI multiplier ============ */}
          <div className="text-center p-8 md:p-10 rounded-2xl bg-gradient-to-r from-primary/10 via-emerald-500/10 to-primary/10 border border-primary/20 mb-10" ref={paybackCounter.ref}>
            {!isEnterprise ? (
              <>
                <p className="text-lg md:text-xl text-muted-foreground mb-3">
                  Exotiq pays for itself in
                </p>
                <p className="text-6xl md:text-7xl font-bold text-emerald-500 mb-2">
                  {Math.round(paybackCounter.count)}<span className="text-3xl md:text-4xl text-emerald-500/80 ml-2">days</span>
                </p>
                <div className="flex items-center justify-center gap-6 mt-6 flex-wrap">
                  <div className="text-center" ref={roiCounter.ref}>
                    <p className="text-3xl md:text-4xl font-bold text-primary">
                      {roiCounter.count.toFixed(1)}x
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      return ({roiPercent.toLocaleString()}%)
                    </p>
                  </div>
                  <div className="h-12 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-3xl md:text-4xl font-bold text-primary">
                      {formatCurrency(netGain)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">net annual profit</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">Enterprise Fleet</Badge>
                <p className="text-3xl md:text-4xl font-bold mb-3">
                  {formatCurrency(revenueUplift)} <span className="text-muted-foreground font-normal text-xl">in projected annual uplift</span>
                </p>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Fleets of 51+ get custom pricing, dedicated success management, and white-glove migration.
                </p>
              </>
            )}

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-8">
              {isEnterprise ? (
                <Button size="lg" onClick={handleContactSales} className="gap-2 text-base px-8">
                  <PhoneCall className="h-5 w-5" />
                  Book Enterprise Call
                  <ArrowRight className="h-5 w-5" />
                </Button>
              ) : (
                <Button size="lg" onClick={handleStartTrial} className="gap-2 text-base px-8">
                  <Zap className="h-5 w-5" />
                  Start 14-Day Free Trial
                  <ArrowRight className="h-5 w-5" />
                </Button>
              )}
              <span className="text-sm text-muted-foreground">No credit card required</span>
            </div>
          </div>

          {/* ============ BILLING TOGGLE (secondary) ============ */}
          {!isEnterprise && (
            <div className="flex items-center justify-center gap-3 mb-10 p-3 rounded-xl bg-muted/30 border border-border max-w-md mx-auto">
              <span className={cn("text-sm", !isAnnual && "font-semibold")}>Monthly</span>
              <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
              <span className={cn("text-sm", isAnnual && "font-semibold")}>Annual</span>
              {isAnnual && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  Save {formatCurrency(annualSavings)}
                </Badge>
              )}
            </div>
          )}

          {/* ============ SECONDARY DETAILS ============ */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {/* Coffee Test */}
            {!isEnterprise && (
              <Card className="p-5 bg-amber-500/5 border-amber-500/20 flex items-center gap-4">
                <Coffee className="h-8 w-8 text-amber-600 shrink-0" />
                <div>
                  <p className="font-semibold">${perVehicleDailyCost.toFixed(2)}/vehicle/day</p>
                  <p className="text-sm text-muted-foreground">
                    Less than a latte — for software that earns {formatCurrency(revenueUplift / fleetSize)}/vehicle in uplift.
                  </p>
                </div>
              </Card>
            )}

            {/* vs Turo */}
            <Card className="p-5 bg-rose-500/5 border-rose-500/20 flex items-center gap-4">
              <Shield className="h-8 w-8 text-rose-600 shrink-0" />
              <div>
                <p className="font-semibold">{formatCurrency(turoSavings)} saved vs. Turo</p>
                <p className="text-sm text-muted-foreground">
                  Keep 100% of direct bookings instead of paying {competitiveAdvantages.vsTuro.feePercent}% to marketplaces.
                </p>
              </div>
            </Card>

            {/* Time savings */}
            <Card className="p-5 bg-sky-500/5 border-sky-500/20 flex items-center gap-4 md:col-span-2">
              <Clock className="h-8 w-8 text-sky-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">
                  {Math.round(weeklyHoursSaved)} hrs/week back ({formatCurrency(annualTimeSavingsValue)}/year in admin time)
                </p>
                <p className="text-sm text-muted-foreground">
                  Automated pricing, bookings, document tracking, and customer communications.
                </p>
              </div>
            </Card>
          </div>

          {/* ============ METHODOLOGY ============ */}
          <Collapsible open={showMethodology} onOpenChange={setShowMethodology}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                <Info className="h-4 w-4" />
                <span className="underline underline-offset-4">How we calculate these numbers</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showMethodology && "rotate-180")} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-4 p-6 rounded-xl bg-muted/30 border border-border text-sm space-y-3">
                <div>
                  <p className="font-medium">Revenue</p>
                  <code className="text-xs text-muted-foreground">fleet × daily rate × 365 × utilization</code>
                </div>
                <div>
                  <p className="font-medium">Uplift (+{roiDefaults.revenueIncreasePercent}%)</p>
                  <p className="text-xs text-muted-foreground">{roiMethodology.revenueIncreaseExplanation}</p>
                </div>
                <div>
                  <p className="font-medium">Payback</p>
                  <code className="text-xs text-muted-foreground">(annual Exotiq cost ÷ revenue uplift) × 365</code>
                </div>
                <div>
                  <p className="font-medium">ROI multiplier</p>
                  <code className="text-xs text-muted-foreground">revenue uplift ÷ annual Exotiq cost</code>
                </div>
                <p className="text-xs text-muted-foreground italic pt-2 border-t border-border">
                  {roiMethodology.disclaimer}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </section>
  );
};
