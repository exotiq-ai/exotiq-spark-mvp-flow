import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { TrendingUp, DollarSign, Wrench, Percent } from 'lucide-react';
import { roiDefaults, pricingTiers } from './PricingData';

export const ROICalculator = () => {
  const [fleetSize, setFleetSize] = useState(15);

  // Calculate tier based on fleet size
  const getTier = (size: number) => {
    return pricingTiers.find(t => size >= t.minVehicles && size <= t.maxVehicles) || pricingTiers[0];
  };

  const tier = getTier(fleetSize);

  // Calculate ROI metrics
  const currentAnnualRevenue = fleetSize * roiDefaults.avgDailyRate * 365 * (roiDefaults.avgUtilization / 100);
  const projectedAnnualRevenue = currentAnnualRevenue * (1 + roiDefaults.revenueIncreasePercent / 100);
  const revenueIncrease = projectedAnnualRevenue - currentAnnualRevenue;

  const currentMaintenanceCost = fleetSize * roiDefaults.avgMaintenanceCostPerVehicle;
  const maintenanceSavings = currentMaintenanceCost * (roiDefaults.maintenanceSavingsPercent / 100);

  const totalAnnualGain = revenueIncrease + maintenanceSavings;
  const annualExotiqCost = fleetSize * tier.founderPrice * 12;
  const netGain = totalAnnualGain - annualExotiqCost;
  const roi = Math.round((netGain / annualExotiqCost) * 100);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Calculate Your ROI</h2>
          <p className="text-lg text-muted-foreground">
            See how much Exotiq can boost your fleet profitability
          </p>
        </div>

        <Card className="p-8">
          {/* Fleet Size Slider */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <label className="text-lg font-semibold">Your Fleet Size</label>
              <span className="text-3xl font-bold text-primary">{fleetSize} vehicles</span>
            </div>
            <Slider
              value={[fleetSize]}
              onValueChange={(value) => setFleetSize(value[0])}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>1</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100+</span>
            </div>
          </div>

          {/* Your Tier */}
          <div className="mb-8 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground">Your tier:</p>
            <p className="text-xl font-bold text-primary">
              {tier.name} - ${tier.founderPrice}/vehicle/month
            </p>
          </div>

          {/* ROI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 bg-success/5 border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-success" />
                <span className="text-sm text-muted-foreground">Revenue Increase</span>
              </div>
              <p className="text-2xl font-bold text-success">
                {formatCurrency(revenueIncrease)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                +{roiDefaults.revenueIncreasePercent}% with AI pricing
              </p>
            </Card>

            <Card className="p-4 bg-warning/5 border-warning/20">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-5 w-5 text-warning" />
                <span className="text-sm text-muted-foreground">Maintenance Saved</span>
              </div>
              <p className="text-2xl font-bold text-warning">
                {formatCurrency(maintenanceSavings)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {roiDefaults.maintenanceSavingsPercent}% reduction
              </p>
            </Card>

            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Net Annual Gain</span>
              </div>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(netGain)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                After Exotiq cost
              </p>
            </Card>

            <Card className="p-4 bg-accent/5 border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="h-5 w-5 text-accent" />
                <span className="text-sm text-muted-foreground">ROI</span>
              </div>
              <p className="text-2xl font-bold text-accent">
                {roi}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Return on investment
              </p>
            </Card>
          </div>

          {/* Summary */}
          <div className="text-center p-6 rounded-lg bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10">
            <p className="text-lg text-muted-foreground mb-2">
              Based on industry averages for luxury vehicle rentals
            </p>
            <p className="text-2xl font-bold">
              Exotiq pays for itself in{' '}
              <span className="text-success">
                {Math.ceil((annualExotiqCost / totalAnnualGain) * 12)} months
              </span>
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
};
