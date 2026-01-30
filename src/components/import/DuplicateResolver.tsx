import React, { useState, useMemo } from 'react';
import { AlertTriangle, Check, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { DuplicateMatch } from '@/lib/importDuplicateCheck';

export type DuplicateResolution = 'skip' | 'overwrite' | 'merge';

interface DuplicateResolverProps {
  duplicates: DuplicateMatch[];
  onResolve: (resolutions: Map<number, DuplicateResolution>) => void;
  onBack?: () => void;
}

const RESOLUTION_OPTIONS: { value: DuplicateResolution; label: string; description: string }[] = [
  { 
    value: 'skip', 
    label: 'Skip', 
    description: 'Keep existing record, ignore import row' 
  },
  { 
    value: 'overwrite', 
    label: 'Overwrite', 
    description: 'Replace existing with imported data' 
  },
  { 
    value: 'merge', 
    label: 'Merge', 
    description: 'Fill empty fields only, keep existing values' 
  },
];

interface DuplicateCardProps {
  duplicate: DuplicateMatch;
  resolution: DuplicateResolution;
  onResolutionChange: (resolution: DuplicateResolution) => void;
}

function DuplicateCard({ duplicate, resolution, onResolutionChange }: DuplicateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get keys from both records for comparison
  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.keys(duplicate.importData).forEach(k => keys.add(k));
    Object.keys(duplicate.existingRecord).forEach(k => keys.add(k));
    // Filter out internal fields
    ['id', 'user_id', 'team_id', 'created_at', 'updated_at'].forEach(k => keys.delete(k));
    return Array.from(keys);
  }, [duplicate]);

  // Count differences
  const differences = useMemo(() => {
    return allKeys.filter(key => {
      const importVal = duplicate.importData[key];
      const existingVal = duplicate.existingRecord[key];
      return String(importVal || '') !== String(existingVal || '');
    }).length;
  }, [allKeys, duplicate]);

  return (
    <Card className="p-4 border-warning/30 bg-warning/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="font-medium">Row {duplicate.importRowNumber}</span>
            <Badge variant="outline" className="text-xs">
              Match: {duplicate.matchField}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Found existing record matching <span className="font-mono bg-muted px-1 rounded">{duplicate.matchValue}</span>
          </p>

          {/* Resolution Options */}
          <RadioGroup 
            value={resolution} 
            onValueChange={(v) => onResolutionChange(v as DuplicateResolution)}
            className="flex gap-4"
          >
            {RESOLUTION_OPTIONS.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${duplicate.importRowIndex}-${option.value}`} />
                <Label 
                  htmlFor={`${duplicate.importRowIndex}-${option.value}`}
                  className="text-sm cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {differences} {differences === 1 ? 'difference' : 'differences'}
          </Badge>
        </div>
      </div>

      {/* Expandable Comparison */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="mt-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            Compare values
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="font-medium text-muted-foreground">Existing Record</div>
            <div className="font-medium text-muted-foreground">Import Data</div>
            
            {allKeys.slice(0, 8).map(key => {
              const existingVal = String(duplicate.existingRecord[key] || '—');
              const importVal = String(duplicate.importData[key] || '—');
              const isDifferent = existingVal !== importVal;
              
              return (
                <React.Fragment key={key}>
                  <div className={cn(
                    'p-2 rounded bg-muted/50',
                    isDifferent && 'border-l-2 border-warning'
                  )}>
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span className="font-mono">{existingVal.substring(0, 50)}</span>
                  </div>
                  <div className={cn(
                    'p-2 rounded bg-muted/50',
                    isDifferent && 'border-l-2 border-primary'
                  )}>
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span className="font-mono">{importVal.substring(0, 50)}</span>
                  </div>
                </React.Fragment>
              );
            })}
            
            {allKeys.length > 8 && (
              <div className="col-span-2 text-center text-muted-foreground">
                + {allKeys.length - 8} more fields
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function DuplicateResolver({ duplicates, onResolve, onBack }: DuplicateResolverProps) {
  const [resolutions, setResolutions] = useState<Map<number, DuplicateResolution>>(() => {
    // Default all to 'skip'
    const map = new Map<number, DuplicateResolution>();
    duplicates.forEach(d => map.set(d.importRowIndex, 'skip'));
    return map;
  });
  const [applyToAll, setApplyToAll] = useState<DuplicateResolution | null>(null);

  const handleResolutionChange = (rowIndex: number, resolution: DuplicateResolution) => {
    setResolutions(prev => {
      const next = new Map(prev);
      next.set(rowIndex, resolution);
      return next;
    });
    setApplyToAll(null); // Clear apply-to-all when individual selection made
  };

  const handleApplyToAll = (resolution: DuplicateResolution) => {
    setApplyToAll(resolution);
    setResolutions(() => {
      const map = new Map<number, DuplicateResolution>();
      duplicates.forEach(d => map.set(d.importRowIndex, resolution));
      return map;
    });
  };

  const handleContinue = () => {
    onResolve(resolutions);
  };

  // Count resolutions
  const stats = useMemo(() => {
    let skip = 0, overwrite = 0, merge = 0;
    resolutions.forEach(r => {
      if (r === 'skip') skip++;
      else if (r === 'overwrite') overwrite++;
      else if (r === 'merge') merge++;
    });
    return { skip, overwrite, merge };
  }, [resolutions]);

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="flex items-start gap-4 p-4 rounded-lg bg-warning/10 border border-warning/20">
        <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium mb-1">Duplicates Found</h4>
          <p className="text-sm text-muted-foreground">
            {duplicates.length} record{duplicates.length > 1 ? 's' : ''} in your import match existing data. 
            Choose how to handle each duplicate below.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Apply to all duplicates:</span>
        <div className="flex gap-2">
          {RESOLUTION_OPTIONS.map(option => (
            <Button
              key={option.value}
              variant={applyToAll === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleApplyToAll(option.value)}
            >
              {option.value === 'skip' && <X className="h-3 w-3 mr-1" />}
              {option.value === 'overwrite' && <RefreshCw className="h-3 w-3 mr-1" />}
              {option.value === 'merge' && <Check className="h-3 w-3 mr-1" />}
              {option.label} All
            </Button>
          ))}
        </div>
      </div>

      {/* Duplicate List */}
      <ScrollArea className="h-[350px] pr-4">
        <div className="space-y-4">
          {duplicates.map(duplicate => (
            <DuplicateCard
              key={duplicate.importRowIndex}
              duplicate={duplicate}
              resolution={resolutions.get(duplicate.importRowIndex) || 'skip'}
              onResolutionChange={(r) => handleResolutionChange(duplicate.importRowIndex, r)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Resolution Summary */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">
            <X className="h-3 w-3 inline mr-1" />
            Skip: <span className="font-medium">{stats.skip}</span>
          </span>
          <span className="text-muted-foreground">
            <RefreshCw className="h-3 w-3 inline mr-1" />
            Overwrite: <span className="font-medium">{stats.overwrite}</span>
          </span>
          <span className="text-muted-foreground">
            <Check className="h-3 w-3 inline mr-1" />
            Merge: <span className="font-medium">{stats.merge}</span>
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <Button onClick={handleContinue} className="ml-auto">
          Continue with Import
        </Button>
      </div>
    </div>
  );
}

export default DuplicateResolver;
