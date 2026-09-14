import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Crown,
  Calendar,
  Download,
  Loader2,
  Car,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingStatus, TIER_BOUNDS, ENTERPRISE_THRESHOLD } from "@/hooks/useBillingStatus";
import { ActivateSubscriptionDialog } from "@/components/billing/ActivateSubscriptionDialog";
import { Celebration } from "@/components/common/MicroInteractions";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const formatDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";

export const SubscriptionSection = () => {
  const { toast } = useToast();
  const { checkSubscription } = useAuth();
  const billing = useBillingStatus();
  const [isLoading, setIsLoading] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("subscription") === "success") {
      setShowCelebration(true);
      searchParams.delete("subscription");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
      checkSubscription();
    }
  }, []);

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast({
        title: "Couldn't open billing",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const bounds = billing.tier === "enterprise" ? null : TIER_BOUNDS[billing.tier];
  const monthly = bounds ? bounds.perVehicle.month * billing.fleetCount : null;
  const annual = bounds ? bounds.perVehicle.year * billing.fleetCount : null;

  const statusBadge = (() => {
    switch (billing.state) {
      case "grandfathered":
        return { label: "Included", className: "bg-success text-success-foreground" };
      case "trialing":
        return {
          label:
            billing.daysLeftInTrial !== null
              ? `Free trial — ${billing.daysLeftInTrial} ${billing.daysLeftInTrial === 1 ? "day" : "days"} left`
              : "Free trial",
          className: "bg-primary text-primary-foreground",
        };
      case "active":
        return { label: "Active", className: "bg-success text-success-foreground" };
      case "past_due":
        return { label: "Payment failed", className: "bg-warning text-warning-foreground" };
      case "unpaid":
        return { label: "Paused", className: "bg-destructive text-destructive-foreground" };
      case "canceled":
        return { label: "Cancelled", className: "bg-destructive text-destructive-foreground" };
      default:
        return { label: "Not activated", className: "bg-muted text-muted-foreground" };
    }
  })();

  return (
    <div className="space-y-6">
      <Celebration
        trigger={showCelebration}
        message="You're all set 🚀"
        variant="milestone"
        onComplete={() => setShowCelebration(false)}
      />

      {/* Needs a card */}
      {billing.needsActivation && (
        <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-lg font-semibold">Add a card to finish setting up</h3>
                <p className="text-sm text-muted-foreground">
                  Your first 30 days are free. Until a card is on file you can build out your fleet
                  and settings, but you can't take bookings or payments.
                </p>
              </div>
              <Button onClick={() => setActivateOpen(true)}>Activate account</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Payment trouble */}
      {(billing.state === "past_due" || billing.state === "unpaid") && (
        <Card className="p-6 border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-lg font-semibold">
                  {billing.state === "past_due" ? "Your last payment didn't go through" : "Your account is paused"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {billing.state === "past_due"
                    ? "We'll try again shortly. Updating your card now avoids any interruption."
                    : "New bookings and payments are on hold until the balance is settled."}
                </p>
              </div>
              <Button onClick={handleManageBilling} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Update payment method
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Plan summary */}
      <Card className="card-premium border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Your plan</h3>
              <p className="text-sm text-muted-foreground">
                Priced on the vehicles in your fleet — it adjusts on its own.
              </p>
            </div>
          </div>
          <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="text-2xl font-bold">{billing.tierLabel}</p>
            {bounds && (
              <p className="text-xs text-muted-foreground">
                {bounds.min}–{bounds.max} vehicles · {money(bounds.perVehicle.month)} per vehicle
                monthly
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Vehicles</p>
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <p className="text-2xl font-bold">{billing.fleetCount}</p>
            </div>
            {billing.billedQuantity !== null && billing.billedQuantity !== billing.fleetCount && (
              <p className="text-xs text-muted-foreground">
                Billing {billing.billedQuantity} today — the change applies on your next bill.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {billing.onTrial ? "First charge" : "Next charge"}
            </p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">
                {billing.isGrandfathered
                  ? "Not billed"
                  : formatDate(billing.onTrial ? billing.trialEnd : billing.nextChargeAt)}
              </p>
            </div>
            {!billing.isGrandfathered && monthly !== null && annual !== null && (
              <p className="text-xs text-muted-foreground">
                {billing.billingInterval === "year"
                  ? `${money(annual)} per year`
                  : `${money(monthly)} per month`}
              </p>
            )}
            {billing.cancelAtPeriodEnd && (
              <p className="text-xs text-destructive">Cancels at the end of this period.</p>
            )}
          </div>
        </div>

        {billing.isGrandfathered ? (
          <div className="mt-6 flex items-start gap-2 border-t pt-6 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              Your workspace is on our founding-operator terms — nothing to pay and nothing to set
              up. We'll always tell you first if that changes.
            </span>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3 border-t pt-6 sm:flex-row">
            {billing.needsActivation ? (
              <Button className="btn-premium w-full sm:w-auto" onClick={() => setActivateOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Activate account
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleManageBilling}
                  disabled={isLoading}
                  className="btn-premium w-full sm:w-auto"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Manage billing
                </Button>
                <Button variant="outline" className="w-full sm:w-auto" onClick={handleManageBilling}>
                  <Download className="mr-2 h-4 w-4" />
                  Invoices &amp; receipts
                </Button>
              </>
            )}
          </div>
        )}
      </Card>

      {/* How pricing works */}
      <Card className="p-6">
        <h3 className="mb-3 text-lg font-semibold">How your price is worked out</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            Up to {TIER_BOUNDS.pro.max} vehicles: {money(TIER_BOUNDS.pro.perVehicle.month)} per
            vehicle each month.
          </li>
          <li>
            {TIER_BOUNDS.business.min}–{TIER_BOUNDS.business.max} vehicles:{" "}
            {money(TIER_BOUNDS.business.perVehicle.month)} per vehicle each month.
          </li>
          <li>Annual billing gives you two months free.</li>
          <li>
            Add or retire vehicles whenever you like — we recount before each bill, so you only pay
            for what you actually run.
          </li>
          <li>
            Over {ENTERPRISE_THRESHOLD} vehicles we price it with you directly, so nothing is
            charged automatically at that size.
          </li>
        </ul>
      </Card>

      <ActivateSubscriptionDialog open={activateOpen} onOpenChange={setActivateOpen} />
    </div>
  );
};
