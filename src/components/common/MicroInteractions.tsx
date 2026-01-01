import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Check, Zap, Trophy, Star } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

/**
 * Celebration Component
 * 
 * Triggers confetti and celebratory animations for key moments.
 * 
 * @example
 * <Celebration 
 *   trigger={bookingCreated} 
 *   message="New booking created! 🎉"
 * />
 */
interface CelebrationProps {
  trigger: boolean;
  message?: string;
  variant?: 'success' | 'milestone' | 'achievement';
  onComplete?: () => void;
}

export const Celebration = ({ 
  trigger, 
  message, 
  variant = 'success',
  onComplete 
}: CelebrationProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger) {
      setShow(true);
      
      // Confetti animation
      const duration = variant === 'milestone' ? 3000 : 1500;
      const animationEnd = Date.now() + duration;
      
      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const colors = variant === 'milestone' 
        ? ['#0B3D91', '#FF6B35', '#FFD700'] // Gulf Blue, Performance Orange, Gold
        : ['#0B3D91', '#FF6B35']; // Gulf Blue, Performance Orange

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          setTimeout(() => {
            setShow(false);
            onComplete?.();
          }, 1000);
          return;
        }

        confetti({
          particleCount: variant === 'milestone' ? 3 : 2,
          angle: randomInRange(55, 125),
          spread: randomInRange(50, 70),
          origin: { y: 0.6 },
          colors,
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [trigger, variant, onComplete]);

  const icons = {
    success: Check,
    milestone: Trophy,
    achievement: Star,
  };

  const Icon = icons[variant];

  return (
    <AnimatePresence>
      {show && message && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.3 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="bg-gradient-to-r from-gulf-blue to-performance-orange p-1 rounded-2xl shadow-2xl">
            <div className="bg-background rounded-xl px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gulf-blue/20 to-performance-orange/20 flex items-center justify-center">
                <Icon className="h-5 w-5 text-gulf-blue" />
              </div>
              <p className="font-dfaalt font-semibold text-lg">{message}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * PulseEffect Component
 * 
 * Adds a subtle pulse animation to draw attention to important elements.
 * 
 * @example
 * <PulseEffect active={hasNewNotification}>
 *   <NotificationBell />
 * </PulseEffect>
 */
interface PulseEffectProps {
  children: React.ReactNode;
  active: boolean;
  color?: 'gulf-blue' | 'performance-orange' | 'success';
  intensity?: 'subtle' | 'medium' | 'strong';
}

export const PulseEffect = ({ 
  children, 
  active, 
  color = 'gulf-blue',
  intensity = 'medium' 
}: PulseEffectProps) => {
  const colorClasses = {
    'gulf-blue': 'shadow-gulf-blue/50',
    'performance-orange': 'shadow-performance-orange/50',
    'success': 'shadow-success/50',
  };

  const intensityClasses = {
    subtle: 'animate-pulse-subtle',
    medium: 'animate-pulse',
    strong: 'animate-pulse-strong',
  };

  return (
    <div className={cn(
      active && intensityClasses[intensity],
      active && colorClasses[color]
    )}>
      {children}
    </div>
  );
};

/**
 * CountUp Component
 * 
 * Animates numbers counting up for revenue, metrics, etc.
 * 
 * @example
 * <CountUp 
 *   value={12500} 
 *   prefix="$" 
 *   duration={2000}
 * />
 */
interface CountUpProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const CountUp = ({ 
  value, 
  duration = 1500, 
  prefix = '', 
  suffix = '',
  decimals = 0,
  className 
}: CountUpProps) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(value * easeOut);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{count.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}{suffix}
    </span>
  );
};

/**
 * ShimmerEffect Component
 * 
 * Adds a subtle shimmer animation to cards and elements.
 * Perfect for highlighting premium features or new content.
 * 
 * @example
 * <Card className="relative overflow-hidden">
 *   <ShimmerEffect />
 *   <CardContent>...</CardContent>
 * </Card>
 */
export const ShimmerEffect = ({ className }: { className?: string }) => {
  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 5,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
};

/**
 * GlowEffect Component
 * 
 * Adds an animated glow effect to buttons and interactive elements.
 * 
 * @example
 * <Button className="relative">
 *   <GlowEffect color="gulf-blue" />
 *   Click me
 * </Button>
 */
interface GlowEffectProps {
  color?: 'gulf-blue' | 'performance-orange' | 'accent';
  intensity?: 'subtle' | 'medium' | 'strong';
  className?: string;
}

export const GlowEffect = ({ 
  color = 'gulf-blue', 
  intensity = 'medium',
  className 
}: GlowEffectProps) => {
  const colorClasses = {
    'gulf-blue': 'from-gulf-blue/0 via-gulf-blue/30 to-gulf-blue/0',
    'performance-orange': 'from-performance-orange/0 via-performance-orange/30 to-performance-orange/0',
    'accent': 'from-accent/0 via-accent/30 to-accent/0',
  };

  const intensityClasses = {
    subtle: 'opacity-30',
    medium: 'opacity-50',
    strong: 'opacity-70',
  };

  return (
    <motion.div
      className={cn(
        "absolute inset-0 pointer-events-none",
        "bg-gradient-to-r",
        colorClasses[color],
        intensityClasses[intensity],
        "blur-xl",
        className
      )}
      animate={{
        opacity: [0.3, 0.6, 0.3],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
};

/**
 * SuccessCheckmark Component
 * 
 * Animated checkmark for successful actions.
 * 
 * @example
 * <SuccessCheckmark show={formSubmitted} />
 */
interface SuccessCheckmarkProps {
  show: boolean;
  size?: 'sm' | 'md' | 'lg';
  onComplete?: () => void;
}

export const SuccessCheckmark = ({ 
  show, 
  size = 'md',
  onComplete 
}: SuccessCheckmarkProps) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.5, times: [0, 0.6, 1] }}
            className={cn(
              "rounded-full bg-gradient-to-br from-success/20 to-success/40 flex items-center justify-center",
              sizeClasses[size]
            )}
          >
            <motion.div
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Check className="h-1/2 w-1/2 text-success" strokeWidth={3} />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * LoadingDots Component
 * 
 * Elegant loading animation for async operations.
 * 
 * @example
 * <LoadingDots />
 */
export const LoadingDots = ({ className }: { className?: string }) => {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-gulf-blue"
          animate={{
            y: [0, -8, 0],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};
