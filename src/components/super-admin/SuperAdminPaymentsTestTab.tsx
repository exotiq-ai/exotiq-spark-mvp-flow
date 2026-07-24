/**
 * SuperAdminPaymentsTestTab
 *
 * One-shot M6 payment-sandbox tools. Currently exposes the
 * admin-create-test-connect utility so a super admin can spin up a Stripe
 * test-mode Express Connect account for a tenant without touching SQL.
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wallet, Loader2, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

const EXOTIQ_TEAM_ID = "c1de6533-ab44-4973-a123-007a8007b5ba";
const EXOTIQ_EMAIL = "hello@exotiq.ai";
const EXOTIQ_COMPANY = "Exotiq (Test)";

interface CreateResult {
  ok: true;
  stripe_account_id: string;
  onboarding_url: string | null;
  onboarding_error: unknown | null;
}

export const SuperAdminPaymentsTestTab = () => {
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState(EXOTIQ_COMPANY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createTestAccount = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("You must be signed in as a super admin to create a test account.");
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-test-connect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            team_id: EXOTIQ_TEAM_ID,
            email: EXOTIQ_EMAIL,
            company_name: companyName,
          }),
        }
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      setResult(body as CreateResult);
      toast({ title: "Test Connect account created", description: body.stripe_account_id });
      await supabase.rpc("log_admin_action", {
        p_action: "create_test_connect_account",
        p_details: {
          team_id: EXOTIQ_TEAM_ID,
          email: EXOTIQ_EMAIL,
          stripe_account_id: body.stripe_account_id,
        },
      });
    } catch (e: any) {
      setError(e.message || "Unknown error");
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <CardTitle>M6 Payments Sandbox</CardTitle>
        </div>
        <CardDescription>
          Tools for testing the renter marketplace payment flow. These actions only write to Stripe
          test mode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Create Exotiq test Connect account</h3>
              <p className="text-sm text-muted-foreground">
                Team: <span className="font-mono">{EXOTIQ_TEAM_ID}</span> ·{" "}
                <span className="font-mono">{EXOTIQ_EMAIL}</span>
              </p>
            </div>
            <Badge variant="outline">Test mode</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company name passed to Stripe</Label>
            <Input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Exotiq (Test)"
            />
          </div>

          <Button
            onClick={createTestAccount}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create test Connect account
          </Button>

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Stripe account ID</p>
                <p className="text-sm font-mono">{result.stripe_account_id}</p>
              </div>
              {result.onboarding_url ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Onboarding URL</p>
                  <a
                    href={result.onboarding_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Open Stripe onboarding <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <p className="text-sm text-amber-600">
                  No onboarding URL was returned. You may need to finish the account in the Stripe
                  dashboard.
                </p>
              )}
              {result.onboarding_error && (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify(result.onboarding_error, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
