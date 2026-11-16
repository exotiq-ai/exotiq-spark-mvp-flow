import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers } from "lucide-react";

/** MotorIQ → Rate Tiers now lives in Fleet → Pricing; this card points there for people used to the old place. */
export const RateTiersMovedCard = () => (
  <Card className="p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
    <div className="flex gap-3">
      <Layers className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">Rate tiers have moved to Fleet → Pricing</p>
        <p className="text-sm text-muted-foreground mt-1">
          Daily, 3-hour, 6-hour and multi-day rates and each car's deposit hold are now edited next to the cars,
          with mileage rules. MotorIQ keeps the suggestions and forecasts.
        </p>
      </div>
    </div>
    <Button asChild className="shrink-0">
      <Link to="/dashboard/fleet?tab=pricing&view=rates">
        Open Fleet → Pricing <ArrowRight className="h-4 w-4 ml-2" />
      </Link>
    </Button>
  </Card>
);

export default RateTiersMovedCard;
