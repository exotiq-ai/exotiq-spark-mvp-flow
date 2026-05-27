import { useState } from "react";
import { AlertCircle, CreditCard, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBillingDunning, type DunningStage } from "@/hooks/useBillingDunning";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

const COPY: Record<
  DunningStage,
  { title: string; body: string; cta: string; tone: "info" | "warning" | "destructive" }
> = {
  reminder: {
    title: "Your free trial has ended",
    body: "Thanks for kicking the tires! Set up billing in a couple of clicks whenever you're ready.",
    cta: "Choose plan",
    tone: "info",
  },
  notice: {
    title: "Payment is past due",
    body: "To keep everything running smoothly, please complete payment setup.",
    cta: "Complete payment",
    tone: "warning",
  },
  restriction: {
    title: "Account access is limited",
    body: "Booking and editing are paused until billing is completed. All historical records remain available.",
    cta: "Complete payment now",
    tone: "destructive",
  },
};

const TONE_CLASSES: Record<"info" | "warning" | "destructive", string> = {
  info: "bg-primary/5 border-primary/30 text-foreground",
  warning: "bg-warning/10 border-warning/40 text-foreground",
  destructive: "bg-destructive/10 border-destructive/40 text-foreground",
};

const ICON_CLASSES: Record<"info" | "warning" | "destructive", string> = {
  info: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
};

const DISMISS_KEY_PREFIX = "exotiq_payment_due_dismissed:";

export const PaymentDueBanner = () => {
  const { stage, message, assumedPlanTier, assumedPlanFleetSize, assumedPlanIsAnnual, setAt } =
    useBillingDunning();
  const { isOwner, isAdmin } = useUserRole();
  const { toast } = useToast();
  const [launching, setLaunching] = useState(false);

  // Reminder stage is dismissible per session (keyed by set time so a fresh flag re-appears)
  const dismissKey = `${DISMISS_KEY_PREFIX}${setAt ?? ""}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return stage === "reminder" && sessionStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });

  if (!stage) return null;
  if (stage === "reminder" && dismissed) return null;

  const copy = COPY[stage];
  const canPay = isOwner || isAdmin;

  const handlePay = async () => {
    if (!assumedPlanTier) {
      // No plan pre-selected — send them to the plan picker
      window.location.href = "/dashboard/settings?tab=billing";
      return;
    }
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          tierId: assumedPlanTier,
          isAnnual: assumedPlanIsAnnual ?? false,
          fleetSize: assumedPlanFleetSize ?? 10,
          returnPath: "/dashboard/settings?tab=billing&status=active",
          cancelPath: "/dashboard?canceled=true",
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No checkout URL returned");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({
        title: "Couldn't open checkout",
        description: err instanceof Error ? err.message : "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className={cn(
        "mb-4 rounded-xl border px-4 py-3 sm:px-5 sm:py-4 flex items-start gap-3 transition-colors",
        TONE_CLASSES[copy.tone]
      )}
    >
      <AlertCircle className={cn("w-5 h-5 mt-0.5 flex-shrink-0", ICON_CLASSES[copy.tone])} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="font-semibold text-sm sm:text-base">{copy.title}</p>
          {stage === "restriction" && (
            <span className="text-xs text-muted-foreground">Read-only mode</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{message || copy.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canPay ? (
            <Button size="sm" onClick={handlePay} disabled={launching}>
              {launching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              {copy.cta}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Please ask your account owner to complete billing setup.
            </p>
          )}
          <a
            href="mailto:support@exotiq.ai?subject=Billing%20question"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Questions? Contact support
          </a>
        </div>
      </div>
      {stage === "reminder" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss"
          className="h-7 w-7 flex-shrink-0"
          onClick={handleDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
