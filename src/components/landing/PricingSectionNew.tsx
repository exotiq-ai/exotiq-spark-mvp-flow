import { useState } from 'react';

import { PricingCards } from './pricing/PricingCards';
import { ROICalculator } from './pricing/ROICalculator';
import { FeatureComparison } from './pricing/FeatureComparison';
import { PricingFAQ } from './pricing/PricingFAQ';
import { FreeTrialBanner } from './pricing/FreeTrialBanner';
import { PricingGuarantee } from './pricing/PricingGuarantee';
import { FinalCTA } from './pricing/FinalCTA';
import { PlanSelectionModal } from './pricing/PlanSelectionModal';
import { CalendlyModal } from './CalendlyModal';
import { type PricingTier } from './pricing/PricingData';
import { useNavigate } from 'react-router-dom';

export const PricingSectionNew = () => {
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null);
  const [isAnnual, setIsAnnual] = useState(true);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isCalendlyOpen, setIsCalendlyOpen] = useState(false);

  const handleSelectPlan = (tier: PricingTier, annual: boolean) => {
    setSelectedTier(tier);
    setIsAnnual(annual);
    setIsPlanModalOpen(true);
  };

  const handleStartTrial = () => {
    navigate('/auth?trial=true');
  };

  const handleScheduleDemo = () => {
    setIsCalendlyOpen(true);
  };

  const handleLockPricing = () => {
    // Scroll to pricing cards
    const pricingSection = document.getElementById('pricing-cards');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Pricing Hero */}
      <section className="py-20 lg:py-24 px-4 text-center">
        <div className="container mx-auto max-w-3xl">
          <p className="text-primary font-medium mb-4">Simple, transparent pricing</p>
          <h2 className="font-brand text-3xl sm:text-4xl font-bold mb-5 tracking-tight">
            Per-vehicle pricing that scales with you
          </h2>
          <p className="text-lg text-muted-foreground">
            Launch pricing — start with a 30-day free trial. Card required, nothing charged for 30 days.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section id="pricing-cards" className="py-8 px-4">
        <div className="container mx-auto">
          <PricingCards
            onSelectPlan={handleSelectPlan}
            onStartTrial={handleStartTrial}
          />
        </div>
      </section>

      {/* Feature Comparison */}
      <FeatureComparison />

      {/* ROI Calculator */}
      <ROICalculator />

      {/* Free Trial Banner */}
      <FreeTrialBanner onStartTrial={handleStartTrial} />

      {/* Pricing Guarantee */}
      <PricingGuarantee />

      {/* FAQ */}
      <PricingFAQ />

      {/* Final CTA */}
      <FinalCTA
        onLockPricing={handleLockPricing}
        onStartTrial={handleStartTrial}
        onScheduleDemo={handleScheduleDemo}
      />

      {/* Modals */}
      <PlanSelectionModal
        open={isPlanModalOpen}
        onOpenChange={setIsPlanModalOpen}
        selectedTier={selectedTier}
        isAnnual={isAnnual}
        returnPath="/welcome?subscription=success"
        cancelPath="/?canceled=true#pricing"
      />
      <CalendlyModal open={isCalendlyOpen} onOpenChange={setIsCalendlyOpen} />
    </>
  );
};
