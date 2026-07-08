import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, DollarSign } from 'lucide-react';
import { useMoney } from '@/hooks/useMoney';

interface PriceOptimizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Array<{ id: string; name: string; current_rate: number; suggested_rate: number | null; }>;
  onApply: (vehicleId: string, newRate: number) => void;
}

export const PriceOptimizationDialog = ({ open, onOpenChange, vehicles, onApply }: PriceOptimizationDialogProps) => {
  const { money } = useMoney();
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const [newRate, setNewRate] = useState(selectedVehicle?.suggested_rate || selectedVehicle?.current_rate || 0);

  const increase = newRate - (selectedVehicle?.current_rate || 0);
  const percentIncrease = ((increase / (selectedVehicle?.current_rate || 1)) * 100).toFixed(1);

  const handleApply = () => {
    if (selectedVehicleId) {
      onApply(selectedVehicleId, newRate);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>AI Price Optimization</span>
          </DialogTitle>
          <DialogDescription>Adjust daily rates based on market demand analysis</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Vehicle</label>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Current Rate</div>
              <div className="text-2xl font-bold">{money(selectedVehicle?.current_rate ?? 0)}</div>
            </div>
            <div className="p-4 rounded-xl bg-primary/10">
              <div className="text-sm text-muted-foreground mb-1">AI Suggested</div>
              <div className="text-2xl font-bold text-primary">{money(selectedVehicle?.suggested_rate ?? selectedVehicle?.current_rate ?? 0)}</div>
              <div className="text-xs text-success">+{percentIncrease}%</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Adjust Rate</label>
              <Badge variant="outline" className="text-lg">{money(newRate)}</Badge>
            </div>
            <Slider value={[newRate]} onValueChange={(v) => setNewRate(v[0])} min={selectedVehicle?.current_rate || 0} max={(selectedVehicle?.current_rate || 0) + 200} step={10} />
          </div>

          <div className="p-4 rounded-xl bg-success/5 border border-success/20">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="h-4 w-4 text-success" />
              <span className="font-semibold text-success">Revenue Impact</span>
            </div>
            <div className="text-xl font-bold text-success">+${(increase * 30).toFixed(0)}/month</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleApply}><TrendingUp className="h-4 w-4 mr-2" />Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
