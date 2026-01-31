import React from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Sparkles, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DetectedFormat } from '@/lib/importFormatDetection';

interface FormatDetectionBannerProps {
  format: DetectedFormat;
  onApplyMappings: () => void;
  onManualMapping: () => void;
  isApplying?: boolean;
}

export function FormatDetectionBanner({
  format,
  onApplyMappings,
  onManualMapping,
  isApplying = false,
}: FormatDetectionBannerProps) {
  if (format.software === 'Generic' || format.confidence < 20) {
    return null;
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-500 bg-green-500/10';
    if (confidence >= 50) return 'text-yellow-500 bg-yellow-500/10';
    return 'text-orange-500 bg-orange-500/10';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-primary/20 bg-primary/5 p-4 mb-4"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Format Detected</span>
            <Badge 
              variant="secondary" 
              className={cn('text-xs', getConfidenceColor(format.confidence))}
            >
              {format.confidence}% match
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            This looks like a <strong>{format.software}</strong> export. 
            {format.suggestedMappings.length > 0 && (
              <> We can auto-map {format.suggestedMappings.length} columns for you.</>
            )}
          </p>

          {/* Notes */}
          {format.notes.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                      <Info className="h-3.5 w-3.5" />
                      <span>{format.notes[0]}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <ul className="space-y-1 text-xs">
                      {format.notes.map((note, i) => (
                        <li key={i}>• {note}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={onApplyMappings}
              disabled={isApplying || format.suggestedMappings.length === 0}
              className="gap-1"
            >
              Apply {format.software} Mappings
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onManualMapping}
              disabled={isApplying}
            >
              Map Manually Instead
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
