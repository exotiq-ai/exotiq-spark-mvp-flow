import { useState } from "react";
import { ChevronDown, Tag, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { BaseChangeOutcome, DateRateOutcome, OutcomeReport } from "@/lib/motoriq/types";
import { cn } from "@/lib/utils";

interface Props {
  outcomes: OutcomeReport;
}

const VERDICT: Record<DateRateOutcome["verdict"] | BaseChangeOutcome["verdict"], { label: string; tone: string }> = {
  held: { label: "Demand held", tone: "border-success/40 text-success" },
  softer: { label: "Softer than similar cars", tone: "border-warning/40 text-warning" },
  "more-bookings": { label: "More bookings than similar cars", tone: "border-success/40 text-success" },
  "fewer-bookings": { label: "Fewer bookings than similar cars", tone: "border-warning/40 text-warning" },
  similar: { label: "About the same as similar cars", tone: "text-muted-foreground" },
  "too-early": { label: "Too early to tell", tone: "text-muted-foreground" },
  "no-comparison": { label: "Not enough similar cars", tone: "text-muted-foreground" },
};

const SHOWN = 5;

/**
 * "What your rate changes earned": the date rates and base-rate changes the tenant made, each measured against similar
 * cars (same type, same market, no change of their own). Evidence, not proof; every line says what it rests on.
 */
export const OutcomesCard = ({ outcomes }: Props) => {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const items = [...outcomes.dateRates, ...outcomes.baseChanges];
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, SHOWN);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border" aria-label="What your rate changes earned">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex min-h-12 w-full items-start justify-between gap-3 px-4 py-3 text-left">
          <span className="min-w-0">
            <span className="block text-sm font-medium">What your rate changes earned</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{outcomes.headline ?? "Not enough finished rate changes to report yet."}</span>
          </span>
          <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-4 pb-4">
        <ul className="space-y-2">
          {shown.map((x) => {
            const v = VERDICT[x.verdict];
            const Icon = x.kind === "date-rate" ? Tag : TrendingUp;
            return (
              <li key={x.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{x.kind === "date-rate" ? "Date rate" : "Base-rate change"}</span>
                  <Badge variant="outline" className={cn("text-[11px] font-normal", v.tone)}>{v.label}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{x.sentence}</p>
                {x.kind === "date-rate" && x.controlCars > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Compared with {x.controlCars} similar {x.controlCars === 1 ? "car" : "cars"}. {x.confidence === "medium" ? "Medium" : "Low"} confidence.</p>
                )}
                {x.kind === "base-rate" && x.controlCars > 0 && x.verdict !== "too-early" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Compared with {x.controlCars} similar {x.controlCars === 1 ? "car" : "cars"}. {x.confidence === "medium" ? "Medium" : "Low"} confidence.</p>
                )}
              </li>
            );
          })}
        </ul>
        {items.length > SHOWN && (
          <button type="button" className="min-h-10 text-xs text-primary hover:underline" onClick={() => setAll((s) => !s)}>
            {all ? "Show fewer" : `Show all ${items.length}`}
          </button>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          This is your own data, compared with similar cars. You chose which cars and dates to change, small samples are noisy, and a night that booked after you set a higher rate might also have booked at your base rate, so treat the extra revenue as an upper bound. I say "not enough to tell" rather than guess.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default OutcomesCard;
