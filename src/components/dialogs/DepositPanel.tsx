import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CreditCard, Loader2, AlertTriangle, Lock, Unlock, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMoney } from "@/hooks/useMoney";

type DepositPayment = {
  id: string;
  stripe_payment_intent_id: string | null;
  hold_status: string | null;
  payment_status: string | null;
  amount: number | null;
  transaction_date: string | null;
};

interface Props {
  booking: {
    id: string;
    vehicle_id: string | null;
    booking_source?: string | null;
    status?: string | null;
    operator_stripe_customer_id?: string | null;
  };
  onRefresh?: () => void;
}

// Optional operator tool. As of 2026-07-28 Exotiq no longer collects or
// mediates security deposits — renters settle the deposit with the operator
// at pickup by whatever method that operator accepts. Operators may
// optionally use their own Stripe account to place a hold on a card the
// renter provided at pickup; this panel is where they do that. Nothing here
// is a required step in the booking flow, and no email is sent to the renter.
export function DepositPanel({ booking, onRefresh }: Props) {
  const { toast } = useToast();
  const { money: fmtMoney } = useMoney();
  const [depositCents, setDepositCents] = useState<number | null>(null);
  const [latest, setLatest] = useState<DepositPayment | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);

  const refresh = async () => {
    if (!booking.vehicle_id) return;
    setLoading(true);
    try {
      const { data: dep } = await supabase.rpc("resolve_deposit_cents", { _vehicle_id: booking.vehicle_id });
      setDepositCents(dep != null ? Number(dep) : null);
      const { data: pays } = await supabase
        .from("payments")
        .select("id, stripe_payment_intent_id, hold_status, payment_status, amount, transaction_date")
        .eq("booking_id", booking.id)
        .eq("payment_type", "security_deposit")
        .order("transaction_date", { ascending: false })
        .limit(1);
      setLatest((pays?.[0] as DepositPayment) ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [booking.id, booking.vehicle_id]);

  if (booking.booking_source !== "marketplace" || !["confirmed", "in_progress"].includes(booking.status ?? "")) {
    return null;
  }

  const hasCardOnFile = !!booking.operator_stripe_customer_id;
  const holdActive = latest?.hold_status === "authorized" || latest?.payment_status === "requires_capture";
  const holdAgeDays = latest?.transaction_date
    ? Math.floor((Date.now() - new Date(latest.transaction_date).getTime()) / 86_400_000)
    : null;
  const expiring = holdActive && holdAgeDays != null && holdAgeDays >= 5;

  const invoke = async (fn: string, body: Record<string, unknown>, label: string) => {
    setAction(label);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      const payload = data as { error?: string; requires_action?: boolean; message?: string } | null;
      if (payload?.error === "no_card_on_file") {
        toast({
          title: "No card on file",
          description: "Save a card on the operator's Stripe account before placing a hold.",
          variant: "destructive",
        });
        return;
      }
      if (payload?.error) throw new Error(payload.message ?? payload.error);
      toast({ title: `${label} succeeded` });
      await refresh();
      onRefresh?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: `${label} failed`, description: msg, variant: "destructive" });
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Deposit at pickup (optional)</h4>
        </div>
        <div className="text-sm font-mono">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : depositCents != null ? fmtMoney(depositCents / 100) : "—"}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Exotiq does not collect the security deposit. You settle it with the renter at pickup
        (card, cash, or your own terminal). If you want to run a card hold on your own Stripe
        account, you can do it here — this is an optional operator tool, never a required step.
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          {hasCardOnFile ? <Check className="h-3 w-3 text-success" /> : <CreditCard className="h-3 w-3 text-muted-foreground" />}
          <span className={hasCardOnFile ? "" : "text-muted-foreground"}>
            {hasCardOnFile ? "Card on file" : "No card on file"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {holdActive ? (
            <>
              <Lock className="h-3 w-3 text-warning" />
              <span>Hold active{holdAgeDays != null ? ` · ${holdAgeDays}d` : ""}</span>
              {expiring && <Badge variant="destructive" className="text-[10px] px-1">expiring</Badge>}
            </>
          ) : latest?.hold_status === "captured" ? (
            <><Check className="h-3 w-3 text-success" /> <span>Captured</span></>
          ) : latest?.hold_status === "released" ? (
            <><Unlock className="h-3 w-3 text-muted-foreground" /> <span>Released</span></>
          ) : (
            <><span className="text-muted-foreground">No hold placed</span></>
          )}
        </div>
      </div>

      {expiring && (
        <div className="flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3 w-3 mt-0.5" />
          <span>Authorization expires ~7d after placement. Release or capture soon.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {hasCardOnFile && !holdActive && (
          <Button
            size="sm"
            disabled={!!action}
            onClick={() => invoke("stripe-create-hold", { booking_id: booking.id, mode: "off_session" }, "Place hold")}
          >
            {action === "Place hold" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Lock className="h-3 w-3 mr-1" />}
            Place hold
          </Button>
        )}
        {holdActive && latest?.stripe_payment_intent_id && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={!!action}
              onClick={() => invoke("stripe-release-hold", { payment_intent_id: latest.stripe_payment_intent_id, booking_id: booking.id }, "Release")}
            >
              <Unlock className="h-3 w-3 mr-1" /> Release
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!!action}
              onClick={() => invoke("stripe-capture-hold", { payment_intent_id: latest.stripe_payment_intent_id, booking_id: booking.id }, "Capture")}
            >
              <CreditCard className="h-3 w-3 mr-1" /> Capture
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
