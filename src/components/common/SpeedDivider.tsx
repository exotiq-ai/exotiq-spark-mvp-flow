import React from 'react';
import { cn } from '@/lib/utils';

interface SpeedDividerProps {
  className?: string;
  variant?: 'horizontal' | 'vertical';
}

/**
 * Speed Divider - Gulf Racing Heritage Pattern
 * 
 * A branded divider inspired by racing stripes and Gulf heritage colors.
 * Creates a subtle visual rhythm throughout the interface.
 * 
 * @param variant - 'horizontal' (default) or 'vertical'
 * @param className - Additional CSS classes
 * 
 * @example
 * // Horizontal section divider
 * <SpeedDivider className="my-8" />
 * 
 * // Vertical sidebar divider
 * <SpeedDivider variant="vertical" className="mx-4" />
 */
export const SpeedDivider: React.FC<SpeedDividerProps> = ({
  className,
  variant = 'horizontal',
}) => {
  if (variant === 'vertical') {
    return (
      <div
        className={cn(
          'w-0.5 bg-gradient-to-b from-gulf-blue via-performance-orange to-gulf-blue',
          'opacity-30',
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'h-0.5 w-full bg-gradient-to-r from-gulf-blue via-performance-orange to-gulf-blue',
        'opacity-30',
        className
      )}
    />
  );
};

/**
 * Racing Stripe - Vertical accent for cards and containers
 */
export const RacingStripe: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'absolute left-0 top-0 bottom-0 w-1',
        'bg-gradient-to-b from-gulf-blue to-performance-orange',
        'opacity-60',
        className
      )}
    />
  );
};
