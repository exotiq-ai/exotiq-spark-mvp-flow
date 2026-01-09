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
  TrendingUp, 
  Calendar, 
  BarChart3, 
  Shield, 
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

// Generate tour steps based on user profile
const generateTourSteps = (profile: UserProfile | null): TourStep[] => {
  const name = profile?.full_name?.split(' ')[0] || 'there';
  const companyName = profile?.company_name || 'your business';

  return [
    {
      id: 'welcome',
      module: 'dashboard',
      title: `Welcome, ${name}! 🎉`,
      description: `Let's take a quick 2-minute tour of the key features that will help you run ${companyName} like a pro.`,
      icon: Sparkles,
      spotlights: [],
      duration: 5000,
    },
    {
      id: 'motoriq-pricing',
      module: 'motoriq',
      title: 'MotorIQ - AI-Powered Pricing',
      description: 'Get instant pricing recommendations based on demand, events, and market trends.',
      icon: TrendingUp,
      spotlights: [
        {
          selector: '[data-tour="pricing-card"]',
          tooltip: 'AI analyzes 50+ factors to suggest optimal rates',
          position: 'right' as const,
          pulse: true,
        },
      ],
    },
    {
      id: 'book-calendar',
      module: 'book',
      title: 'Book - Your Reservation Hub',
      description: 'Manage all bookings, view your calendar, and handle pickups/returns.',
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
      id: 'pulse-analytics',
      module: 'pulse',
      title: 'Pulse - Real-Time Analytics',
      description: 'Monitor fleet performance with live dashboards and trend analysis.',
      icon: BarChart3,
      spotlights: [
        {
          selector: '[data-tour="fleet-snapshot"]',
          tooltip: 'Track utilization and status at a glance',
          position: 'bottom' as const,
          pulse: true,
        },
      ],
    },
    {
      id: 'vault-compliance',
      module: 'vault',
      title: 'Vault - Compliance & Documents',
      description: 'Never miss a renewal. Track insurance, registrations, and inspections.',
      icon: Shield,
      spotlights: [
        {
          selector: '[data-tour="compliance-overview"]',
          tooltip: 'See your compliance score and expiring documents',
          position: 'bottom' as const,
          pulse: true,
        },
      ],
    },
    {
      id: 'rari-assistant',
      module: 'dashboard',
      title: 'Meet Rari - Your AI Assistant',
      description: 'Ask anything about your fleet using voice or text. Rari knows your data.',
      icon: Brain,
      spotlights: [
        {
          selector: '[data-tour="rari-fab"]',
          tooltip: 'Click anytime to ask Rari a question',
          position: 'left' as const,
          pulse: true,
        },
      ],
    },
    {
      id: 'complete',
      module: 'dashboard',
      title: "You're Ready to Roll! 🚀",
      description: 'Explore your dashboard. Need help? Just ask Rari anytime.',
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100]">
        {/* Spotlight overlay for elements */}
        <TourSpotlight
          targets={tour.currentStep.spotlights}
          isVisible={tour.spotlightsReady && !tour.isTransitioning}
        />

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
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={tour.skipTour}
          />
        )}

        {/* Main tour card */}
        <motion.div
          key={tour.currentStep.id}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'absolute',
            isCenterStep
              ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
              : 'bottom-8 left-1/2 -translate-x-1/2 md:bottom-auto md:top-8 md:left-8 md:translate-x-0'
          )}
        >
          <Card className="w-[calc(100vw-2rem)] max-w-[420px] p-5 shadow-2xl border-2 border-primary/20 bg-background/95 backdrop-blur-md">
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Step {tour.currentStepIndex + 1} of {tourSteps.length}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ~{tour.estimatedTimeRemaining} min left
                </span>
              </div>
              <Progress value={tour.progress} className="h-1.5" />
            </div>

            {/* Close button */}
            <button
              onClick={tour.skipTour}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon */}
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
              <Icon className="h-7 w-7 text-white" />
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold mb-2 pr-8">{tour.currentStep.title}</h3>
            <p className="text-muted-foreground mb-6">{tour.currentStep.description}</p>

            {/* Micro-interaction prompt */}
            {tour.currentStep.microInteraction && (
              <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                <span className="font-medium text-primary">💡 Try it:</span>{' '}
                {tour.currentStep.microInteraction.prompt}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                {!tour.isFirstStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={tour.prevStep}
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
                  onClick={tour.skipTour}
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  onClick={tour.nextStep}
                  className="btn-premium"
                >
                  {tour.isLastStep ? 'Get Started' : 'Next'}
                  {!tour.isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>

            {/* Keyboard hint */}
            <p className="text-[10px] text-muted-foreground text-center mt-4">
              Use ← → arrows or Escape to skip
            </p>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default InteractiveModuleTour;
