import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickPriceEditorContent } from "@/components/pricing/QuickPriceEditorContent";
import type { PricingContext } from "@/components/dashboard/DynamicPricingCard";

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
  pricingContext?: PricingContext | null;
}

export const QuickPriceEditorDialog = ({
  open,
  onOpenChange,
  vehicle,
  onApplyRate,
  pricingContext,
}: QuickPriceEditorDialogProps) => {
  if (!vehicle) return null;

  const hasAIContext = !!pricingContext;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              hasAIContext ? "bg-gradient-to-br from-primary/20 to-accent/20" : "bg-primary/10"
            )}>
              {hasAIContext ? (
                <Sparkles className="h-5 w-5 text-primary" />
              ) : (
                <DollarSign className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <span className="block">
                {hasAIContext ? "AI Price Recommendation" : "Edit Pricing"}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {vehicle.name}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4">
            <QuickPriceEditorContent
              vehicle={vehicle}
              pricingContext={pricingContext}
              onApplyRate={onApplyRate}
              onComplete={() => onOpenChange(false)}
            />
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-3 border-t flex-shrink-0 bg-background">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
