import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, Car, Check, Copy, DollarSign, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useTeam } from "@/contexts/TeamContext";
import { useMoney } from "@/hooks/useMoney";
import { useUserRole } from "@/hooks/useUserRole";
import { niceRange } from "@/lib/motoriq/format";
import type { PriceRecommendation } from "@/lib/motoriq/types";
import { cn } from "@/lib/utils";

interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  status: string;
  current_rate: number;
  image_url?: string | null;
}

interface QuickPriceEditorContentProps {
  vehicle: Vehicle;
  /** MotorIQ's recommendation for this car, when there is one (see lib/motoriq/pricingEngine). */
  recommendation?: PriceRecommendation | null;
  onApplyRate: (vehicleId: string, newRate: number) => Promise<void>;
  onComplete?: () => void;
  /** If true, renders without the vehicle info header (for inline embedding) */
  compact?: boolean;
}

export const QuickPriceEditorContent = ({ vehicle, recommendation, onApplyRate, onComplete, compact = false }: QuickPriceEditorContentProps) => {
  const [newRate, setNewRate] = useState<number>(vehicle.current_rate);
  const [isSaving, setIsSaving] = useState(false);
  const { hasRoleOrHigher } = useUserRole();
  const { currency, money } = useMoney();
  const { currentTeam } = useTeam();

  const suggestion = recommendation && recommendation.action !== "hold" ? recommendation : null;

  useEffect(() => {
    setNewRate(suggestion ? suggestion.recommendedRate : vehicle.current_rate);
  }, [vehicle, suggestion]);

  const rateChange = newRate - vehicle.current_rate;
  const teamMin = Number((currentTeam as any)?.min_rate) || 50;
  const minRate = Math.max(teamMin, Math.floor(vehicle.current_rate * 0.5));
  const maxRate = Math.ceil(vehicle.current_rate * 2);

  const handleSave = async () => {
    if (!hasRoleOrHigher("manager")) {
      toast.error("You don't have permission to change pricing. Please contact your manager.");
      return;
    }
    if (newRate < teamMin) {
      toast.error(`The lowest rate your team allows is ${money(teamMin)}.`);
      return;
    }
    setIsSaving(true);
    try {
      await onApplyRate(vehicle.id, newRate);
      onComplete?.();
    } finally {
      setIsSaving(false);
    }
  };

  const copyQuote = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Quote copied"); } catch { toast.error("Could not copy"); }
  };

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {vehicle.image_url ? <img src={vehicle.image_url} alt={vehicle.name} className="h-full w-full object-cover" /> : <Car className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold">{vehicle.name}</h4>
            <p className="truncate text-xs text-muted-foreground">{vehicle.year} {vehicle.make} {vehicle.model}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-xs text-muted-foreground">Current</div>
            <div className="text-lg font-bold">{money(vehicle.current_rate)}/day</div>
          </div>
        </div>
      )}

      {/* What MotorIQ says, and why */}
      {recommendation && (
        <div className="space-y-3 rounded-lg border border-primary/15 bg-gradient-to-r from-primary/8 to-accent/8 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> MotorIQ
          </div>
          <p className="text-sm">{recommendation.speakable.split(" Confidence")[0]}</p>

          {recommendation.drivers.filter((d) => d.effectPct !== 0 || d.id === "realization").length > 0 && (
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {recommendation.drivers.filter((d) => d.effectPct !== 0 || d.id === "realization").map((d) => (
                <li key={d.id}><span className="font-medium text-foreground">{d.label}.</span> {d.detail} <span className="opacity-70">({d.provenance.source}, {d.provenance.n})</span></li>
              ))}
            </ul>
          )}
          {recommendation.action === "hold" && recommendation.holdReasons.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {recommendation.holdReasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {suggestion?.estimate && (
            <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">If it works:</span> about +{money(suggestion.estimate.extraRevenue)} this week. {suggestion.estimate.assumption}</p>
          )}
          <p className="text-[11px] text-muted-foreground">{recommendation.confidence[0].toUpperCase() + recommendation.confidence.slice(1)} confidence.</p>
        </div>
      )}

      {/* Event quotes for specific dates (not applied here) */}
      {recommendation && recommendation.eventRates.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quotes for event dates</div>
          {recommendation.eventRates.map((e) => {
            const text = `${niceRange(e.from, e.to)}: ${money(e.rate)}/day`;
            return (
              <div key={`${e.from}-${e.to}`} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium"><Calendar className="h-3.5 w-3.5 text-accent" />{niceRange(e.from, e.to)}: {money(e.rate)}/day <span className="text-xs font-normal text-muted-foreground">(+{e.premiumPct}%)</span></div>
                  <div className="truncate text-xs text-muted-foreground">{e.names.slice(0, 3).join(", ")}</div>
                </div>
                <Button size="sm" variant="outline" className="min-h-9 shrink-0" onClick={() => copyQuote(text)}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy</Button>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">Your base rate stays the same. Use these when you quote or edit bookings for those dates.</p>
        </div>
      )}

      <Separator />

      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <DollarSign className="h-4 w-4 text-primary" />
          {suggestion ? "Adjust the base rate" : "Set a new base rate"}
        </h4>
        <div className="space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span>
            <Input type="number" inputMode="decimal" value={newRate} onChange={(e) => setNewRate(Number(e.target.value))} className="h-12 pl-14 pr-12 text-xl font-bold" min={minRate} max={maxRate} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">/day</span>
          </div>
          <div className="px-1">
            <Slider value={[Math.min(maxRate, Math.max(minRate, newRate))]} onValueChange={([value]) => setNewRate(value)} min={minRate} max={maxRate} step={5} className="w-full" />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{money(minRate)}</span><span>{money(maxRate)}</span></div>
          </div>
          {rateChange !== 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Each booked day</span>
                <span className={cn("font-semibold", rateChange > 0 ? "text-success" : "text-destructive")}>{rateChange > 0 ? "+" : "-"}{money(Math.abs(rateChange))}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Applies to new bookings from now on. Guests who already booked keep the price they were given.</p>
            </div>
          )}
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving || newRate === vehicle.current_rate} className="btn-premium min-h-[44px] w-full">
        {isSaving ? "Saving..." : <><Check className="mr-1.5 h-4 w-4" />{suggestion ? `Confirm ${money(newRate)}/day` : "Save changes"}</>}
      </Button>
    </div>
  );
};
