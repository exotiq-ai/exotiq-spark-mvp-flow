import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useMoney } from "@/hooks/useMoney";
import { cn } from "@/lib/utils";
import type { PriceRecommendation } from "@/lib/motoriq/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendations: PriceRecommendation[];
  onApply: (vehicleId: string, newRate: number) => Promise<void>;
}

/** Review, untick what you disagree with, then apply. Shows the previous rates so a change is easy to reverse. */
export const ApplyRatesDialog = ({ open, onOpenChange, recommendations, onApply }: Props) => {
  const { money } = useMoney();
  const { toast } = useToast();
  const changes = useMemo(() => recommendations.filter((r) => r.action !== "hold"), [recommendations]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // start with the confident ones ticked
  useEffect(() => {
    if (open) setSelected(new Set(changes.filter((r) => r.confidence !== "low").map((r) => r.vehicleId)));
  }, [open, changes]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const apply = async () => {
    const chosen = changes.filter((r) => selected.has(r.vehicleId));
    if (!chosen.length) return;
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const r of chosen) {
      try { await onApply(r.vehicleId, r.recommendedRate); ok++; } catch { failed.push(r.name); }
    }
    setBusy(false);
    toast({
      title: ok ? `${ok} ${ok === 1 ? "rate" : "rates"} updated` : "No rates were updated",
      description: failed.length
        ? `Could not update: ${failed.join(", ")}.`
        : `Previous rates: ${chosen.slice(0, 3).map((r) => `${r.name} ${money(r.currentRate)}`).join(", ")}${chosen.length > 3 ? ` and ${chosen.length - 3} more` : ""}.`,
      variant: failed.length && !ok ? "destructive" : undefined,
    });
    if (!failed.length) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Review rate changes</DialogTitle>
          <DialogDescription>
            These change each car's base daily rate from now until you change it again. Event quotes for specific dates are separate and are not applied here.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-3">
          {changes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No rate changes are suggested right now.</p>
          ) : (
            <ul className="space-y-2">
              {changes.map((r) => {
                const on = selected.has(r.vehicleId);
                return (
                  <li key={r.vehicleId}>
                    <label className={cn("flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3", on ? "border-primary/40 bg-primary/5" : "")}>
                      <Checkbox checked={on} onCheckedChange={() => toggle(r.vehicleId)} className="mt-0.5" aria-label={`Apply to ${r.name}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-medium">{r.name}</span>
                          <span className="tabular-nums text-sm">
                            {money(r.currentRate)} <span className="text-muted-foreground">to</span> <strong>{money(r.recommendedRate)}</strong>{" "}
                            <span className={r.action === "raise" ? "text-success" : "text-warning"}>({r.changePct > 0 ? "+" : ""}{Math.round(r.changePct * 100)}%)</span>
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.drivers.find((d) => d.effectPct !== 0)?.label}. {r.confidence} confidence.
                          {r.estimate ? ` If open days fill as usual: about +${money(r.estimate.extraRevenue)} this week.` : ""}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={apply} disabled={busy || selected.size === 0}>
            {busy ? "Updating..." : `Apply ${selected.size} ${selected.size === 1 ? "change" : "changes"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApplyRatesDialog;
