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
  Clock,
  Shield
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

// Generate tour steps based on user profile - 6-step tour with module menus
const generateTourSteps = (profile: UserProfile | null): TourStep[] => {
  const name = profile?.full_name?.split(' ')[0] || 'there';

  return [
    {
      id: 'welcome',
      module: 'dashboard',
      title: `Welcome, ${name}! 🎉`,
      description: `Your AI-powered command center is ready. Let's explore the essentials in about 2 minutes.`,
      icon: Sparkles,
      spotlights: [],
    },
    {
      id: 'rari-assistant',
      module: 'dashboard',
      title: 'Say Hello to Rari 👋',
      description: `Meet your new favorite team member! Rari handles the tough questions so you can focus on growing your business.`,
      icon: Brain,
      spotlights: [
        {
          selector: '[data-tour="rari-fab"]',
          tooltip: 'Your AI assistant is always here',
          position: 'left' as const,
          pulse: true,
        },
      ],
      microInteraction: {
        type: 'click' as const,
        target: '[data-tour="rari-fab"]',
        prompt: 'Try: "Hey Rari, what\'s on my schedule today?"',
      },
    },
    {
      id: 'pulse-overview',
      module: 'pulse',
      title: 'Pulse - Your Fleet at a Glance',
      description: 'Monitor pickups, returns, and revenue in real-time. Switch between views to dive deeper.',
      icon: BarChart3,
      spotlights: [
        {
          selector: '[data-tour="fleet-snapshot"]',
          tooltip: 'Key metrics at a glance',
          position: 'bottom' as const,
          pulse: true,
        },
      ],
    },
    {
      id: 'book-overview',
      module: 'book',
      title: 'Book - Reservations Made Easy',
      description: 'Manage all your bookings from one place. Check out the Calendar, CRM, Payments, and Inspections tabs.',
      icon: Calendar,
      spotlights: [
        {
          selector: '[data-tour="next-pickup"]',
          tooltip: 'Never miss a pickup',
          position: 'right' as const,
          pulse: true,
        },
        {
          selector: '[data-tour="book-tabs"]',
          tooltip: 'Overview • Calendar • CRM • Payments • Inspections',
          position: 'bottom' as const,
        },
      ],
    },
    {
      id: 'vault-overview',
      module: 'vault',
      title: 'Vault - Secure Your Operations',
      description: 'Stay compliant with ease. Documents, Payments, Verification, and Claims — everything to protect your business.',
      icon: Shield,
      spotlights: [
        {
          selector: '[data-tour="compliance-overview"]',
          tooltip: 'Compliance score at a glance',
          position: 'bottom' as const,
          pulse: true,
        },
        {
          selector: '[data-tour="vault-tabs"]',
          tooltip: 'Documents • Payments • Verification • Claims',
          position: 'bottom' as const,
        },
      ],
    },
    {
      id: 'complete',
      module: 'dashboard',
      title: "You're Ready to Roll! 🚀",
      description: 'Explore at your own pace. Remember, Rari is just a click away whenever you need help.',
      icon: Trophy,
      spotlights: [],
    },
  ];
};

// Get smart card position based on current step to avoid overlapping spotlights
const getCardPosition = (stepId: string, isCenterStep: boolean): string => {
  if (isCenterStep) {
    return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
  }

  switch (stepId) {
    case 'rari-assistant':
      // Rari FAB is bottom-right, so card goes top-left
      return 'top-8 left-4 right-4 md:left-8 md:right-auto';
    case 'pulse-overview':
      // Fleet snapshot is top area, card goes bottom
      return 'bottom-28 left-4 right-4 md:bottom-8 md:left-8 md:right-auto';
    case 'book-overview':
      // Next pickup is left side, tabs are top - card goes bottom right
      return 'bottom-28 left-4 right-4 md:bottom-8 md:right-8 md:left-auto';
    case 'vault-overview':
      // Compliance overview center, tabs top - card goes top left
      return 'top-8 left-4 right-4 md:left-8 md:right-auto';
    default:
      return 'bottom-28 left-4 right-4 md:bottom-8 md:left-8 md:right-auto';
  }
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
    // Don't start until we have valid steps
    if (tourSteps.length === 0) return;
    
    const handleStartTour = () => {
      setShowTour(true);
      // Small delay to ensure component is fully rendered
      setTimeout(() => {
        tour.startTour();
      }, 100);
    };

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('startTour') === 'true') {
      // Clean up URL
      params.delete('startTour');
      params.delete('t'); // Remove timestamp param too
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, '', newUrl);
      handleStartTour();
      return; // Exit early, don't add event listener
    }

    // Check localStorage trigger
    if (localStorage.getItem('trigger-tour') === 'true') {
      localStorage.removeItem('trigger-tour');
      handleStartTour();
      return;
    }

    window.addEventListener('start-tour', handleStartTour);
    return () => window.removeEventListener('start-tour', handleStartTour);
  }, [tourSteps.length]);

  // Auto-show for first-time users who haven't completed onboarding
  useEffect(() => {
    if (!user?.id || tourSteps.length === 0) return;
    
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
  }, [user?.id, showTour, tourSteps.length]);

  if (!tour.isActive || !showTour || !tour.currentStep) return null;

  const Icon = tour.currentStep.icon;
  const isCenterStep = tour.currentStep.spotlights.length === 0;
  const hasSpotlights = tour.currentStep.spotlights.length > 0;
  const cardPosition = getCardPosition(tour.currentStep.id, isCenterStep);

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

        {/* Main tour card - white in light mode, positioned to avoid spotlight overlap */}
        <motion.div
          key={tour.currentStep.id}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            'absolute pointer-events-auto z-[110]',
            cardPosition
          )}
        >
          <Card className="w-full max-w-[420px] mx-auto p-6 shadow-2xl border-2 border-primary/20 bg-white dark:bg-card backdrop-blur-lg">
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
            <h3 className="text-xl font-bold mb-3 pr-8 text-foreground">{tour.currentStep.title}</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">{tour.currentStep.description}</p>

            {/* Micro-interaction prompt */}
            {tour.currentStep.microInteraction && (
              <div className="mb-5 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm">
                <span className="font-semibold text-primary">💡 Try it:</span>{' '}
                <span className="text-foreground">{tour.currentStep.microInteraction.prompt}</span>
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
