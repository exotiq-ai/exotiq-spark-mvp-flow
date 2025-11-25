/**
 * Apple-Level Animation System
 * Spring physics, timing curves, and reusable variants
 */

// ============================================
// SPRING PRESETS - Apple-like physics
// ============================================

export const springs = {
  // Gentle - Smooth, comfortable motion (200ms feel)
  gentle: {
    type: "spring" as const,
    stiffness: 120,
    damping: 14,
    mass: 1
  },
  
  // Snappy - Quick, responsive feedback (150ms feel)
  snappy: {
    type: "spring" as const,
    stiffness: 400,
    damping: 30,
    mass: 1
  },
  
  // Bouncy - Playful, attention-grabbing (300ms feel)
  bouncy: {
    type: "spring" as const,
    stiffness: 300,
    damping: 10,
    mass: 1
  },

  // Smooth - Balanced default (250ms feel)
  smooth: {
    type: "spring" as const,
    stiffness: 250,
    damping: 25,
    mass: 1
  }
};

// ============================================
// TIMING CURVES - Non-spring transitions
// ============================================

export const curves = {
  easeOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
  easeIn: [0.4, 0, 1, 1] as [number, number, number, number],
  easeInOut: [0.4, 0, 0.6, 1] as [number, number, number, number],
  sharp: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

// ============================================
// ANIMATION VARIANTS - Reusable patterns
// ============================================

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: springs.smooth
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 }
};

export const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 },
  transition: springs.snappy
};

export const slideInRight = {
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -100, opacity: 0 },
  transition: springs.smooth
};

export const slideInLeft = {
  initial: { x: -100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 100, opacity: 0 },
  transition: springs.smooth
};

// ============================================
// STAGGER VARIANTS - Lists and grids
// ============================================

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// ============================================
// INTERACTION VARIANTS - Buttons, cards
// ============================================

export const pressScale = {
  whileTap: { scale: 0.97 },
  transition: springs.snappy
};

export const hoverLift = {
  whileHover: { y: -2, transition: springs.gentle },
  whileTap: { y: 0, scale: 0.98, transition: springs.snappy }
};

export const hoverGlow = {
  whileHover: { 
    boxShadow: "0 0 20px rgba(37, 150, 190, 0.3)",
    transition: { duration: 0.2 }
  }
};

// ============================================
// RARI AI SPECIFIC ANIMATIONS
// ============================================

export const rariBreathingGlow = {
  animate: {
    boxShadow: [
      "0 0 20px rgba(37, 150, 190, 0.3), 0 0 40px rgba(37, 150, 190, 0.1)",
      "0 0 30px rgba(37, 150, 190, 0.5), 0 0 60px rgba(37, 150, 190, 0.2)",
      "0 0 20px rgba(37, 150, 190, 0.3), 0 0 40px rgba(37, 150, 190, 0.1)"
    ]
  },
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "easeInOut"
  }
};

export const rariPulse = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.8, 1, 0.8]
  },
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut"
  }
};

export const aiThinking = {
  animate: {
    rotate: [0, 360]
  },
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "linear"
  }
};

// ============================================
// SUCCESS & ERROR ANIMATIONS
// ============================================

export const successCheckmark = {
  initial: { scale: 0, rotate: -180, opacity: 0 },
  animate: { 
    scale: 1, 
    rotate: 0, 
    opacity: 1,
    transition: springs.bouncy
  }
};

export const errorShake = {
  animate: {
    x: [-10, 10, -8, 8, -5, 5, 0],
  },
  transition: {
    duration: 0.5,
    ease: "easeInOut"
  }
};

export const slideInFromRight = {
  initial: { x: "100%", opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: "100%", opacity: 0 },
  transition: springs.snappy
};

export const slideInFromTop = {
  initial: { y: -100, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -100, opacity: 0 },
  transition: springs.smooth
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Get safe animation variant (respects reduced motion)
 */
export const getSafeVariant = (variant: any) => {
  if (prefersReducedMotion()) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.01 }
    };
  }
  return variant;
};

/**
 * Create stagger delay for index
 */
export const getStaggerDelay = (index: number, baseDelay = 0.05): number => {
  return index * baseDelay;
};
