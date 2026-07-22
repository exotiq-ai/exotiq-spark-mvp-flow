import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeam } from "@/contexts/TeamContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  SUPPORTED_COUNTRIES,
  getCountryDefaults,
} from "@/lib/countryDefaults";
import { formatMoney } from "@/lib/format";
import { Globe, Building2, Receipt, Save } from "lucide-react";

interface BusinessAddress {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
}

export const BusinessProfileSection = () => {
  const { currentTeam, refreshTeam } = useTeam();
  const { isOwner, isAdmin } = useUserRole();
  const { toast } = useToast();

  const canEdit = isOwner || isAdmin;

  // Form state — initialised from team
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("US");
  const [currency, setCurrency] = useState("USD");
  const [locale, setLocale] = useState("en-US");
  const [taxLabel, setTaxLabel] = useState("Tax");
  const [taxRate, setTaxRate] = useState<string>("0");
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [vatNumber, setVatNumber] = useState("");
  const [address, setAddress] = useState<BusinessAddress>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentTeam) return;
    setBusinessName(currentTeam.name || "");
    setCountry(currentTeam.country_code || "US");
    setCurrency(currentTeam.currency || "USD");
    setLocale(currentTeam.locale || "en-US");
    setTaxLabel(currentTeam.tax_label || "Tax");
    setTaxRate(String(currentTeam.tax_rate_percent ?? 0));
    setTaxInclusive(!!currentTeam.tax_inclusive);
    setVatNumber(currentTeam.vat_number || "");
    setAddress((currentTeam.business_address as BusinessAddress) || {});
  }, [currentTeam]);


  const countryDef = useMemo(() => getCountryDefaults(country), [country]);

  // When country changes, prefill the derived defaults (user can still override)
  const handleCountryChange = (next: string) => {
    setCountry(next);
    const def = getCountryDefaults(next);
    setCurrency(def.currency);
    setLocale(def.locale);
    setTaxLabel(def.tax_label);
    setTaxRate(String(def.tax_rate_percent));
    setTaxInclusive(def.tax_inclusive);
  };

  const handleSave = async () => {
    if (!currentTeam || !canEdit) return;

    const trimmedName = businessName.trim();
    if (trimmedName.length < 2) {
      toast({
        title: "Business name required",
        description: "Please enter your business name (at least 2 characters).",
        variant: "destructive",
      });
      return;
    }

    const rate = parseFloat(taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast({
        title: "Invalid tax rate",
        description: "Tax rate must be between 0 and 100.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Rename via RPC (handles slug regen when safe)
      if (trimmedName !== (currentTeam.name ?? "").trim()) {
        const { error: renameErr } = await supabase.rpc("rename_team", {
          _team_id: currentTeam.id,
          _new_name: trimmedName,
        });
        if (renameErr) throw renameErr;

        // Keep profiles.company_name aligned so it doesn't drift
        try {
          await supabase
            .from("profiles")
            .update({ company_name: trimmedName })
            .eq("id", currentTeam.owner_id as any);
        } catch (e) {
          console.warn("[BusinessProfile] company_name sync failed", e);
        }
      }

      const { error } = await supabase
        .from("teams")
        .update({
          country_code: country.toUpperCase(),
          currency: currency.toUpperCase(),
          locale,
          tax_label: taxLabel.trim() || "Tax",
          tax_rate_percent: rate,
          tax_inclusive: taxInclusive,
          vat_number: vatNumber.trim() || null,
          business_address: address as any,
        } as any)
        .eq("id", currentTeam.id);

      if (error) throw error;

      await refreshTeam();
      toast({
        title: "Business profile saved",
        description: `Business name, currency, ${taxLabel.toLowerCase()} settings, and address updated.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Could not save",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  const previewAmount = useMemo(
    () => formatMoney(1234.56, { currency, locale, decimals: 2 }),
    [currency, locale],
  );

  if (!canEdit) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">
          Only team owners or admins can change business profile settings.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Region & currency */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Region & currency</h3>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Selecting a country pre-fills currency, number formatting, and tax
          defaults. Each value remains individually editable.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={country} onValueChange={handleCountryChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_COUNTRIES.map((c) => (
                  <SelectItem key={c.country_code} value={c.country_code}>
                    {c.country_name} ({c.country_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Currency (ISO 4217)</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
              maxLength={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Locale (BCP 47)</Label>
            <Input
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              placeholder="en-US"
            />
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="h-10 px-3 flex items-center rounded-md border bg-muted/30 text-sm">
              {previewAmount}
            </div>
          </div>
        </div>
      </Card>

      {/* Tax / VAT */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Tax & VAT</h3>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Applied to booking totals. Set the rate to 0 to disable tax lines on
          bookings and receipts.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tax label</Label>
            <Input
              value={taxLabel}
              onChange={(e) => setTaxLabel(e.target.value)}
              placeholder="Tax / VAT / GST"
            />
          </div>
          <div className="space-y-2">
            <Label>Tax rate (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">
                Rates quoted include {taxLabel.toLowerCase()}
              </div>
              <div className="text-xs text-muted-foreground">
                On — daily rate is treated as gross (UK / EU pattern). Off —
                tax is added on top (US pattern).
              </div>
            </div>
            <Switch checked={taxInclusive} onCheckedChange={setTaxInclusive} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>
              {countryDef.tax_id_label || "Tax registration number"}{" "}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder={
                country === "GB"
                  ? "GB123456789"
                  : country === "AU"
                  ? "12 345 678 901"
                  : ""
              }
            />
          </div>
        </div>
      </Card>

      {/* Business address (used on VAT invoices) */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Business address</h3>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Printed on tax invoices and receipts.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label>Address line 1</Label>
            <Input
              value={address.line1 || ""}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Address line 2</Label>
            <Input
              value={address.line2 || ""}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input
              value={address.city || ""}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>State / Region</Label>
            <Input
              value={address.region || ""}
              onChange={(e) =>
                setAddress({ ...address, region: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Postal code</Label>
            <Input
              value={address.postal_code || ""}
              onChange={(e) =>
                setAddress({ ...address, postal_code: e.target.value })
              }
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save business profile"}
        </Button>
      </div>
    </div>
  );
};
