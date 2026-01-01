import React from 'react';
import { cn } from '@/lib/utils';
import { SpeedDivider } from './SpeedDivider';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  showDivider?: boolean;
}

/**
 * Branded Page Header Component
 * 
 * A consistent, premium page header with Dfaalt typography and optional speed divider.
 * 
 * @param title - Main page title (uses Dfaalt font)
 * @param subtitle - Optional subtitle/description
 * @param action - Optional action button or component (top-right)
 * @param showDivider - Show speed divider below header (default: true)
 * @param className - Additional CSS classes
 * 
 * @example
 * <PageHeader 
 *   title="Fleet Overview"
 *   subtitle="Monitor your entire fleet in real-time"
 *   action={<Button>Add Vehicle</Button>}
 * />
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  action,
  className,
  showDivider = true,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-brand text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="font-body text-base md:text-lg text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
      {showDivider && <SpeedDivider className="my-6" />}
    </div>
  );
};

/**
 * Compact Page Header - For mobile or tight spaces
 */
export const PageHeaderCompact: React.FC<Omit<PageHeaderProps, 'subtitle'>> = ({
  title,
  action,
  className,
  showDivider = false,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-brand text-xl md:text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
      {showDivider && <SpeedDivider className="my-4" />}
    </div>
  );
};
