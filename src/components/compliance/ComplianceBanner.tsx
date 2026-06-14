import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTeam } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { featureFlags } from "@/lib/featureFlags";
import { LEGAL_DOCS } from "@/lib/legal/versions";

const DISMISS_KEY_PREFIX = "exotiq.compliance-banner.dismissed.";

/**
 * Persistent (but dismissible) dashboard banner shown to EU/UK operators
 * with an incomplete compliance posture: missing jurisdiction, missing DPA
 * execution, or pending privacy-notice acknowledgement.
 *
 * Hidden behind featureFlags.complianceEuUk until attorney-reviewed legal
 * docs are published.
 */
export const ComplianceBanner = () => {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const [dpaAccepted, setDpaAccepted] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const jurisdiction = (currentTeam as any)?.primary_jurisdiction as
    | string
    | undefined;
  const isEuUk = jurisdiction === "eu" || jurisdiction === "uk";

  useEffect(() => {
    if (!user || !isEuUk) return;
    (async () => {
      const { data } = await supabase
        .from("terms_acceptances")
        .select("documents_accepted")
        .eq("user_id", user.id)
        .order("accepted_at", { ascending: false })
        .limit(50);
      const accepted = (data ?? []).some((row: any) =>
        (row.documents_accepted ?? []).some(
          (d: any) =>
            d.document_type === "dpa" && d.version === LEGAL_DOCS.dpa.version
        )
      );
      setDpaAccepted(accepted);
    })();
  }, [user?.id, isEuUk]);

  useEffect(() => {
    if (!currentTeam?.id) return;
    setDismissed(
      window.sessionStorage.getItem(DISMISS_KEY_PREFIX + currentTeam.id) === "1"
    );
  }, [currentTeam?.id]);

  if (!featureFlags.complianceEuUk) return null;
  if (!currentTeam) return null;
  if (dismissed) return null;

  const needsJurisdiction = !jurisdiction;
  const needsDpa = isEuUk && dpaAccepted === false;

  if (!needsJurisdiction && !needsDpa) return null;

  const handleDismiss = () => {
    if (currentTeam?.id) {
      window.sessionStorage.setItem(DISMISS_KEY_PREFIX + currentTeam.id, "1");
    }
    setDismissed(true);
  };

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <span className="text-sm">
          {needsJurisdiction
            ? "Set your operating jurisdiction so we can apply the right privacy posture."
            : "Your organization needs to execute the Data Processing Agreement to complete EU/UK compliance setup."}
        </span>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/settings?tab=legal">Open Legal settings</Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default ComplianceBanner;
