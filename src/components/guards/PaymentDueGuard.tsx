import { useState } from "react";
import { AlertCircle, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBillingDunning, TIER_BOUNDS } from "@/hooks/useBillingDunning";
import { useUserRole } from "@/hooks/useUserRole";

interface PaymentDueGuardProps {
  /** What to render when the team is not under restriction. */
  children: React.ReactNode;
  /** Optional override for the headline. */
  title?: string;
  /** Optional override for the body copy. */
  body?: string;
}

/**
 * Renders `children` normally, unless the team's billing dunning stage is
 * `restriction`, in which case it shows a polite "complete payment" notice
 * in place of the children. Use this around create/edit booking forms so
 * mutations are blocked while keeping read access elsewhere intact.
 */
export const PaymentDueGuard = ({ children, title, body }: PaymentDueGuardProps) => {
  const { stage, assumedPlanTier, assumedPlanFleetSize, assumedPlanIsAnnual } =
    useBillingDunning();
  const { isOwner, isAdmin } = useUserRole();
  const { toast } = useToast();
  const [launching, setLaunching] = useState(false);

  if (stage !== "restriction") return <>{children}</>;

  const canPay = isOwner || isAdmin;

  const isEnterprise = assumedPlanTier === "enterprise";

  const handlePay = async () => {
    if (isEnterprise) {
      window.location.href =
        "mailto:sales@exotiq.ai?subject=Enterprise%20billing%20setup";
      return;
    }
    const bounds = assumedPlanTier ? TIER_BOUNDS[assumedPlanTier] : null;
    const fleet = assumedPlanFleetSize ?? 0;
    if (!assumedPlanTier || !bounds || fleet < bounds.min || fleet > bounds.max) {
      window.location.href = "/dashboard/settings?tab=billing";
      return;
    }
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          tierId: assumedPlanTier,
          isAnnual: assumedPlanIsAnnual ?? false,
          fleetSize: fleet,
          returnPath: "/dashboard/settings?tab=billing&subscription=success",
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

  return (
    <div className="p-8 sm:p-10 flex flex-col items-center text-center gap-4 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-destructive" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">{title ?? "Account access is limited"}</h3>
        <p className="text-sm text-muted-foreground">
          {body ??
            "Booking changes are paused until billing is completed. All historical records remain available."}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 pt-2 w-full">
        {canPay ? (
          <Button onClick={handlePay} disabled={launching} className="w-full sm:w-auto">
            {launching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4 mr-2" />
            )}
            {isEnterprise ? "Contact sales" : "Complete payment"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
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
  );
};

/**
 * Hook helper: returns a function that, when called, returns `true` and shows
 * a toast if the team is under payment restriction. Use at the top of save /
 * mutation handlers to no-op them with a clear message.
 *
 *   const blockIfRestricted = useBlockIfRestricted();
 *   const handleSave = async () => {
 *     if (blockIfRestricted()) return;
 *     // ...mutate...
 *   };
 */
export const useBlockIfRestricted = () => {
  const { stage } = useBillingDunning();
  const { toast } = useToast();
  return () => {
    if (stage !== "restriction") return false;
    toast({
      title: "Payment required",
      description: "Complete billing setup to make booking changes.",
      variant: "destructive",
    });
    return true;
  };
};
