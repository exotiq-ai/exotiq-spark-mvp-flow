import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTeam } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Banknote, 
  Building2, 
  CreditCard, 
  Smartphone, 
  Loader2,
  Info,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Link2
} from "lucide-react";

const PAYMENT_METHOD_OPTIONS = [
  { id: "cash", label: "Cash", icon: Banknote, description: "Accept cash payments" },
  { id: "bank_transfer", label: "Bank Transfer", icon: Building2, description: "Wire or ACH transfer" },
  { id: "credit_card", label: "Credit/Debit Card", icon: CreditCard, description: "Process card payments via Stripe" },
  { id: "zelle", label: "Zelle", icon: Smartphone, description: "Zelle transfers" },
  { id: "venmo", label: "Venmo", icon: Smartphone, description: "Venmo payments" },
  { id: "paypal", label: "PayPal", icon: Smartphone, description: "PayPal payments" },
  { id: "other", label: "Other", icon: Banknote, description: "Custom payment method" },
];

const DEFAULT_METHODS = ["cash", "bank_transfer", "credit_card"];

type ConnectStatus = "not_connected" | "onboarding" | "active" | "restricted";

export const PaymentMethodsSection = () => {
  const { currentTeam, refreshTeam } = useTeam();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [enabledMethods, setEnabledMethods] = useState<string[]>(DEFAULT_METHODS);

  const stripeAccountId = currentTeam?.stripe_account_id ?? null;
  const chargesEnabled = currentTeam?.stripe_charges_enabled ?? false;
  const payoutsEnabled = currentTeam?.stripe_payouts_enabled ?? false;
  const onboardingComplete = currentTeam?.stripe_onboarding_complete ?? false;

  const connectStatus: ConnectStatus = !stripeAccountId
    ? "not_connected"
    : chargesEnabled && payoutsEnabled
    ? "active"
    : onboardingComplete
    ? "restricted"
    : "onboarding";

  useEffect(() => {
    if (currentTeam) {
      const settings = (currentTeam.settings as Record<string, any> | null) || null;
      const saved = settings?.accepted_payment_methods;
      if (Array.isArray(saved) && saved.length > 0) {
        setEnabledMethods(saved);
      }
    }
  }, [currentTeam]);

  const toggleMethod = (methodId: string) => {
    setEnabledMethods(prev => 
      prev.includes(methodId) 
        ? prev.filter(m => m !== methodId)
        : [...prev, methodId]
    );
  };

  const handleSave = async () => {
    if (!currentTeam) return;
    setSaving(true);
    try {
      const currentSettings = (currentTeam.settings as Record<string, any>) || {};
      const { error } = await supabase
        .from('teams')
        .update({ 
          settings: { ...currentSettings, accepted_payment_methods: enabledMethods } 
        } as any)
        .eq('id', currentTeam.id);

      if (error) throw error;
      await refreshTeam();
      toast({ title: "Payment Methods Updated", description: "Your accepted payment methods have been saved." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save payment methods.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: {},
      });

      // Extract structured error body from non-2xx responses
      let errorBody: { error?: string; error_code?: string; action_url?: string } | null = null;
      if (error) {
        try {
          const ctx = (error as any)?.context;
          if (ctx?.response && typeof ctx.response.json === 'function') {
            errorBody = await ctx.response.clone().json();
          }
        } catch { /* ignore parse failure */ }
      }

      if (errorBody?.error_code === 'platform_profile_incomplete') {
        toast({
          title: "Stripe platform setup required",
          description: errorBody.error ?? "Complete your Stripe Connect platform profile to enable tenant onboarding.",
          variant: "destructive",
          action: errorBody.action_url
            ? (
                <ToastAction altText="Open Stripe settings" onClick={() => window.open(errorBody!.action_url!, '_blank')}>
                  Open Stripe
                </ToastAction>
              )
            : undefined,
        });
        return;
      }

      if (error) {
        throw new Error(errorBody?.error || (error as Error).message || 'Failed to start Stripe onboarding.');
      }

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({ title: "Stripe Onboarding", description: "Complete your Stripe setup in the new tab. Refresh this page when done." });
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to start Stripe onboarding.", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleRefreshOnboarding = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-refresh', {
        body: {},
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to refresh onboarding link.", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-dashboard', {
        body: {},
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to open Stripe Dashboard.", variant: "destructive" });
    }
  };

  const handleRefreshStatus = async () => {
    await refreshTeam();
    toast({ title: "Status Refreshed", description: "Payment account status has been updated." });
  };

  return (
    <div className="space-y-6">
      {/* Stripe Connect Card */}
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Payment Processing</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your Stripe account to accept card payments, process holds, and receive payouts.
            </p>
          </div>
          {connectStatus === "active" && (
            <Badge className="bg-success/10 text-success border-success/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Active
            </Badge>
          )}
          {connectStatus === "onboarding" && (
            <Badge variant="secondary">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Onboarding
            </Badge>
          )}
          {connectStatus === "restricted" && (
            <Badge variant="destructive">
              <AlertCircle className="w-3 h-3 mr-1" />
              Restricted
            </Badge>
          )}
        </div>

        {connectStatus === "not_connected" && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-start gap-2">
              <Link2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Connect Your Stripe Account</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Set up your own Stripe Express account to accept card payments from your customers, 
                  place authorization holds for security deposits, and receive payouts directly to your bank account.
                </p>
              </div>
            </div>
            <Button onClick={handleConnectStripe} disabled={connecting}>
              {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Connect Stripe Account
            </Button>
          </div>
        )}

        {connectStatus === "onboarding" && (
          <div className="p-4 rounded-lg bg-warning/5 border border-warning/20 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Complete Your Setup</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your Stripe account has been created but onboarding is not complete. 
                  Please finish the setup to start accepting payments.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRefreshOnboarding} disabled={connecting} variant="outline">
                {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Continue Setup
              </Button>
              <Button onClick={handleRefreshStatus} variant="ghost" size="sm">
                Refresh Status
              </Button>
            </div>
          </div>
        )}

        {connectStatus === "active" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium">Card Payments</span>
                </div>
                <p className="text-xs text-muted-foreground">Enabled</p>
              </div>
              <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium">Payouts</span>
                </div>
                <p className="text-xs text-muted-foreground">Enabled</p>
              </div>
            </div>
            <Button onClick={handleOpenDashboard} variant="outline" className="w-full sm:w-auto">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Stripe Dashboard
            </Button>
          </div>
        )}

        {connectStatus === "restricted" && (
          <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Account Restricted</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your Stripe account has restrictions. This may be due to pending verification. 
                  Please check your Stripe Dashboard for details.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleOpenDashboard} variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Dashboard
              </Button>
              <Button onClick={handleRefreshStatus} variant="ghost" size="sm">
                Refresh Status
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Payment Methods Card */}
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Accepted Payment Methods</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose which payment methods your business accepts.
            </p>
          </div>
        </div>

        {connectStatus !== "active" && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm flex items-start gap-2">
            <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-muted-foreground">
              Connect your Stripe account above to enable card payment processing. Until then, card details are recorded as reference only.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {PAYMENT_METHOD_OPTIONS.map((method) => (
            <div 
              key={method.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <method.icon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{method.label}</span>
                    {method.id === "credit_card" && connectStatus === "active" && (
                      <Badge className="bg-success/10 text-success border-success/30 text-[10px]">Live</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{method.description}</p>
                </div>
              </div>
              <Switch
                checked={enabledMethods.includes(method.id)}
                onCheckedChange={() => toggleMethod(method.id)}
              />
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving || enabledMethods.length === 0} className="w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Save Payment Methods
        </Button>
      </Card>
    </div>
  );
};
