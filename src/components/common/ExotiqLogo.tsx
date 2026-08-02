import React from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

export type LogoVariant = 'white' | 'gulf-blue' | 'orange' | 'silver' | 'black' | 'auto';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ExotiqLogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  showWordmark?: boolean;
}

const sizeMap: Record<LogoSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

const MARK_WHITE = '/brand/logos/exotiq-mark-white.png';
const MARK_BLACK = '/brand/logos/exotiq-mark-black.png';

// Only two real marks exist (light/dark). Legacy variant names map to the closest one.
const logoFiles: Record<Exclude<LogoVariant, 'auto'>, string> = {
  'white': MARK_WHITE,
  'gulf-blue': MARK_BLACK,
  'orange': MARK_BLACK,
  'silver': MARK_WHITE,
  'black': MARK_BLACK,
};

/**
 * Exotiq Logo Component
 * 
 * A flexible, branded logo component with multiple variants and sizes.
 * 
 * @param variant - Color variant: 'white', 'gulf-blue', 'orange', 'silver', 'black'
 * @param size - Size preset: 'xs', 'sm', 'md', 'lg', 'xl'
 * @param showWordmark - Display "Exotiq" text next to logo (default: false)
 * @param className - Additional CSS classes
 * 
 * @example
 * // Navigation logo
 * <ExotiqLogo variant="gulf-blue" size="md" showWordmark />
 * 
 * // Icon-only small
 * <ExotiqLogo variant="white" size="sm" />
 * 
 * // Large hero logo
 * <ExotiqLogo variant="gulf-blue" size="xl" showWordmark />
 */
export const ExotiqLogo: React.FC<ExotiqLogoProps> = ({
  variant = 'auto',
  size = 'md',
  showWordmark = false,
  className,
}) => {
  const { theme } = useTheme();
  
  // Auto-select logo variant based on theme
  const effectiveVariant = variant === 'auto' 
    ? (theme === 'dark' ? 'white' : 'black')
    : variant;
  
  const logoSrc = logoFiles[effectiveVariant];
  const sizeClass = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src={logoSrc}
        alt="exotiq"
        className={cn(
          sizeClass,
          'object-contain transition-transform duration-300 ease-out hover:scale-105'
        )}
      />
      {showWordmark && (
        <span
          className={cn(
            'font-brand font-bold tracking-tight',
            size === 'xs' && 'text-sm',
            size === 'sm' && 'text-base',
            size === 'md' && 'text-xl',
            size === 'lg' && 'text-2xl',
            size === 'xl' && 'text-4xl',
            effectiveVariant === 'white' && 'text-white',
            effectiveVariant === 'gulf-blue' && 'text-[#0B3D91] dark:text-white',
            effectiveVariant === 'orange' && 'text-[#FF6B35]',
            effectiveVariant === 'silver' && 'text-[#C0C0C0]',
            effectiveVariant === 'black' && 'text-[#1A1A1A] dark:text-white'
          )}
        >
          exotiq
        </span>
      )}
    </div>
  );
};

/**
 * Compact Logo for mobile navigation and tight spaces
 */
export const ExotiqLogoCompact: React.FC<{ variant?: LogoVariant; className?: string }> = ({
  variant = 'auto',
  className,
}) => {
  return <ExotiqLogo variant={variant} size="sm" className={className} />;
};

/**
 * Full branded logo with wordmark for headers and landing pages
 */
export const ExotiqLogoBranded: React.FC<{ variant?: LogoVariant; size?: LogoSize; className?: string }> = ({
  variant = 'auto',
  size = 'md',
  className,
}) => {
  return <ExotiqLogo variant={variant} size={size} showWordmark className={className} />;
};
