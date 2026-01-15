import React, { useEffect, useState } from 'react';
import { ChevronDown, Check, X, AlertCircle, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ImportEntityType, getImportSchema } from '@/lib/importSchemas';
import { ColumnMapping, suggestColumnMappings, checkRequiredFields } from '@/lib/importUtils';

interface ColumnMapperProps {
  entityType: ImportEntityType;
  sourceHeaders: string[];
  sourceRows: Record<string, unknown>[];
  mappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
}

export function ColumnMapper({
  entityType,
  sourceHeaders,
  sourceRows,
  mappings,
  onMappingsChange
}: ColumnMapperProps) {
  const schema = getImportSchema(entityType);
  const [localMappings, setLocalMappings] = useState<ColumnMapping[]>(mappings);
  const requiredCheck = checkRequiredFields(localMappings, entityType);

  useEffect(() => {
    // Auto-suggest mappings when component mounts
    if (mappings.length === 0) {
      const suggested = suggestColumnMappings(sourceHeaders, entityType, sourceRows);
      setLocalMappings(suggested);
      onMappingsChange(suggested);
    }
  }, [entityType, sourceHeaders, sourceRows]);

  const handleMappingChange = (targetField: string, sourceColumn: string) => {
    const updated = localMappings.map(m => {
      if (m.targetField === targetField) {
        return {
          ...m,
          sourceColumn,
          confidence: sourceColumn ? 100 : 0,
          sampleValues: sourceColumn ? getSampleValues(sourceColumn) : []
        };
      }
      return m;
    });
    
    setLocalMappings(updated);
    onMappingsChange(updated);
  };

  const getSampleValues = (column: string): string[] => {
    const values: string[] = [];
    for (const row of sourceRows.slice(0, 3)) {
      const value = row[column];
      if (value !== null && value !== undefined && value !== '') {
        values.push(String(value).substring(0, 50));
      }
    }
    return values;
  };

  const getUsedColumns = () => {
    return new Set(localMappings.filter(m => m.sourceColumn).map(m => m.sourceColumn));
  };

  const usedColumns = getUsedColumns();

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-500';
    if (confidence >= 70) return 'text-yellow-500';
    if (confidence >= 50) return 'text-orange-500';
    return 'text-muted-foreground';
  };

  const getFieldDef = (fieldName: string) => {
    return schema.fields.find(f => f.name === fieldName);
  };

  return (
    <div className="space-y-4">
      {/* Validation Status */}
      {!requiredCheck.valid && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-sm text-destructive">Missing Required Fields</p>
            <p className="text-sm text-muted-foreground">
              Please map these required fields: {requiredCheck.missingFields.join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* AI Mapping Info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Smart mapping applied - review and adjust as needed</span>
      </div>

      {/* Mapping Table */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {localMappings.map((mapping) => {
            const fieldDef = getFieldDef(mapping.targetField);
            const isRequired = fieldDef?.required ?? false;
            const isMapped = !!mapping.sourceColumn;
            const hasError = isRequired && !isMapped;

            return (
              <Card
                key={mapping.targetField}
                className={cn(
                  'p-4',
                  hasError && 'border-destructive/50'
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Target Field */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {fieldDef?.label || mapping.targetField}
                      </span>
                      {isRequired && (
                        <Badge variant="outline" className="text-xs">Required</Badge>
                      )}
                      {fieldDef?.description && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{fieldDef.description}</p>
                              {fieldDef.example && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Example: {fieldDef.example}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fieldDef?.type}
                      {fieldDef?.enumValues && ` (${fieldDef.enumValues.join(', ')})`}
                    </p>
                  </div>

                  {/* Mapping Arrow */}
                  <div className="flex items-center px-2">
                    <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                  </div>

                  {/* Source Column Selector */}
                  <div className="flex-1 min-w-0">
                    <Select
                      value={mapping.sourceColumn || '__none__'}
                      onValueChange={(value) => 
                        handleMappingChange(mapping.targetField, value === '__none__' ? '' : value)
                      }
                    >
                      <SelectTrigger className={cn(
                        'w-full',
                        hasError && 'border-destructive'
                      )}>
                        <SelectValue placeholder="Select source column" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">-- Skip this field --</span>
                        </SelectItem>
                        {sourceHeaders.map((header) => {
                          const isUsed = usedColumns.has(header) && mapping.sourceColumn !== header;
                          return (
                            <SelectItem 
                              key={header} 
                              value={header}
                              disabled={isUsed}
                            >
                              <div className="flex items-center gap-2">
                                <span>{header}</span>
                                {isUsed && (
                                  <span className="text-xs text-muted-foreground">(used)</span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    {/* Confidence Badge */}
                    {isMapped && mapping.confidence > 0 && mapping.confidence < 100 && (
                      <div className="flex items-center gap-1 mt-1">
                        <Sparkles className={cn('h-3 w-3', getConfidenceColor(mapping.confidence))} />
                        <span className={cn('text-xs', getConfidenceColor(mapping.confidence))}>
                          {mapping.confidence}% match
                        </span>
                      </div>
                    )}

                    {/* Sample Values */}
                    {isMapped && mapping.sampleValues.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">Sample values:</p>
                        <div className="flex flex-wrap gap-1">
                          {mapping.sampleValues.slice(0, 3).map((value, i) => (
                            <Badge key={i} variant="secondary" className="text-xs font-normal">
                              {value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Icon */}
                  <div className="flex items-center">
                    {isMapped ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : isRequired ? (
                      <X className="h-5 w-5 text-destructive" />
                    ) : (
                      <div className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
        <span>
          {localMappings.filter(m => m.sourceColumn).length} of {localMappings.length} fields mapped
        </span>
        <span>
          {sourceHeaders.length - usedColumns.size} unmapped source columns
        </span>
      </div>
    </div>
  );
}
