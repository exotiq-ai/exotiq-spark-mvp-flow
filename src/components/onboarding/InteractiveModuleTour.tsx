import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TourSpotlight } from './TourSpotlight';
import { useTourNavigation, TourStep } from '@/hooks/useTourNavigation';
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
  Shield,
  GripHorizontal,
  ChevronUp
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

// Generate tour steps - 6 steps with shortened copy
const generateTourSteps = (profile: UserProfile | null): TourStep[] => {
  const name = profile?.full_name?.split(' ')[0] || 'there';

  return [
    {
      id: 'welcome',
      module: 'dashboard',
      title: `Welcome, ${name}!`,
      description: 'Your command center is ready. Quick 90-second tour.',
      icon: Sparkles,
      spotlights: [],
    },
    {
      id: 'rari-assistant',
      module: 'dashboard',
      title: 'Meet Rari',
      description: 'Your AI assistant. Ask anything about your fleet.',
      icon: Brain,
      spotlights: [
        {
          selector: '[data-tour="rari-fab"]',
          tooltip: 'Your AI assistant is always here',
          position: 'left' as const,
          pulse: true,
        },
      ],
    },
    {
      id: 'pulse-overview',
      module: 'pulse',
      title: 'Pulse',
      description: 'Real-time analytics and fleet performance.',
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
      title: 'Book',
      description: 'Reservations, calendar, CRM, and payments.',
      icon: Calendar,
      spotlights: [
        {
          selector: '[data-tour="next-pickup"]',
          tooltip: 'Never miss a pickup',
          position: 'right' as const,
          pulse: true,
        },
      ],
    },
    {
      id: 'vault-overview',
      module: 'vault',
      title: 'Vault',
      description: 'Documents and compliance tracking.',
      icon: Shield,
      spotlights: [
        {
          selector: '[data-tour="compliance-overview"]',
          tooltip: 'Compliance score at a glance',
          position: 'bottom' as const,
          pulse: true,
        },
      ],
    },
    {
      id: 'complete',
      module: 'dashboard',
      title: "You're Ready!",
      description: 'Explore freely. Rari is always here to help.',
      icon: Trophy,
      spotlights: [],
    },
  ];
};

// Get smart card position + entrance direction based on spotlight location
const getCardPosition = (stepId: string, isCenterStep: boolean): { position: string; entrance: { x: number; y: number } } => {
  if (isCenterStep) {
    return { 
      position: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      entrance: { x: 0, y: 40 },
    };
  }

  switch (stepId) {
    case 'rari-assistant':
      return { position: 'top-24 left-24', entrance: { x: -60, y: 0 } };
    case 'pulse-overview':
      return { position: 'bottom-24 right-8', entrance: { x: 60, y: 0 } };
    case 'book-overview':
      return { position: 'top-24 right-8', entrance: { x: 60, y: -30 } };
    case 'vault-overview':
      return { position: 'top-24 left-24', entrance: { x: -60, y: 0 } };
    default:
      return { position: 'bottom-24 right-8', entrance: { x: 40, y: 20 } };
  }
};

export const InteractiveModuleTour = ({ onModuleChange }: InteractiveModuleTourProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [isMobileSheetExpanded, setIsMobileSheetExpanded] = useState(true);

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

  // Listen for tour start events (from Settings "Restart Tour" or URL params)
  useEffect(() => {
    if (tourSteps.length === 0) return;
    
    const handleStartTour = () => {
      setShowTour(true);
      setTimeout(() => {
        tour.startTour();
      }, 100);
    };

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('startTour') === 'true') {
      params.delete('startTour');
      params.delete('t');
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, '', newUrl);
      handleStartTour();
      return;
    }

    // Check custom event trigger
    window.addEventListener('start-tour', handleStartTour);
    return () => window.removeEventListener('start-tour', handleStartTour);
  }, [tourSteps.length]);

  // Auto-show for first-time users - ONLY if tour_completed is false in database
  useEffect(() => {
    if (!user?.id || tourSteps.length === 0) return;
    
    // Wait for database status to load
    if (tour.tourComplete === null) return;
    
    // Only auto-show if NOT completed and tour isn't already showing
    if (tour.tourComplete === false && !showTour) {
      const timer = setTimeout(() => {
        setShowTour(true);
        tour.startTour();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, showTour, tourSteps.length, tour.tourComplete]);

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

        {/* Desktop Glass Card - hidden on mobile */}
        <motion.div
          key={tour.currentStep.id}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ 
            opacity: tour.isTransitioning ? 0.3 : 1, 
            scale: tour.isTransitioning ? 0.98 : 1, 
            y: 0 
          }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            'hidden md:block absolute pointer-events-auto z-[110]',
            cardPosition
          )}
        >
          {/* Theme-aware glass morphism card - compact design */}
          <div 
            className={cn(
              'relative w-[320px] p-5 rounded-2xl',
              // Theme-aware glass morphism
              'bg-white/95 dark:bg-slate-900/90',
              'backdrop-blur-xl',
              'border border-border/50 dark:border-white/10',
              // Shadows - subtle in light, deeper in dark
              'shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
            )}
          >
            {/* Progress bar with step indicator */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Step {tour.currentStepIndex + 1} of {tourSteps.length}</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${tour.progress}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={tour.skipTour}
              className="absolute top-3 right-3 p-2 rounded-full bg-muted hover:bg-muted-foreground/20 transition-colors"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4 text-foreground" />
            </button>

            {/* Icon - cleaner, smaller */}
            <div className="relative mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
                <Icon className="h-6 w-6 text-white" />
              </div>
            </div>

            {/* Content */}
            <h3 className="text-lg font-bold mb-2 pr-8 text-foreground">{tour.currentStep.title}</h3>
            <p className="text-muted-foreground text-sm mb-5 leading-relaxed">{tour.currentStep.description}</p>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                {!tour.isFirstStep && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={tour.prevStep}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted"
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
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  onClick={tour.nextStep}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium min-w-[90px]"
                >
                  {tour.isLastStep ? 'Done' : 'Next'}
                  {!tour.isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>

            {/* Keyboard hint */}
            <p className="text-[10px] text-muted-foreground/60 text-center mt-3">
              Use ← → arrows or Escape to skip
            </p>
          </div>
        </motion.div>

        {/* Mobile Bottom Sheet - visible only on screens < md */}
        <motion.div
          key={`mobile-${tour.currentStep.id}`}
          initial={{ y: '100%' }}
          animate={{ y: isMobileSheetExpanded ? 0 : 'calc(100% - 72px)' }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'md:hidden fixed bottom-0 inset-x-0 z-[110] pointer-events-auto',
            'bg-background/95 backdrop-blur-xl',
            'border-t border-border',
            'rounded-t-3xl',
            'shadow-[0_-8px_32px_rgba(0,0,0,0.2)]'
          )}
        >
          {/* Drag handle */}
          <button 
            onClick={() => setIsMobileSheetExpanded(!isMobileSheetExpanded)}
            className="w-full flex justify-center py-3 min-h-[48px]"
          >
            <div className="flex flex-col items-center gap-1">
              <GripHorizontal className="h-5 w-5 text-muted-foreground" />
              {!isMobileSheetExpanded && (
                <ChevronUp className="h-4 w-4 text-muted-foreground animate-bounce" />
              )}
            </div>
          </button>

          <AnimatePresence mode="wait">
            {isMobileSheetExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-6 pb-8"
              >
                {/* Icon + Title row */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground">{tour.currentStep.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Step {tour.currentStepIndex + 1} of {tourSteps.length}
                    </p>
                  </div>
                  <button
                    onClick={tour.skipTour}
                    className="p-2 rounded-full hover:bg-muted transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {tour.currentStep.description}
                </p>

                {/* Progress bar */}
                <div className="h-1.5 bg-muted rounded-full mb-6 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${tour.progress}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                </div>

                {/* Navigation - 48px touch targets */}
                <div className="flex items-center gap-3">
                  {!tour.isFirstStep && (
                    <Button
                      variant="outline"
                      onClick={tour.prevStep}
                      className="flex-1 min-h-[48px]"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={tour.skipTour}
                    className="min-h-[48px]"
                  >
                    Skip
                  </Button>
                  <Button
                    onClick={tour.nextStep}
                    className={cn(
                      "btn-premium min-h-[48px]",
                      tour.isFirstStep ? "flex-1" : "flex-1"
                    )}
                  >
                    {tour.isLastStep ? 'Get Started' : 'Next'}
                    {!tour.isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default InteractiveModuleTour;
