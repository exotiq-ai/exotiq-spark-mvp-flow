import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Calendar, Zap } from 'lucide-react';

interface FinalCTAProps {
  onLockPricing: () => void;
  onStartTrial: () => void;
  onScheduleDemo: () => void;
}

export const FinalCTA = ({ onLockPricing, onStartTrial, onScheduleDemo }: FinalCTAProps) => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-4xl">
        <Card className="p-8 md:p-12 bg-gradient-to-br from-primary via-primary-dark to-primary text-primary-foreground text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Fleet Operations?
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Join the fleet operators who are already using AI to boost revenue by 25% and cut maintenance costs by 38%
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              size="lg"
              variant="secondary"
              className="bg-background text-foreground hover:bg-background/90 h-14 px-8 text-lg"
              onClick={onStartTrial}
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary h-14 px-8 text-lg"
              onClick={onLockPricing}
            >
              <Zap className="mr-2 h-5 w-5" />
              View Plans
            </Button>
          </div>

          {/* Schedule Demo Link */}
          <button
            onClick={onScheduleDemo}
            className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
          >
            <Calendar className="h-4 w-4" />
            <span className="underline underline-offset-4">Schedule a demo with our team</span>
          </button>

          {/* Trust Elements */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 pt-8 border-t border-primary-foreground/20">
            <p className="text-sm opacity-80">14-day free trial</p>
            <p className="text-sm opacity-80">No charge until trial ends</p>
            <p className="text-sm opacity-80">Cancel anytime</p>
            <p className="text-sm opacity-80">30-day money-back guarantee</p>
          </div>
        </Card>
      </div>
    </section>
  );
};
