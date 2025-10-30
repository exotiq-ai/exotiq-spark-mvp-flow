import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { TrendingUp, DollarSign, Calendar } from 'lucide-react';

interface PriceOptimizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: {
    name: string;
    currentRate: number;
    suggestedRate: number;
  };
  onApply: (newRate: number) => void;
}

export const PriceOptimizationDialog = ({
  open,
  onOpenChange,
  vehicle,
  onApply
}: PriceOptimizationDialogProps) => {
  const [selectedRate, setSelectedRate] = useState(vehicle.suggestedRate);
  
  const increase = selectedRate - vehicle.currentRate;
  const percentIncrease = ((increase / vehicle.currentRate) * 100).toFixed(1);
  const weeklyRevenue = increase * 7;
  const monthlyRevenue = increase * 30;

  const handleApply = () => {
    onApply(selectedRate);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>AI Price Optimization</span>
          </DialogTitle>
          <DialogDescription>
            Adjust the daily rate for {vehicle.name} based on market demand analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current vs Suggested */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Current Rate</div>
              <div className="text-2xl font-bold">${vehicle.currentRate}</div>
              <div className="text-xs text-muted-foreground">per day</div>
            </div>
            <div className="p-4 rounded-xl bg-primary/10 border-2 border-primary/20">
              <div className="text-sm text-muted-foreground mb-1">AI Suggested</div>
              <div className="text-2xl font-bold text-primary">${vehicle.suggestedRate}</div>
              <div className="text-xs text-success">+{percentIncrease}% increase</div>
            </div>
          </div>

          {/* Rate Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Adjust Rate</label>
              <Badge variant="outline" className="text-lg font-bold">
                ${selectedRate}
              </Badge>
            </div>
            <Slider
              value={[selectedRate]}
              onValueChange={(value) => setSelectedRate(value[0])}
              min={vehicle.currentRate}
              max={vehicle.currentRate + 200}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>${vehicle.currentRate}</span>
              <span>${vehicle.currentRate + 200}</span>
            </div>
          </div>

          {/* Revenue Impact */}
          <div className="p-4 rounded-xl bg-success/5 border border-success/20">
            <div className="flex items-center space-x-2 mb-3">
              <DollarSign className="h-4 w-4 text-success" />
              <span className="font-semibold text-success">Projected Revenue Impact</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Weekly</div>
                <div className="text-xl font-bold text-success">+${weeklyRevenue}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Monthly</div>
                <div className="text-xl font-bold text-success">+${monthlyRevenue}</div>
              </div>
            </div>
          </div>

          {/* AI Confidence */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">AI Confidence Score</span>
            </div>
            <Badge className="bg-success/20 text-success">89% High</Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} className="bg-success hover:bg-success/90">
            <TrendingUp className="h-4 w-4 mr-2" />
            Apply Optimization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
