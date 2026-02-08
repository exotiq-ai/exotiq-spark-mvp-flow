import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useTeam } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Banknote, 
  Building2, 
  CreditCard, 
  Smartphone, 
  Loader2,
  Info
} from "lucide-react";

const PAYMENT_METHOD_OPTIONS = [
  { id: "cash", label: "Cash", icon: Banknote, description: "Accept cash payments" },
  { id: "bank_transfer", label: "Bank Transfer", icon: Building2, description: "Wire or ACH transfer" },
  { id: "credit_card", label: "Credit/Debit Card", icon: CreditCard, description: "Manual card recording (Stripe Connect coming soon)" },
  { id: "zelle", label: "Zelle", icon: Smartphone, description: "Zelle transfers" },
  { id: "venmo", label: "Venmo", icon: Smartphone, description: "Venmo payments" },
  { id: "paypal", label: "PayPal", icon: Smartphone, description: "PayPal payments" },
  { id: "other", label: "Other", icon: Banknote, description: "Custom payment method" },
];

const DEFAULT_METHODS = ["cash", "bank_transfer", "credit_card"];

export const PaymentMethodsSection = () => {
  const { currentTeam, refreshTeam } = useTeam();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [enabledMethods, setEnabledMethods] = useState<string[]>(DEFAULT_METHODS);

  useEffect(() => {
    if (currentTeam) {
      const settings = (currentTeam as any).settings as Record<string, any> | null;
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
      const currentSettings = ((currentTeam as any).settings as Record<string, any>) || {};
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

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Accepted Payment Methods</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Choose which payment methods your business accepts.
          </p>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm flex items-start gap-2">
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-muted-foreground">
          Credit card processing will be available once Stripe Connect is activated. Until then, card details are recorded as reference only — not stored or charged.
        </p>
      </div>

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
                  {method.id === "credit_card" && (
                    <Badge variant="outline" className="text-xs">Stripe Connect Soon</Badge>
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
  );
};
