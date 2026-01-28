import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Fuel,
  Gauge,
  Key,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  Check,
  Star,
} from 'lucide-react';
import { InspectionChecklist } from './types';

interface InspectionChecklistFormProps {
  checklist: InspectionChecklist;
  inspectorName: string;
  notes: string;
  onChecklistChange: (checklist: InspectionChecklist) => void;
  onInspectorNameChange: (name: string) => void;
  onNotesChange: (notes: string) => void;
  onComplete: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

const conditionOptions = ['excellent', 'good', 'fair', 'poor'] as const;

export const InspectionChecklistForm = ({
  checklist,
  inspectorName,
  notes,
  onChecklistChange,
  onInspectorNameChange,
  onNotesChange,
  onComplete,
  onBack,
  isSubmitting = false,
}: InspectionChecklistFormProps) => {
  const [fuelLevel, setFuelLevel] = useState([checklist.fuelLevel]);

  const updateChecklist = (updates: Partial<InspectionChecklist>) => {
    onChecklistChange({ ...checklist, ...updates });
  };

  const handleFuelChange = (value: number[]) => {
    setFuelLevel(value);
    updateChecklist({ fuelLevel: value[0] });
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'excellent':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Excellent
          </Badge>
        );
      case 'good':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">
            Good
          </Badge>
        );
      case 'fair':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            Fair
          </Badge>
        );
      case 'poor':
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Poor
          </Badge>
        );
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const isValid = inspectorName.trim() !== '' && checklist.odometerReading !== null;

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center p-4 border-b">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back
        </Button>
        <h2 className="flex-1 text-center font-semibold pr-16">
          Inspection Checklist
        </h2>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6 min-h-0">
        {/* Inspector Name */}
        <Card className="p-4">
          <Label htmlFor="inspector_name" className="text-base font-medium">
            Inspector Name *
          </Label>
          <Input
            id="inspector_name"
            value={inspectorName}
            onChange={(e) => onInspectorNameChange(e.target.value)}
            placeholder="Enter your name"
            className="mt-2"
          />
        </Card>

        {/* Odometer Reading */}
        <Card className="p-4">
          <Label htmlFor="odometer" className="text-base font-medium">
            Odometer Reading (miles) *
          </Label>
          <div className="relative mt-2">
            <Gauge className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="odometer"
              type="number"
              min="0"
              value={checklist.odometerReading ?? ''}
              onChange={(e) =>
                updateChecklist({
                  odometerReading: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              className="pl-10"
              placeholder="12345"
            />
          </div>
        </Card>

        {/* Fuel Level */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Fuel Level</Label>
            <Badge variant="outline">
              <Fuel className="w-3 h-3 mr-1" />
              {fuelLevel[0]}%
            </Badge>
          </div>
          <Slider
            value={fuelLevel}
            onValueChange={handleFuelChange}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Empty</span>
            <span>1/4</span>
            <span>1/2</span>
            <span>3/4</span>
            <span>Full</span>
          </div>
          {/* Visual Fuel Tank */}
          <div className="relative h-10 w-full rounded-lg border-2 border-border bg-muted/30 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                fuelLevel[0] <= 25
                  ? 'bg-red-500'
                  : fuelLevel[0] <= 50
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              )}
              style={{ width: `${fuelLevel[0]}%` }}
            />
          </div>
        </Card>

        {/* Keys Count */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">Number of Keys</Label>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateChecklist({
                    keysCount: Math.max(0, checklist.keysCount - 1),
                  })
                }
                disabled={checklist.keysCount <= 0}
              >
                -
              </Button>
              <span className="w-8 text-center font-medium">
                {checklist.keysCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateChecklist({ keysCount: checklist.keysCount + 1 })
                }
              >
                +
              </Button>
            </div>
          </div>
        </Card>

        {/* Cleanliness Rating */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-medium">Cleanliness Rating</Label>
          </div>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => updateChecklist({ cleanlinessRating: rating })}
                className={cn(
                  'p-2 rounded-full transition-all',
                  checklist.cleanlinessRating >= rating
                    ? 'text-yellow-500'
                    : 'text-muted-foreground/30'
                )}
              >
                <Star
                  className={cn(
                    'h-8 w-8',
                    checklist.cleanlinessRating >= rating && 'fill-current'
                  )}
                />
              </button>
            ))}
          </div>
        </Card>

        {/* Condition Assessments */}
        <Card className="p-4 space-y-4">
          <Label className="text-base font-medium">Condition Assessment</Label>

          <div className="space-y-3">
            {/* Exterior */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Exterior</span>
              <Select
                value={checklist.exteriorCondition}
                onValueChange={(value: typeof conditionOptions[number]) =>
                  updateChecklist({ exteriorCondition: value })
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Interior */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Interior</span>
              <Select
                value={checklist.interiorCondition}
                onValueChange={(value: typeof conditionOptions[number]) =>
                  updateChecklist({ interiorCondition: value })
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tires */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Tires</span>
              <Select
                value={checklist.tireCondition}
                onValueChange={(value: typeof conditionOptions[number]) =>
                  updateChecklist({ tireCondition: value })
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Condition Summary */}
          <div className="pt-2 flex flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Ext:</span>
              {getConditionBadge(checklist.exteriorCondition)}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Int:</span>
              {getConditionBadge(checklist.interiorCondition)}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Tires:</span>
              {getConditionBadge(checklist.tireCondition)}
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-4 space-y-2">
          <Label htmlFor="notes" className="text-base font-medium">
            Additional Notes
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Any additional observations or notes..."
            className="h-24"
          />
        </Card>
      </div>

      {/* Submit Button */}
      <div className="p-4 border-t">
        <Button
          onClick={onComplete}
          disabled={!isValid || isSubmitting}
          className="w-full btn-premium"
        >
          {isSubmitting ? (
            'Submitting...'
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Complete Inspection
            </>
          )}
        </Button>
        {!isValid && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Please fill in all required fields
          </p>
        )}
      </div>
    </div>
  );
};
