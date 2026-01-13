import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DollarSign,
  Sparkles,
  TrendingUp,
  Calendar as CalendarIcon,
  Check,
  Pencil,
  Car,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  status: string;
  current_rate: number;
  suggested_rate?: number | null;
  utilization?: number;
  image_url?: string | null;
}

interface QuickPriceEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  onApplyRate: (vehicleId: string, newRate: number) => Promise<void>;
}

export const QuickPriceEditorDialog = ({
  open,
  onOpenChange,
  vehicle,
  onApplyRate,
}: QuickPriceEditorDialogProps) => {
  const [newRate, setNewRate] = useState<number>(0);
  const [useDateRange, setUseDateRange] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when vehicle changes
  useEffect(() => {
    if (vehicle) {
      setNewRate(vehicle.current_rate);
      setUseDateRange(false);
      setStartDate(undefined);
      setEndDate(undefined);
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const suggestedRate = vehicle.suggested_rate || vehicle.current_rate;
  const hasSuggestion = vehicle.suggested_rate && vehicle.suggested_rate > vehicle.current_rate;
  const rateChange = newRate - vehicle.current_rate;
  const monthlyImpact = rateChange * 30;

  const handleApplyAIRate = () => {
    if (vehicle.suggested_rate) {
      setNewRate(vehicle.suggested_rate);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onApplyRate(vehicle.id, newRate);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate slider range (±50% from current rate)
  const minRate = Math.max(50, Math.floor(vehicle.current_rate * 0.5));
  const maxRate = Math.ceil(vehicle.current_rate * 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Pencil className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="block">Edit Pricing</span>
              <span className="text-sm font-normal text-muted-foreground">
                {vehicle.name}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-6">
            {/* Vehicle Info */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border">
              <div className="h-14 w-20 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                {vehicle.image_url ? (
                  <img 
                    src={vehicle.image_url} 
                    alt={vehicle.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Car className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold truncate">{vehicle.name}</h4>
                <p className="text-sm text-muted-foreground truncate">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize text-xs">
                    {vehicle.status}
                  </Badge>
                  {vehicle.utilization && (
                    <span className="text-xs text-muted-foreground">
                      {vehicle.utilization}% utilized
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-muted-foreground">Current</div>
                <div className="text-lg font-bold">${vehicle.current_rate}/day</div>
              </div>
            </div>

            {/* AI Suggestion */}
            {hasSuggestion && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-gradient-to-r from-success/10 to-primary/10 border border-success/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-success/20 rounded-lg">
                      <Sparkles className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        AI Recommendation
                        <Badge className="bg-success/20 text-success border-0 text-xs">
                          +${(suggestedRate - vehicle.current_rate).toFixed(0)}
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-success mt-1">
                        ${suggestedRate}/day
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on demand, seasonality, and local events
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-success/30 text-success hover:bg-success/10 flex-shrink-0"
                    onClick={handleApplyAIRate}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Apply
                  </Button>
                </div>
              </motion.div>
            )}

            <Separator />

            {/* Manual Adjustment */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Set New Rate
              </h4>

              {/* Rate Input */}
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      value={newRate}
                      onChange={(e) => setNewRate(Number(e.target.value))}
                      className="pl-7 pr-12 text-xl font-bold h-12"
                      min={minRate}
                      max={maxRate}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      /day
                    </span>
                  </div>
                </div>

                {/* Slider */}
                <div className="px-1">
                  <Slider
                    value={[newRate]}
                    onValueChange={([value]) => setNewRate(value)}
                    min={minRate}
                    max={maxRate}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>${minRate}</span>
                    <span>${maxRate}</span>
                  </div>
                </div>

                {/* Impact Preview */}
                {rateChange !== 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-3 rounded-lg bg-muted/30 border"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Rate change</span>
                      <span className={cn(
                        "font-semibold",
                        rateChange > 0 ? "text-success" : "text-destructive"
                      )}>
                        {rateChange > 0 ? "+" : ""}{rateChange.toFixed(0)}/day
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Monthly impact (est.)
                      </span>
                      <span className={cn(
                        "font-bold",
                        monthlyImpact > 0 ? "text-success" : "text-destructive"
                      )}>
                        {monthlyImpact > 0 ? "+" : ""}${Math.abs(monthlyImpact).toLocaleString()}
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <Separator />

            {/* Date Range Option */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="date-range" className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  Apply to specific dates
                </Label>
                <Switch
                  id="date-range"
                  checked={useDateRange}
                  onCheckedChange={setUseDateRange}
                />
              </div>

              {useDateRange && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "MMM d, yyyy") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "MMM d, yyyy") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                          disabled={(date) => startDate ? date < startDate : false}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </motion.div>
              )}

              {useDateRange && (
                <p className="text-xs text-muted-foreground">
                  Note: Date-specific pricing will be added in a future update. 
                  For now, this will update the base rate.
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <DialogFooter className="px-6 py-4 border-t flex-shrink-0 bg-background gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || newRate === vehicle.current_rate}
            className="flex-1 btn-premium min-h-[44px]"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
