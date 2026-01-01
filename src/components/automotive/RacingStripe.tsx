import React from 'react';
import { cn } from '@/lib/utils';

interface RacingStripeProps {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'gulf' | 'performance' | 'silver';
  width?: 'thin' | 'standard' | 'wide';
  className?: string;
}

/**
 * RacingStripe Component
 * 
 * Adds subtle automotive racing heritage to UI elements.
 * Inspired by Gulf livery and classic racing stripes.
 * 
 * @example
 * // Gulf racing stripe (horizontal)
 * <RacingStripe variant="gulf" />
 * 
 * @example
 * // Vertical accent on card
 * <Card>
 *   <RacingStripe orientation="vertical" variant="performance" width="thin" />
 *   <CardContent>...</CardContent>
 * </Card>
 */
export const RacingStripe: React.FC<RacingStripeProps> = ({
  orientation = 'horizontal',
  variant = 'gulf',
  width = 'standard',
  className,
}) => {
  const isHorizontal = orientation === 'horizontal';
  
  // Width classes
  const widthClasses = {
    thin: isHorizontal ? 'h-1' : 'w-1',
    standard: isHorizontal ? 'h-2' : 'w-2',
    wide: isHorizontal ? 'h-3' : 'w-3',
  };

  // Variant gradients
  const variantClasses = {
    gulf: 'bg-gradient-to-r from-gulf-blue via-performance-orange to-gulf-blue',
    performance: 'bg-gradient-to-r from-performance-orange via-performance-orange-light to-performance-orange',
    silver: 'bg-gradient-to-r from-[#A0A0A0] via-[#E0E0E0] to-[#A0A0A0]',
  };

  return (
    <div
      className={cn(
        'flex-shrink-0',
        widthClasses[width],
        isHorizontal ? 'w-full' : 'h-full',
        variantClasses[variant],
        'shadow-sm',
        className
      )}
      role="presentation"
      aria-hidden="true"
    />
  );
};

/**
 * Tachometer Component
 * 
 * Circular progress indicator inspired by automotive tachometers.
 * Perfect for KPIs, utilization rates, and performance metrics.
 * 
 * @example
 * <Tachometer 
 *   value={85} 
 *   max={100}
 *   label="Fleet Utilization"
 *   variant="gulf"
 * />
 */
interface TachometerProps {
  value: number;
  max: number;
  label?: string;
  variant?: 'gulf' | 'performance' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

export const Tachometer: React.FC<TachometerProps> = ({
  value,
  max,
  label,
  variant = 'gulf',
  size = 'md',
  showValue = true,
  className,
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-32 h-32',
    lg: 'w-40 h-40',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const labelSizeClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  const variantColors = {
    gulf: 'text-gulf-blue',
    performance: 'text-performance-orange',
    success: 'text-success',
    warning: 'text-warning',
  };

  const variantStrokes = {
    gulf: 'stroke-gulf-blue',
    performance: 'stroke-performance-orange',
    success: 'stroke-success',
    warning: 'stroke-warning',
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', sizeClasses[size], className)}>
      <svg className="transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(variantStrokes[variant], 'transition-all duration-1000 ease-out')}
          style={{
            filter: 'drop-shadow(0 0 4px currentColor)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showValue && (
          <div className={cn('font-dfaalt font-bold', textSizeClasses[size], variantColors[variant])}>
            {Math.round(percentage)}%
          </div>
        )}
        {label && (
          <div className={cn('font-montserrat text-muted-foreground text-center px-2', labelSizeClasses[size])}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * MetallicGradient Component
 * 
 * Adds a subtle metallic sheen to backgrounds, inspired by luxury automotive finishes.
 * 
 * @example
 * <Card className="relative overflow-hidden">
 *   <MetallicGradient variant="silver" opacity="subtle" />
 *   <CardContent className="relative z-10">...</CardContent>
 * </Card>
 */
interface MetallicGradientProps {
  variant?: 'silver' | 'carbon' | 'brushed';
  opacity?: 'subtle' | 'medium' | 'strong';
  className?: string;
}

export const MetallicGradient: React.FC<MetallicGradientProps> = ({
  variant = 'silver',
  opacity = 'subtle',
  className,
}) => {
  const opacityClasses = {
    subtle: 'opacity-5',
    medium: 'opacity-10',
    strong: 'opacity-20',
  };

  const variantStyles = {
    silver: 'bg-gradient-to-br from-[#E0E0E0] via-[#F5F5F5] to-[#C0C0C0]',
    carbon: 'carbon-fiber',
    brushed: 'bg-gradient-to-r from-[#D0D0D0] via-[#F0F0F0] to-[#D0D0D0]',
  };

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none',
        variantStyles[variant],
        opacityClasses[opacity],
        className
      )}
      role="presentation"
      aria-hidden="true"
    />
  );
};
