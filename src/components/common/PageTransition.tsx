import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

// Apple-style: subtle, fast, and crucially — no scale.
// Scaling a full-height page changes content height by a pixel or two and
// causes the scrollbar to flash on every transition. Opacity + a 4px y-shift
// gives a polished feel without any layout impact.
const pageVariants = {
  initial: { opacity: 0, y: 4 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -4 },
};

const pageTransition = {
  type: 'tween' as const,
  ease: [0.22, 1, 0.36, 1] as const, // standard Apple easing
  duration: 0.18,
};

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className,
}) => {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface AnimatedRouteProps {
  children: React.ReactNode;
  location: { pathname: string };
}

export const AnimatedRoute: React.FC<AnimatedRouteProps> = ({
  children,
  location,
}) => {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
