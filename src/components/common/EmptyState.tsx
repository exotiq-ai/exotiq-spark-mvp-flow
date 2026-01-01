import React from 'react';
import { LucideIcon, Car, Calendar, Users, SearchX, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'card' | 'inline';
  illustration?: React.ReactNode;
}

/**
 * EmptyState Component
 * 
 * Beautiful, consistent empty states for all views in Exotiq.
 * Guides users on what to do next with clear CTAs.
 * 
 * @example
 * // Fleet empty state
 * <EmptyState
 *   icon={Car}
 *   title="No vehicles yet"
 *   description="Add your first vehicle to start managing your fleet"
 *   action={{
 *     label: "Add Vehicle",
 *     onClick: () => openAddVehicleDialog()
 *   }}
 * />
 * 
 * @example
 * // Bookings empty state
 * <EmptyState
 *   icon={Calendar}
 *   title="No bookings"
 *   description="Your schedule is clear. New bookings will appear here."
 *   variant="inline"
 * />
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  variant = 'card',
  illustration,
}) => {
  const content = (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      variant === 'card' ? "py-16 px-6" : "py-12 px-4"
    )}>
      {/* Icon or Illustration */}
      {illustration ? (
        <div className="mb-6">{illustration}</div>
      ) : (
        <div className={cn(
          "rounded-full flex items-center justify-center mb-6",
          "bg-gradient-to-br from-muted to-muted/50",
          "shadow-inner",
          variant === 'card' ? "w-20 h-20" : "w-16 h-16"
        )}>
          <Icon className={cn(
            "text-muted-foreground/60",
            variant === 'card' ? "h-10 w-10" : "h-8 w-8"
          )} />
        </div>
      )}

      {/* Title */}
      <h3 className={cn(
        "font-dfaalt font-bold text-foreground mb-2",
        variant === 'card' ? "text-xl md:text-2xl" : "text-lg md:text-xl"
      )}>
        {title}
      </h3>

      {/* Description */}
      <p className={cn(
        "text-muted-foreground font-montserrat mb-6 max-w-md",
        variant === 'card' ? "text-base" : "text-sm"
      )}>
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || 'default'}
              size="lg"
              className="w-full sm:w-auto"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'inline') {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={cn("border-dashed", className)}>
      {content}
    </Card>
  );
};

// Preset Empty States for common scenarios

export const NoVehiclesState = ({ onAddVehicle }: { onAddVehicle: () => void }) => (
  <EmptyState
    icon={Car}
    title="No vehicles in your fleet"
    description="Start by adding your first vehicle. You can add photos, set pricing, and track maintenance all in one place."
    action={{
      label: "Add Your First Vehicle",
      onClick: onAddVehicle,
    }}
  />
);

export const NoBookingsState = ({ onCreateBooking }: { onCreateBooking?: () => void }) => (
  <EmptyState
    icon={Calendar}
    title="No bookings yet"
    description={onCreateBooking 
      ? "Your schedule is clear. Create your first booking to get started."
      : "Your schedule is clear. New bookings will appear here."
    }
    action={onCreateBooking ? {
      label: "Create Booking",
      onClick: onCreateBooking,
    } : undefined}
    variant="inline"
  />
);

export const NoCustomersState = ({ onAddCustomer }: { onAddCustomer: () => void }) => (
  <EmptyState
    icon={Users}
    title="No customers yet"
    description="Add your first customer to start building your client database. Track rentals, preferences, and history."
    action={{
      label: "Add Customer",
      onClick: onAddCustomer,
    }}
  />
);

export const NoSearchResultsState = ({ searchTerm }: { searchTerm: string }) => (
  <EmptyState
    icon={SearchX}
    title="No results found"
    description={`We couldn't find anything matching "${searchTerm}". Try different keywords or filters.`}
    variant="inline"
  />
);

export const NoDataState = ({ 
  title = "No data available",
  description = "There's no data to display yet. Check back later or adjust your filters.",
}: { 
  title?: string;
  description?: string;
}) => (
  <EmptyState
    icon={Inbox}
    title={title}
    description={description}
    variant="inline"
  />
);
