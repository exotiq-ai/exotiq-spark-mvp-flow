import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { 
  X, 
  TrendingUp, 
  Calendar, 
  BarChart3, 
  Shield, 
  Brain, 
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TooltipStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  targetSelector?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const onboardingSteps: TooltipStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ExotIQ! 🎉',
    description: 'Let\'s take a quick tour of your new fleet management command center. This will only take a minute.',
    icon: Sparkles,
    position: 'center',
  },
  {
    id: 'motoriq',
    title: 'MotorIQ - Pricing Optimization',
    description: 'AI-powered dynamic pricing helps you maximize revenue. Get instant recommendations based on demand, seasonality, and market trends.',
    icon: TrendingUp,
    position: 'left',
  },
  {
    id: 'book',
    title: 'Book - Reservations & Calendar',
    description: 'Manage all your bookings in one place. View your calendar, handle reservations, and track upcoming pickups.',
    icon: Calendar,
    position: 'left',
  },
  {
    id: 'pulse',
    title: 'Pulse - Real-time Analytics',
    description: 'Monitor your fleet performance with live analytics. Track revenue, utilization, and key metrics in real-time.',
    icon: BarChart3,
    position: 'left',
  },
  {
    id: 'vault',
    title: 'Vault - Compliance Hub',
    description: 'Stay compliant with document management, insurance tracking, and automated reminders for renewals.',
    icon: Shield,
    position: 'left',
  },
  {
    id: 'rari',
    title: 'Meet Rari - Your AI Assistant',
    description: 'Ask Rari anything! Get instant answers about your fleet, bookings, pricing, and analytics using voice or text.',
    icon: Brain,
    position: 'right',
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🚀',
    description: 'Explore the dashboard and start optimizing your fleet. Need help? Just click the Rari button to ask questions anytime.',
    icon: Sparkles,
    position: 'center',
  },
];

export const DashboardOnboarding = () => {
  const [onboardingComplete, setOnboardingComplete] = useLocalStorage('dashboard-onboarding-complete', false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Show onboarding after a short delay if not completed
    if (!onboardingComplete) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [onboardingComplete]);

  const currentStepData = onboardingSteps[currentStep];
  const Icon = currentStepData.icon;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === onboardingSteps.length - 1;
  const isCenterStep = currentStepData.position === 'center';

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    // Haptic feedback for mobile devices
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]); // Pattern: vibrate, pause, vibrate
    }

    // Fire confetti celebration
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    
    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    // Gulf Blue, Performance Orange, Gold
    const colors = ['#0B3D91', '#FF6B35', '#FFD700'];

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      confetti({
        particleCount: 3,
        angle: randomInRange(55, 125),
        spread: randomInRange(50, 70),
        origin: { y: 0.6 },
        colors,
      });
    }, 50);

    // Show success toast with trophy icon
    toast({
      title: "Welcome to Exotiq! 🚀",
      description: "Let's build something amazing together!",
      duration: 4000,
    });

    // Mark onboarding as complete and hide
    setOnboardingComplete(true);
    setIsVisible(false);
  };

  if (!isVisible || onboardingComplete) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
          onClick={handleSkip}
        />

        {/* Tooltip card */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'absolute pointer-events-auto',
            isCenterStep && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            !isCenterStep && currentStepData.position === 'left' && 'top-32 left-8',
            !isCenterStep && currentStepData.position === 'right' && 'top-32 right-8'
          )}
        >
          <Card className="w-[90vw] sm:w-[400px] p-6 shadow-2xl border-2 border-primary/20">
            {/* Close button */}
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon */}
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent mb-4">
              <Icon className="h-8 w-8 text-white" />
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold mb-2">{currentStepData.title}</h3>
            <p className="text-muted-foreground mb-6">{currentStepData.description}</p>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {onboardingSteps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'h-2 rounded-full transition-all',
                    index === currentStep ? 'w-8 bg-primary' : 'w-2 bg-muted'
                  )}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    className="w-full sm:w-auto"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                >
                  Skip Tour
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="btn-premium"
                >
                  {isLastStep ? 'Get Started' : 'Next'}
                  {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
