import { Button } from '@/components/ui/button';
import { Shield, Zap, CreditCard } from 'lucide-react';

interface FreeTrialBannerProps {
  onStartTrial: () => void;
}

export const FreeTrialBanner = ({ onStartTrial }: FreeTrialBannerProps) => {
  return (
    <section className="py-12 px-4 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
      <div className="container mx-auto max-w-4xl text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          Not Ready to Commit? Start Your Free Trial
        </h2>
        <p className="text-lg text-muted-foreground mb-6">
          14 days of full access to explore every feature. No credit card required.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6 mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4 text-success" />
            <span>No charge until trial ends</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-success" />
            <span>Full feature access</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-success" />
            <span>Setup in 5 minutes</span>
          </div>
        </div>

        <Button size="lg" onClick={onStartTrial} className="h-14 px-8 text-lg">
          Start Your Free Trial
        </Button>
      </div>
    </section>
  );
};
