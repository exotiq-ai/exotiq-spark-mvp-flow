import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { type PricingTier } from './PricingData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PlanSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTier: PricingTier | null;
  isAnnual: boolean;
}

export const PlanSelectionModal = ({
  open,
  onOpenChange,
  selectedTier,
  isAnnual,
}: PlanSelectionModalProps) => {
  const [fleetSize, setFleetSize] = useState(selectedTier?.minVehicles || 1);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  if (!selectedTier) return null;

  const pricePerVehicle = isAnnual
    ? Math.round(selectedTier.founderPrice * 10)
    : selectedTier.founderPrice;

  const totalPrice = pricePerVehicle * fleetSize;
  const billingPeriod = isAnnual ? 'year' : 'month';

  const isValidFleetSize =
    fleetSize >= selectedTier.minVehicles && fleetSize <= selectedTier.maxVehicles;

  const handleCheckout = async () => {
    if (!isValidFleetSize) {
      toast({
        title: 'Invalid fleet size',
        description: `The ${selectedTier.name} plan supports ${selectedTier.vehicleRange}.`,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          tierId: selectedTier.id,
          isAnnual,
          fleetSize,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout failed',
        description: error.message || 'Unable to start checkout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lock in {selectedTier.name} Plan</DialogTitle>
          <DialogDescription>
            Secure your founder pricing before it expires
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Plan Summary */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{selectedTier.name} Plan</span>
              <Badge variant="outline" className="text-success border-success/30">
                Founder Price
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{selectedTier.vehicleRange}</p>
          </div>

          {/* Fleet Size Input */}
          <div className="space-y-2">
            <Label htmlFor="fleetSize">Number of Vehicles</Label>
            <Input
              id="fleetSize"
              type="number"
              min={selectedTier.minVehicles}
              max={selectedTier.maxVehicles}
              value={fleetSize}
              onChange={(e) => setFleetSize(parseInt(e.target.value) || 1)}
            />
            {!isValidFleetSize && (
              <p className="text-xs text-destructive">
                This plan supports {selectedTier.vehicleRange}
              </p>
            )}
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <span className="text-sm">Billing</span>
            <span className="font-medium">
              {isAnnual ? 'Annual (2 months free)' : 'Monthly'}
            </span>
          </div>

          {/* Price Calculation */}
          <div className="space-y-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex justify-between text-sm">
              <span>
                ${selectedTier.founderPrice}/vehicle/{isAnnual ? 'month' : 'month'}
              </span>
              <span>x {fleetSize} vehicles</span>
            </div>
            {isAnnual && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>x 10 months (2 free)</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-primary/20">
              <span>Total</span>
              <span className="text-primary">
                ${totalPrice.toLocaleString()}/{billingPeriod}
              </span>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            {selectedTier.features.slice(0, 4).map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Checkout Button */}
          <Button
            className="w-full h-12"
            onClick={handleCheckout}
            disabled={isLoading || !isValidFleetSize}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Continue to Payment
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You will be redirected to secure checkout. Your card will not be charged during the 14-day trial.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
