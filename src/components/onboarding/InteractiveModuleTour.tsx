import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TourSpotlight } from './TourSpotlight';
import { TourTooltip } from './TourTooltip';
import { useTourNavigation, TourStep, SpotlightTarget } from '@/hooks/useTourNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { 
  X, 
  Calendar, 
  BarChart3, 
  Brain, 
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Clock
} from 'lucide-react';

interface UserProfile {
  full_name: string | null;
  company_name: string | null;
  fleet_size: string | null;
  business_type: string | null;
}

interface InteractiveModuleTourProps {
  onModuleChange: (moduleId: string) => void;
}

// Generate tour steps based on user profile - streamlined 5-step tour
const generateTourSteps = (profile: UserProfile | null): TourStep[] => {
  const name = profile?.full_name?.split(' ')[0] || 'there';
  const companyName = profile?.company_name || 'your business';

  return [
    {
      id: 'welcome',
      module: 'dashboard',
      title: `Welcome, ${name}! 🎉`,
      description: `Your AI-powered command center is ready. Let's explore the key features in about 2 minutes.`,
      icon: Sparkles,
      spotlights: [],
    },
    {
      id: 'rari-assistant',
      module: 'dashboard',
      title: 'Meet Rari - Your AI Copilot',
      description: `Ask anything about your fleet. Try saying: "Hey Rari, tell me about my upcoming bookings"`,
      icon: Brain,
      spotlights: [
        {
          selector: '[data-tour="rari-fab"]',
          tooltip: 'Click anytime to chat with Rari',
          position: 'left' as const,
          pulse: true,
        },
      ],
      microInteraction: {
        type: 'click' as const,
        target: '[data-tour="rari-fab"]',
        prompt: 'Try clicking to open Rari!',
      },
    },
    {
      id: 'pulse-analytics',
      module: 'pulse',
      title: 'Pulse - Fleet Performance',
      description: 'Monitor utilization, revenue trends, and real-time fleet status at a glance.',
      icon: BarChart3,
      spotlights: [
        {
          selector: '[data-tour="fleet-snapshot"]',
          tooltip: 'Track your fleet health instantly',
          position: 'bottom' as const,
          pulse: true,
        },
      ],
    },
    {
      id: 'book-calendar',
      module: 'book',
      title: 'Book - Reservations Hub',
      description: 'Manage bookings, view your calendar, and handle pickups/returns seamlessly.',
      icon: Calendar,
      spotlights: [
        {
          selector: '[data-tour="next-pickup"]',
          tooltip: 'Your upcoming pickups at a glance',
          position: 'right' as const,
          pulse: true,
        },
      ],
    },
    {
      id: 'complete',
      module: 'dashboard',
      title: "You're All Set! 🚀",
      description: 'Explore your dashboard. Need help anytime? Just click Rari.',
      icon: Trophy,
      spotlights: [],
    },
  ];
};

export const InteractiveModuleTour = ({ onModuleChange }: InteractiveModuleTourProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showTour, setShowTour] = useState(false);

  // Fetch user profile for personalization
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, company_name, fleet_size, business_type')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);
    };
    fetchProfile();
  }, [user?.id]);

  // Generate personalized steps
  const tourSteps = useMemo(() => generateTourSteps(profile), [profile]);

  const tour = useTourNavigation({
    steps: tourSteps,
    onModuleChange,
    onComplete: () => {
      // Fire confetti celebration
      const colors = ['#0B3D91', '#FF6B35', '#FFD700'];
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors,
      });

      toast({
        title: "Tour Complete! 🎉",
        description: "You're all set to manage your fleet like a pro.",
        duration: 4000,
      });
    },
  });

  // Listen for tour start events
  useEffect(() => {
    const handleStartTour = () => {
      setShowTour(true);
      tour.startTour();
    };

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('startTour') === 'true') {
      // Clean up URL
      params.delete('startTour');
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, '', newUrl);
      handleStartTour();
    }

    // Check localStorage trigger
    if (localStorage.getItem('trigger-tour') === 'true') {
      localStorage.removeItem('trigger-tour');
      handleStartTour();
    }

    window.addEventListener('start-tour', handleStartTour);
    return () => window.removeEventListener('start-tour', handleStartTour);
  }, []);

  // Auto-show for first-time users who haven't completed onboarding
  useEffect(() => {
    if (!user?.id) return;
    
    const legacyKey = `dashboard-onboarding-complete-${user.id}`;
    const newKey = `interactive-tour-complete-${user.id}`;
    
    const legacyComplete = localStorage.getItem(legacyKey) === 'true';
    const newComplete = localStorage.getItem(newKey) === 'true';
    
    // If legacy tour is done but new tour isn't, don't auto-show
    // Let them discover it via Settings or we could migrate
    if (!newComplete && !legacyComplete && !showTour) {
      // Delay to let dashboard load
      const timer = setTimeout(() => {
        setShowTour(true);
        tour.startTour();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, showTour]);

  if (!tour.isActive || !showTour) return null;

  const Icon = tour.currentStep.icon;
  const isCenterStep = tour.currentStep.spotlights.length === 0;
  const hasSpotlights = tour.currentStep.spotlights.length > 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Spotlight overlay for elements - only render if spotlights exist */}
        {hasSpotlights && (
          <TourSpotlight
            targets={tour.currentStep.spotlights}
            isVisible={tour.spotlightsReady && !tour.isTransitioning}
          />
        )}

        {/* Tooltips for each spotlight */}
        {tour.spotlightsReady && tour.currentStep.spotlights.map((spotlight, idx) => (
          <TourTooltip
            key={`tooltip-${tour.currentStep.id}-${idx}`}
            targetSelector={spotlight.selector}
            content={spotlight.tooltip}
            position={spotlight.position}
            isVisible={!tour.isTransitioning}
          />
        ))}

        {/* Backdrop for center steps (no spotlights) */}
        {isCenterStep && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto"
            onClick={tour.skipTour}
          />
        )}

        {/* Main tour card */}
        <motion.div
          key={tour.currentStep.id}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            'absolute pointer-events-auto z-[110]',
            isCenterStep
              ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
              : 'bottom-28 left-4 right-4 md:bottom-auto md:top-8 md:left-8 md:right-auto'
          )}
        >
          <Card className="w-full max-w-[420px] mx-auto p-6 shadow-2xl border-2 border-primary/20 bg-background/98 backdrop-blur-lg">
            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span className="font-medium">Step {tour.currentStepIndex + 1} of {tourSteps.length}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ~{tour.estimatedTimeRemaining} min left
                </span>
              </div>
              <Progress value={tour.progress} className="h-2" />
            </div>

            {/* Close button */}
            <button
              onClick={tour.skipTour}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon */}
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-5 shadow-lg">
              <Icon className="h-8 w-8 text-white" />
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold mb-3 pr-8">{tour.currentStep.title}</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">{tour.currentStep.description}</p>

            {/* Micro-interaction prompt */}
            {tour.currentStep.microInteraction && (
              <div className="mb-5 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm">
                <span className="font-semibold text-primary">💡 Try it:</span>{' '}
                {tour.currentStep.microInteraction.prompt}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                {!tour.isFirstStep && (
                  <Button
                    variant="outline"
                    size="default"
                    onClick={tour.prevStep}
                    className="w-full sm:w-auto"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="default"
                  onClick={tour.skipTour}
                >
                  Skip
                </Button>
                <Button
                  size="default"
                  onClick={tour.nextStep}
                  className="btn-premium min-w-[100px]"
                >
                  {tour.isLastStep ? 'Get Started' : 'Next'}
                  {!tour.isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>

            {/* Keyboard hint - hidden on mobile */}
            <p className="hidden sm:block text-[10px] text-muted-foreground text-center mt-4">
              Use ← → arrows or Escape to skip
            </p>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default InteractiveModuleTour;
