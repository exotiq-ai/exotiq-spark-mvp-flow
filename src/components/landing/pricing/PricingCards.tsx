import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { pricingTiers, type PricingTier } from './PricingData';

interface PricingCardsProps {
  onSelectPlan: (tier: PricingTier, isAnnual: boolean) => void;
  onStartTrial: () => void;
}

export const PricingCards = ({ onSelectPlan, onStartTrial }: PricingCardsProps) => {
  const [isAnnual, setIsAnnual] = useState(true);

  const getAnnualPrice = (monthlyPrice: number) => {
    return Math.round(monthlyPrice * 10); // 10 months = 2 months free
  };

  const getAnnualSavings = (monthlyPrice: number) => {
    return monthlyPrice * 2; // 2 months free
  };

  return (
    <div className="space-y-8">
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
          Monthly
        </span>
        <Switch
          checked={isAnnual}
          onCheckedChange={setIsAnnual}
          className="data-[state=checked]:bg-primary"
        />
        <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
          Annual
        </span>
        {isAnnual && (
          <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
            2 months free
          </Badge>
        )}
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {pricingTiers.map((tier) => (
          <Card
            key={tier.id}
            className={`relative p-6 transition-all duration-300 hover:shadow-xl ${
              tier.popular
                ? 'ring-2 ring-primary shadow-premium scale-[1.02] lg:scale-105'
                : 'hover:-translate-y-1'
            }`}
          >
            {tier.popular && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4">
                Most Popular
              </Badge>
            )}

            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{tier.vehicleRange}</p>

              {/* Pricing */}
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold text-primary">
                    ${isAnnual ? getAnnualPrice(tier.founderPrice) : tier.founderPrice}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /vehicle/{isAnnual ? 'year' : 'month'}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-muted-foreground line-through">
                    ${isAnnual ? getAnnualPrice(tier.regularPrice) : tier.regularPrice}
                  </span>
                  <Badge variant="outline" className="text-xs text-success border-success/30">
                    Founder Price
                  </Badge>
                </div>
                {isAnnual && (
                  <p className="text-xs text-success font-medium">
                    Save ${getAnnualSavings(tier.founderPrice)}/vehicle/year
                  </p>
                )}
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-6 min-h-[180px]">
              {tier.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* AI Badge */}
            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-muted/50">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-xs text-muted-foreground">
                {tier.aiForecasting} AI forecasting
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-2">
              <Button
                className="w-full"
                variant={tier.popular ? 'default' : 'outline'}
                onClick={() => onSelectPlan(tier, isAnnual)}
              >
                Lock in Founder Pricing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={onStartTrial}
              >
                Start 14-Day Free Trial
              </Button>
            </div>

            {/* Onboarding Offer */}
            {tier.onboardingOffer && isAnnual && (
              <p className="text-xs text-center text-muted-foreground mt-3">
                {tier.onboardingOffer}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
