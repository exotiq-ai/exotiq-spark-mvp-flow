import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressiveDisclosureProps {
  title: string;
  preview: React.ReactNode;
  fullContent: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: string;
  tip?: string;
  className?: string;
}

/**
 * ProgressiveDisclosure Component
 * 
 * Reduces cognitive load by showing essential info first,
 * with the option to expand for details.
 * 
 * Perfect for:
 * - Dashboard widgets with detailed views
 * - Settings sections
 * - Complex data tables
 * 
 * @example
 * <ProgressiveDisclosure
 *   title="Revenue Breakdown"
 *   preview={<RevenueChart />}
 *   fullContent={<DetailedRevenueTable />}
 *   tip="Expand to see vehicle-by-vehicle breakdown"
 * />
 */
export const ProgressiveDisclosure = ({
  title,
  preview,
  fullContent,
  defaultExpanded = false,
  badge,
  tip,
  className,
}: ProgressiveDisclosureProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 md:p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-dfaalt font-semibold text-lg">{title}</h3>
            {badge && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-gulf-blue/10 text-gulf-blue rounded-full">
                {badge}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-2"
          >
            {isExpanded ? (
              <>
                Show Less
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Show More
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Preview (always visible) */}
        <div className="p-4 md:p-6">
          {preview}
        </div>

        {/* Full Content (expandable) */}
        {isExpanded && (
          <div className="p-4 md:p-6 pt-0 border-t animate-fade-in">
            {fullContent}
          </div>
        )}

        {/* Tip */}
        {tip && !isExpanded && (
          <div className="px-4 md:px-6 pb-4 flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{tip}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * CollapsibleSection Component
 * 
 * Simpler version for settings and forms.
 * 
 * @example
 * <CollapsibleSection title="Advanced Settings">
 *   <AdvancedSettingsForm />
 * </CollapsibleSection>
 */
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const CollapsibleSection = ({
  title,
  children,
  defaultExpanded = false,
  icon,
  className,
}: CollapsibleSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="font-dfaalt font-semibold">{title}</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      {isExpanded && (
        <div className="p-4 border-t animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
};
