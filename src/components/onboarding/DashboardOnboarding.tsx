import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  ChevronUp,
  GripHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TooltipStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  targetSelector?: string;
  cardPosition: 'center' | 'right' | 'left';
}

interface UserProfile {
  full_name: string | null;
  company_name: string | null;
  fleet_size: string | null;
  business_type: string | null;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Personalized step generator based on profile
const getPersonalizedSteps = (profile: UserProfile | null): TooltipStep[] => {
  const name = profile?.full_name?.split(' ')[0] || 'there';
  const companyName = profile?.company_name || 'your business';
  const fleetSize = profile?.fleet_size || '';
  const businessType = profile?.business_type || '';
  
  const pulseDescription = fleetSize?.includes('50') || fleetSize?.includes('21')
    ? `With ${fleetSize} vehicles, Pulse is your command center for real-time analytics.`
    : 'Monitor fleet performance with live analytics and key metrics.';

  const motorIQDescription = businessType === 'exotic' || businessType === 'luxury'
    ? 'AI-powered dynamic pricing built for premium vehicles.'
    : 'AI-powered pricing to maximize your revenue.';

  return [
    {
      id: 'welcome',
      title: `Welcome, ${name}!`,
      description: `Let's take a quick 60-second tour of your command center for ${companyName}.`,
      icon: Sparkles,
      cardPosition: 'center',
    },
    {
      id: 'motoriq',
      title: 'MotorIQ',
      description: motorIQDescription,
      icon: TrendingUp,
      targetSelector: '[data-tour="nav-motoriq"]',
      cardPosition: 'right',
    },
    {
      id: 'book',
      title: 'Bookings',
      description: 'Manage reservations, calendar, and upcoming pickups.',
      icon: Calendar,
      targetSelector: '[data-tour="nav-book"]',
      cardPosition: 'right',
    },
    {
      id: 'pulse',
      title: 'Pulse',
      description: pulseDescription,
      icon: BarChart3,
      targetSelector: '[data-tour="nav-pulse"]',
      cardPosition: 'right',
    },
    {
      id: 'vault',
      title: 'Vault',
      description: 'Document management and compliance tracking.',
      icon: Shield,
      targetSelector: '[data-tour="nav-vault"]',
      cardPosition: 'right',
    },
    {
      id: 'rari',
      title: 'Meet Rari',
      description: 'Your AI assistant. Ask anything about your fleet!',
      icon: Brain,
      targetSelector: '[data-tour="rari-button"]',
      cardPosition: 'left',
    },
    {
      id: 'complete',
      title: "You're Ready!",
      description: 'Explore and optimize. Rari is always here to help.',
      icon: Sparkles,
      cardPosition: 'center',
    },
  ];
};

interface ProfileWithTour extends UserProfile {
  tour_completed: boolean | null;
}

export const DashboardOnboarding = () => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [profile, setProfile] = useState<ProfileWithTour | null>(null);
  const [tourCompleted, setTourCompleted] = useState<boolean | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobileSheetExpanded, setIsMobileSheetExpanded] = useState(true);
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, company_name, fleet_size, business_type, tour_completed')
        .eq('id', user.id)
        .single();
      if (data) {
        setProfile(data);
        setTourCompleted(data.tour_completed ?? false);
      } else {
        setTourCompleted(false);
      }
    };
    fetchProfile();
  }, [user?.id]);

  const onboardingSteps = useMemo(() => getPersonalizedSteps(profile), [profile]);

  useEffect(() => {
    if (tourCompleted === false) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tourCompleted]);

  // Update spotlight position when step changes
  useEffect(() => {
    if (!isVisible) return;
    
    const currentStepData = onboardingSteps[currentStep];
    if (!currentStepData?.targetSelector) {
      setSpotlightRect(null);
      return;
    }

    const updateSpotlight = () => {
      const element = document.querySelector(currentStepData.targetSelector!);
      if (!element) {
        setSpotlightRect(null);
        return;
      }
      
      const rect = element.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    // Small delay to let the transition start
    const timer = setTimeout(updateSpotlight, 50);
    
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [currentStep, isVisible, onboardingSteps]);

  const currentStepData = onboardingSteps[currentStep];
  const Icon = currentStepData?.icon || Sparkles;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === onboardingSteps.length - 1;
  const isCenterStep = currentStepData?.cardPosition === 'center';
  const hasSpotlight = !!spotlightRect && !isCenterStep;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTransitioning(false);
      }, 150);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsTransitioning(false);
      }, 150);
    }
  };

  const markTourCompleted = async () => {
    try {
      if (!user?.id) return;
      await supabase
        .from('profiles')
        .update({ tour_completed: true })
        .eq('id', user.id);
    } catch {
      // Silent fail - tour will reappear on next login
    }
  };

  const handleSkip = () => {
    setTourCompleted(true);
    setIsVisible(false);
    void markTourCompleted();
  };

  const handleComplete = () => {
    setTourCompleted(true);
    setIsVisible(false);
    void markTourCompleted();

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }

    // Confetti celebration
    const duration = 2500;
    const animationEnd = Date.now() + duration;
    const colors = ['#0B3D91', '#FF6B35', '#FFD700'];

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      if (Date.now() > animationEnd) {
        clearInterval(interval);
        return;
      }
      confetti({
        particleCount: 4,
        angle: randomInRange(55, 125),
        spread: randomInRange(50, 70),
        origin: { y: 0.6 },
        colors,
      });
    }, 40);

    toast({
      title: "Welcome to Exotiq!",
      description: "You're all set. Let's build something amazing!",
      duration: 4000,
    });
  };

  // Generate SVG clip path for spotlight cutout
  const generateClipPath = () => {
    if (!spotlightRect) return '';
    
    const padding = 8;
    const radius = 12;
    const x = spotlightRect.left - padding;
    const y = spotlightRect.top - padding;
    const w = spotlightRect.width + padding * 2;
    const h = spotlightRect.height + padding * 2;
    
    // Full screen rect with rounded cutout
    let path = `M0,0 L${window.innerWidth},0 L${window.innerWidth},${window.innerHeight} L0,${window.innerHeight} Z `;
    path += `M${x + radius},${y} `;
    path += `L${x + w - radius},${y} `;
    path += `Q${x + w},${y} ${x + w},${y + radius} `;
    path += `L${x + w},${y + h - radius} `;
    path += `Q${x + w},${y + h} ${x + w - radius},${y + h} `;
    path += `L${x + radius},${y + h} `;
    path += `Q${x},${y + h} ${x},${y + h - radius} `;
    path += `L${x},${y + radius} `;
    path += `Q${x},${y} ${x + radius},${y} Z `;
    
    return path;
  };

  if (tourCompleted === null) return null;
  if (tourCompleted || !isVisible) return null;

  return (
    <AnimatePresence mode="wait">
      <div ref={containerRef} className="fixed inset-0 z-[100]">
        {/* Backdrop with spotlight cutout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0"
        >
          {hasSpotlight ? (
            <svg className="absolute inset-0 w-full h-full">
              <motion.path
                d={generateClipPath()}
                fill="rgba(0, 0, 0, 0.75)"
                fillRule="evenodd"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            </svg>
          ) : (
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
              onClick={handleSkip}
            />
          )}
        </motion.div>

        {/* Spotlight ring around target element */}
        {hasSpotlight && spotlightRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="absolute pointer-events-none"
            style={{
              top: spotlightRect.top - 6,
              left: spotlightRect.left - 6,
              width: spotlightRect.width + 12,
              height: spotlightRect.height + 12,
            }}
          >
            <div className="absolute inset-0 rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-transparent animate-pulse" />
            <div className="absolute inset-0 rounded-xl bg-primary/10" />
          </motion.div>
        )}

        {/* Desktop Card - Glass Morphism */}
        <motion.div
          key={`desktop-${currentStep}`}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ 
            opacity: isTransitioning ? 0.3 : 1, 
            y: 0, 
            scale: 1 
          }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ 
            duration: 0.35, 
            ease: [0.4, 0, 0.2, 1] 
          }}
          className={cn(
            'hidden md:block absolute pointer-events-auto',
            // Center position
            isCenterStep && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            // Right position (for sidebar items)
            currentStepData?.cardPosition === 'right' && 'top-1/2 -translate-y-1/2 right-8 lg:right-16',
            // Left position (for Rari button)
            currentStepData?.cardPosition === 'left' && 'bottom-24 left-8 lg:left-16'
          )}
        >
          {/* Glass Card */}
          <div className={cn(
            'relative w-[380px] p-6 rounded-2xl',
            // Glass morphism effect
            'bg-white/10 dark:bg-black/20',
            'backdrop-blur-xl',
            'border border-white/20 dark:border-white/10',
            'shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]'
          )}>
            {/* Close button */}
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4 text-white/80" />
            </button>

            {/* Icon with glow */}
            <div className="relative mb-4">
              <div className="absolute inset-0 w-14 h-14 bg-primary/30 blur-xl rounded-full" />
              <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent">
                <Icon className="h-7 w-7 text-white" />
              </div>
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-white mb-2 pr-8">
              {currentStepData?.title}
            </h3>
            <p className="text-sm text-white/70 leading-relaxed mb-6">
              {currentStepData?.description}
            </p>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {onboardingSteps.map((_, index) => (
                <motion.div
                  key={index}
                  animate={{
                    width: index === currentStep ? 24 : 8,
                    backgroundColor: index === currentStep ? 'rgb(var(--primary))' : 'rgba(255,255,255,0.3)'
                  }}
                  className="h-2 rounded-full"
                  transition={{ duration: 0.2 }}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                {!isFirstStep && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevious}
                    className="text-white/70 hover:text-white hover:bg-white/10"
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
                  className="text-white/50 hover:text-white/80 hover:bg-white/10"
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="bg-white text-black hover:bg-white/90 font-medium"
                >
                  {isLastStep ? "Let's Go" : 'Next'}
                  {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Mobile Bottom Sheet */}
        <motion.div
          key={`mobile-${currentStep}`}
          initial={{ y: '100%' }}
          animate={{ y: isMobileSheetExpanded ? 0 : 'calc(100% - 80px)' }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className={cn(
            'md:hidden fixed bottom-0 left-0 right-0 pointer-events-auto',
            'bg-background/95 backdrop-blur-xl',
            'border-t border-border',
            'rounded-t-3xl shadow-2xl',
            'max-h-[70vh]'
          )}
        >
          {/* Drag handle */}
          <button 
            onClick={() => setIsMobileSheetExpanded(!isMobileSheetExpanded)}
            className="w-full flex justify-center py-3"
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
                {/* Icon */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">{currentStepData?.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Step {currentStep + 1} of {onboardingSteps.length}
                    </p>
                  </div>
                  <button
                    onClick={handleSkip}
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {currentStepData?.description}
                </p>

                {/* Progress bar */}
                <div className="h-1 bg-muted rounded-full mb-6 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-3">
                  {!isFirstStep && (
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      className="flex-1"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  )}
                  <Button
                    onClick={handleNext}
                    className={cn(
                      "btn-premium",
                      isFirstStep ? "w-full" : "flex-1"
                    )}
                  >
                    {isLastStep ? "Get Started" : 'Next'}
                    {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                  </Button>
                </div>

                {/* Skip link */}
                <button
                  onClick={handleSkip}
                  className="w-full text-center text-sm text-muted-foreground mt-4 py-2"
                >
                  Skip tour
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
