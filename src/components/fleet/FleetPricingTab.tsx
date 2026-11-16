import { Card } from "@/components/ui/card";
import { Tag } from "lucide-react";
import { MileageSettings } from "@/components/settings/MileageSettings";

/**
 * Fleet → Pricing: the money rules that belong to the cars, in one place.
 * Today: mileage (team default + each car). Rate tiers, deposits, minimum rate and the gas fee move here next.
 */
export const FleetPricingTab = () => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Tag className="h-5 w-5 text-primary" />
        Fleet pricing
      </h2>
      <p className="text-sm text-muted-foreground">
        The rules each car is rented under. Changes apply to bookings made after you save.
      </p>
    </div>
    <Card className="p-4 sm:p-6">
      <MileageSettings />
    </Card>
  </div>
);

export default FleetPricingTab;
