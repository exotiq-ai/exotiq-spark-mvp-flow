import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Gauge, Tag, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/useMoney";
import { currencySymbol } from "@/lib/currencySymbol";
import { MileageSettings } from "@/components/settings/MileageSettings";
import { RateRulesTable } from "@/components/fleet/RateRulesTable";

const VIEWS = [
  { id: "rates", label: "Rates & deposit", icon: Wallet },
  { id: "mileage", label: "Mileage", icon: Gauge },
] as const;
type View = (typeof VIEWS)[number]["id"];

/**
 * Fleet → Pricing: the money rules that belong to the cars, in one place.
 * Views: Rates & deposit (was MotorIQ → Rate Tiers) and Mileage. The view is kept in the URL (?view=).
 */
export const FleetPricingTab = () => {
  const [params, setParams] = useSearchParams();
  const { currency } = useMoney();
  const view: View = params.get("view") === "mileage" ? "mileage" : "rates";

  const choose = (next: View) => {
    const p = new URLSearchParams(params);
    p.set("tab", "pricing");
    p.set("view", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Fleet pricing
          </h2>
          <p className="text-sm text-muted-foreground">
            The rules each car is rented under. Changes apply to bookings made after you save.
          </p>
        </div>
        <div role="group" aria-label="Pricing view" className="inline-flex rounded-lg border p-1 bg-muted/40 self-start">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => choose(v.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm min-h-[40px] transition-colors",
                view === v.id ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <v.icon className="h-4 w-4" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        {view === "rates" ? <RateRulesTable currencySymbol={currencySymbol(currency)} /> : <MileageSettings />}
      </Card>
    </div>
  );
};

export default FleetPricingTab;
