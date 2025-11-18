import { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface OnboardingStep {
  title: string;
  description: string;
  target: string; // CSS selector for spotlight
  position: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "Meet Rari, Your AI Assistant",
    description: "Click here anytime to talk with Rari about your fleet, bookings, revenue, or any questions. Just speak naturally!",
    target: '[data-tour="rari-button"]',
    position: 'left'
  },
  {
    title: "AI-Powered Pricing",
    description: "MotorIQ analyzes market demand, seasonality, and your utilization to recommend optimal daily rates for each vehicle.",
    target: '[data-tour="motoriq-module"]',
    position: 'top'
  },
  {
    title: "Real-Time Revenue Insights",
    description: "Track your revenue, bookings, and fleet performance in real-time. All your key metrics at a glance.",
    target: '[data-tour="revenue-widget"]',
    position: 'bottom'
  },
  {
    title: "Smart Customer Management",
    description: "View customer history, lifetime value, and AI-generated insights to personalize every interaction.",
    target: '[data-tour="crm-module"]',
    position: 'top'
  }
];

export const DemoOnboarding = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('demo_onboarding_completed');
    if (!hasSeenOnboarding) {
      // Delay to let page render
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      const selector = ONBOARDING_STEPS[currentStep].target;
      const element = document.querySelector(selector) as HTMLElement;
      setTargetElement(element);

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStep, isVisible]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('demo_onboarding_completed', 'true');
    setIsVisible(false);
  };

  const handleSkip = () => {
    localStorage.setItem('demo_onboarding_completed', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const targetRect = targetElement?.getBoundingClientRect();

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/60 z-[9998] animate-fade-in"
        onClick={handleSkip}
      />

      {/* Spotlight effect */}
      {targetRect && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            borderRadius: '12px',
            transition: 'all 0.3s ease-in-out'
          }}
        />
      )}

      {/* Tooltip Card */}
      {targetRect && (
        <Card 
          className="fixed z-[10000] p-6 max-w-md animate-scale-in shadow-elegant"
          style={{
            top: step.position === 'bottom' ? targetRect.bottom + 16 : 
                 step.position === 'top' ? targetRect.top - 200 :
                 targetRect.top,
            left: step.position === 'right' ? targetRect.right + 16 :
                  step.position === 'left' ? targetRect.left - 400 :
                  targetRect.left,
          }}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="ml-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between mt-6">
            <div className="flex gap-1.5">
              {ONBOARDING_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    index === currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="btn-premium"
              >
                {currentStep === ONBOARDING_STEPS.length - 1 ? "Get Started" : "Next"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
};