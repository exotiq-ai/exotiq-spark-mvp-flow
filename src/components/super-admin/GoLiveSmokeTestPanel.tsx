/**
 * GoLiveSmokeTestPanel
 *
 * Semi-automated real-money verification of the three money paths after the
 * Stripe live cutover: subscription checkout, one marketplace booking, and a
 * refund. Card entry is manual (Stripe blocks scripted cards on live
 * Checkout); everything either side — creation, capture checks, fee parity,
 * destination-charge routing, refunds and cleanup — is automated and shown
 * as PASS / FAIL per step.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  SCENARIO_LABELS,
  formatCents,
  type SmokeRun,
  type SmokeScenario,
  type SmokeStep,
} from "@/lib/smokeTest";

const SCENARIO_BLURBS: Record<SmokeScenario, string> = {
  subscription:
    "Buys one month of Pro at the live price, confirms the subscription and platform webhook, then cancels and refunds it automatically.",
  marketplace_booking:
    "Books the cheapest live-ready marketplace vehicle for one day with protection declined, then verifies both captured legs against the snapshotted quote.",
  refund:
    "Refunds the booking from the marketplace run through rent-refund-booking and checks Stripe, the booking status and the payment ledger.",
};

const stepIcon = (state: SmokeStep["state"]) => {
  switch (state) {
    case "passed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    case "awaiting_user":
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />;
    default:
      return <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
};

const statusBadge = (run: SmokeRun) => {
  if (run.status === "passed") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">PASS</Badge>;
  if (run.status === "failed") return <Badge variant="destructive">FAIL</Badge>;
  if (run.status === "cancelled") return <Badge variant="outline">Cancelled</Badge>;
  return <Badge variant="secondary">Running</Badge>;
};

export const GoLiveSmokeTestPanel = () => {
  const [runs, setRuns] = useState<SmokeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const loadRuns = useCallback(async () => {
    const { data, error } = await supabase
      .from("smoke_test_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      toast.error("Could not load smoke runs", { description: error.message });
    } else {
      setRuns((data ?? []) as unknown as SmokeRun[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const call = useCallback(
    async (payload: Record<string, unknown>, busyKey: string) => {
      setBusy(busyKey);
      try {
        const { data, error } = await supabase.functions.invoke("admin-smoke-run", { body: payload });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        await loadRuns();
        return data;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error("Smoke run error", { description: message });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [loadRuns],
  );

  const latestPaidBooking = useMemo(
    () =>
      runs.find(
        (r) =>
          r.scenario === "marketplace_booking" &&
          r.status === "passed" &&
          r.cleanup_state !== "done" &&
          Boolean((r.context as Record<string, unknown>)?.booking_ref),
      ),
    [runs],
  );

  const armed = confirmText.trim().toUpperCase() === "RUN LIVE";

  const start = (scenario: SmokeScenario) =>
    call(
      {
        action: "start",
        scenario,
        confirm: "RUN LIVE",
        ...(scenario === "refund" && latestPaidBooking ? { parent_run_id: latestPaidBooking.id } : {}),
      },
      `start-${scenario}`,
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Go-Live smoke tests</CardTitle>
          <CardDescription>
            Real charges on the current Stripe environment, at the smallest amounts we can transact.
            Each run reverses itself: subscriptions are cancelled and refunded, bookings are refunded
            and tagged so they stay out of revenue and P&amp;L.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                These move real money. Type <span className="font-mono font-medium">RUN LIVE</span> to
                arm the start buttons.
              </p>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="smoke-confirm">Confirmation</Label>
              <Input
                id="smoke-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RUN LIVE"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(SCENARIO_LABELS) as SmokeScenario[]).map((scenario) => (
              <div key={scenario} className="rounded-lg border p-4 flex flex-col gap-3">
                <div>
                  <p className="font-medium">{SCENARIO_LABELS[scenario]}</p>
                  <p className="text-sm text-muted-foreground mt-1">{SCENARIO_BLURBS[scenario]}</p>
                </div>
                {scenario === "refund" && !latestPaidBooking && (
                  <p className="text-xs text-amber-600">
                    Needs a passed marketplace booking run that has not been cleaned up yet.
                  </p>
                )}
                <Button
                  className="mt-auto"
                  disabled={
                    !armed ||
                    busy !== null ||
                    (scenario === "refund" && !latestPaidBooking)
                  }
                  onClick={() => start(scenario)}
                >
                  {busy === `start-${scenario}` && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Start run
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>Latest 20 runs with per-step results.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadRuns} disabled={busy !== null}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && runs.length === 0 && (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          )}

          {runs.map((run) => {
            const ctx = (run.context ?? {}) as Record<string, any>;
            const payStep = (run.steps ?? []).find((s) => s.action_url);
            return (
              <div key={run.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{SCENARIO_LABELS[run.scenario]}</span>
                    {statusBadge(run)}
                    <Badge variant="outline" className="uppercase">{run.mode}</Badge>
                    {run.amount_cents > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {formatCents(run.amount_cents, String(ctx.currency ?? "USD"))}
                      </span>
                    )}
                    {ctx.booking_ref && (
                      <span className="text-sm font-mono text-muted-foreground">{ctx.booking_ref}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {payStep?.action_url && payStep.state === "awaiting_user" && (
                      <Button size="sm" asChild>
                        <a href={payStep.action_url} target="_blank" rel="noreferrer">
                          Open Checkout <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null || run.status === "cancelled"}
                      onClick={() => call({ action: "advance", run_id: run.id }, `advance-${run.id}`)}
                    >
                      {busy === `advance-${run.id}` ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Check now
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null || run.cleanup_state === "done"}
                      onClick={() => call({ action: "cleanup", run_id: run.id }, `cleanup-${run.id}`)}
                    >
                      {busy === `cleanup-${run.id}` ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-2" />
                      )}
                      {run.cleanup_state === "done" ? "Cleaned up" : "Clean up"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <ol className="space-y-2">
                  {(run.steps ?? []).map((step) => (
                    <li key={step.key} className="flex items-start gap-2 text-sm">
                      {stepIcon(step.state)}
                      <div className="min-w-0">
                        <p className="font-medium">{step.label}</p>
                        {step.detail && (
                          <p className="text-muted-foreground break-words">{step.detail}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>

                <p className="text-xs text-muted-foreground">
                  {new Date(run.created_at).toLocaleString()} · cleanup: {run.cleanup_state}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
