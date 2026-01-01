import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  LayoutDashboard, 
  Car, 
  Sparkles, 
  Check,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExotiqLogoBranded } from '@/components/common/ExotiqLogo';
import { RacingStripe } from '@/components/automotive/RacingStripe';

interface QuickOnboardingProps {
  open: boolean;
  onComplete: () => void;
}

const steps = [
  {
    id: 'welcome',
    icon: LayoutDashboard,
    title: 'Welcome to Your Command Center',
    description: 'Your dashboard is mission control for your entire fleet. Monitor revenue, track bookings, and get AI-powered insights—all in one place.',
    image: '🎯',
    tips: [
      'Real-time revenue tracking',
      'Fleet status at a glance',
      'AI-powered optimization',
    ],
  },
  {
    id: 'vehicles',
    icon: Car,
    title: 'Add Your First Vehicle',
    description: 'Build your fleet by adding vehicles. Set pricing, upload photos, track maintenance, and watch your profitability soar.',
    image: '🏎️',
    tips: [
      'Dynamic pricing optimization',
      'Maintenance tracking',
      'Photo galleries',
    ],
  },
  {
    id: 'rari',
    icon: Sparkles,
    title: 'Meet Rari, Your AI Assistant',
    description: 'Ask Rari anything about your fleet. Get instant insights, pricing recommendations, and answers to complex questions—just like talking to an expert.',
    image: '✨',
    tips: [
      'Voice or text commands',
      'Real-time data analysis',
      'Proactive recommendations',
    ],
  },
];

export const QuickOnboarding = ({ open, onComplete }: QuickOnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onComplete()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <ExotiqLogoBranded variant="gulf-blue" size="sm" />
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip Tour
            </Button>
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        {/* Content */}
        <div className="p-8 md:p-12">
          <div className="flex flex-col items-center text-center mb-8">
            {/* Icon */}
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gulf-blue/20 to-performance-orange/20 flex items-center justify-center">
                <Icon className="h-10 w-10 text-gulf-blue" />
              </div>
              <div className="absolute -top-2 -right-2 text-4xl">
                {step.image}
              </div>
            </div>

            {/* Title */}
            <h2 className="font-dfaalt text-3xl md:text-4xl font-bold mb-3">
              {step.title}
            </h2>

            {/* Description */}
            <p className="font-montserrat text-muted-foreground text-lg max-w-xl">
              {step.description}
            </p>
          </div>

          {/* Tips */}
          <div className="grid gap-3 max-w-md mx-auto mb-8">
            {step.tips.map((tip, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg bg-muted/50",
                  "animate-fade-in"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gulf-blue/20 flex items-center justify-center">
                  <Check className="h-4 w-4 text-gulf-blue" />
                </div>
                <span className="font-montserrat text-sm">{tip}</span>
              </div>
            ))}
          </div>

          <RacingStripe variant="gulf" width="thin" className="mb-8" />

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex gap-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentStep
                      ? "bg-gulf-blue w-6"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>

            <Button
              onClick={handleNext}
              className="gap-2"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  Get Started
                  <Sparkles className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
