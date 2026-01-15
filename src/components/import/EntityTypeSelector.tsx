import React from 'react';
import { Car, Users, Calendar, MapPin, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ImportEntityType, getAllImportSchemas } from '@/lib/importSchemas';
import { EntityDetectionResult } from '@/lib/importUtils';

interface EntityTypeSelectorProps {
  detectedEntity: EntityDetectionResult | null;
  selectedEntity: ImportEntityType | null;
  onSelect: (entityType: ImportEntityType) => void;
  disabled?: boolean;
}

const entityIcons: Record<ImportEntityType, React.ElementType> = {
  vehicles: Car,
  customers: Users,
  bookings: Calendar,
  locations: MapPin
};

export function EntityTypeSelector({
  detectedEntity,
  selectedEntity,
  onSelect,
  disabled = false
}: EntityTypeSelectorProps) {
  const schemas = getAllImportSchemas();
  
  const getConfidenceBadge = (entityType: ImportEntityType) => {
    if (!detectedEntity || detectedEntity.entityType !== entityType) return null;
    
    const confidence = detectedEntity.confidence;
    
    if (confidence >= 80) {
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          High Match ({confidence}%)
        </Badge>
      );
    } else if (confidence >= 50) {
      return (
        <Badge variant="default" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Possible Match ({confidence}%)
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* AI Detection Header */}
      {detectedEntity && detectedEntity.confidence >= 50 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <Sparkles className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-sm">AI Detection</p>
            <p className="text-sm text-muted-foreground">
              Based on your column headers, this appears to be <strong className="text-foreground">{detectedEntity.entityType}</strong> data.
            </p>
            <p className="text-xs text-muted-foreground">{detectedEntity.reasoning}</p>
          </div>
        </div>
      )}

      {/* Entity Type Cards */}
      <div className="grid grid-cols-2 gap-3">
        {schemas.map((schema) => {
          const Icon = entityIcons[schema.entityType];
          const isSelected = selectedEntity === schema.entityType;
          const isDetected = detectedEntity?.entityType === schema.entityType;
          
          return (
            <Card
              key={schema.entityType}
              className={cn(
                'p-4 cursor-pointer transition-all border-2',
                isSelected 
                  ? 'border-primary bg-primary/5' 
                  : 'border-transparent hover:border-primary/30',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => !disabled && onSelect(schema.entityType)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    isSelected ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    <Icon className={cn(
                      'h-5 w-5',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )} />
                  </div>
                  <div>
                    <p className="font-medium">{schema.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {schema.fields.filter(f => f.required).length} required fields
                    </p>
                  </div>
                </div>
                
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                )}
              </div>
              
              {isDetected && (
                <div className="mt-3">
                  {getConfidenceBadge(schema.entityType)}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                {schema.description}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Selected Entity Info */}
      {selectedEntity && (
        <div className="pt-2 text-sm text-muted-foreground">
          <p>
            You're importing <strong className="text-foreground">{selectedEntity}</strong> data. 
            In the next step, you'll map your columns to ExotIQ fields.
          </p>
        </div>
      )}
    </div>
  );
}
