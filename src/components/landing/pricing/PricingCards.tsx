import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
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
    <div className="space-y-12">
      {/* Billing Toggle - Stripe style */}
      <div className="flex items-center justify-center gap-4">
        <span className={`text-sm transition-colors ${!isAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          Monthly
        </span>
        <Switch
          checked={isAnnual}
          onCheckedChange={setIsAnnual}
          className="data-[state=checked]:bg-primary"
        />
        <span className={`text-sm transition-colors ${isAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          Annual
        </span>
        {isAnnual && (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">
            Save 2 months
          </Badge>
        )}
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
        {pricingTiers.map((tier) => (
          <Card
            key={tier.id}
            className={`relative p-6 lg:p-7 transition-all duration-300 rounded-2xl ${
              tier.popular
                ? 'ring-2 ring-primary shadow-xl shadow-primary/10 scale-[1.02] lg:scale-105 bg-card'
                : 'hover:shadow-lg hover:-translate-y-1 bg-card/50'
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-4 py-1 shadow-lg">
                  Most Popular
                </Badge>
              </div>
            )}

            {/* Header */}
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-1">{tier.name}</h3>
              <p className="text-sm text-muted-foreground">{tier.vehicleRange}</p>
            </div>

            {/* Pricing */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  ${isAnnual ? getAnnualPrice(tier.founderPrice) : tier.founderPrice}
                </span>
                <span className="text-muted-foreground text-sm">
                  /vehicle/{isAnnual ? 'year' : 'month'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground line-through">
                  ${isAnnual ? getAnnualPrice(tier.regularPrice) : tier.regularPrice}
                </span>
                <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                  Founder Price
                </Badge>
              </div>
              {isAnnual && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                  Save ${getAnnualSavings(tier.founderPrice)} per vehicle
                </p>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-6">
              {tier.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            {/* AI Badge */}
            <div className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-violet-500/5 border border-violet-500/20">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
                {tier.aiForecasting} AI forecasting
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-2">
              <Button
                className={`w-full rounded-full h-11 ${tier.popular ? 'shadow-lg shadow-primary/25' : ''}`}
                variant={tier.popular ? 'default' : 'outline'}
                onClick={() => onSelectPlan(tier, isAnnual)}
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Onboarding Offer */}
            {tier.onboardingOffer && isAnnual && (
              <p className="text-xs text-center text-muted-foreground mt-4">
                {tier.onboardingOffer}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Trial CTA */}
      <div className="text-center">
        <button
          onClick={onStartTrial}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Or start a <span className="text-primary font-medium">14-day free trial</span> with any plan
        </button>
      </div>
    </div>
  );
};
