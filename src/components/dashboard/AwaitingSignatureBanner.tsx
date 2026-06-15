import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { featureFlags } from "@/lib/featureFlags";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

interface PendingDoc {
  id: string;
  doc_ref: string | null;
  title: string;
  sent_at: string;
}

/**
 * Persistent banner shown at the top of the dashboard whenever this team has
 * one or more tenant_documents in 'sent' or 'viewed' status. Owners/admins
 * only — others see nothing (they can't sign anyway).
 */
export const AwaitingSignatureBanner = () => {
  const { user } = useAuth();
  const { currentTeam, userRole } = useTeam();
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const canSign = userRole === "owner" || userRole === "admin";

  const load = useCallback(async () => {
    if (!user || !currentTeam?.id || !canSign) return;
    const { data, error } = await supabase
      .from("tenant_documents")
      .select("id, doc_ref, title, sent_at")
      .eq("team_id", currentTeam.id)
      .in("status", ["sent", "viewed"])
      .order("sent_at", { ascending: true });
    if (!error) setDocs((data ?? []) as PendingDoc[]);
  }, [user, currentTeam?.id, canSign]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when a new document lands or one is signed/voided.
  useEffect(() => {
    if (!currentTeam?.id) return;
    const channel = supabase
      .channel(`tenant_documents_${currentTeam.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tenant_documents", filter: `team_id=eq.${currentTeam.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentTeam?.id, load]);

  if (!featureFlags.tenantEsignature) return null;
  if (!canSign || docs.length === 0) return null;

  const first = docs[0];
  const more = docs.length - 1;

  return (
    <Alert className="border-primary/30 bg-primary/5">
      <ShieldCheck className="h-4 w-4 text-primary" />
      <AlertDescription className="flex items-center justify-between gap-3 w-full">
        <span className="text-sm">
          Exotiq sent <span className="font-medium">{first.title}</span>{" "}
          <span className="text-muted-foreground font-mono text-[11px]">
            ({first.doc_ref})
          </span>{" "}
          for your signature
          {more > 0 && (
            <span className="text-muted-foreground"> · +{more} more</span>
          )}
          .
        </span>
        <Button asChild size="sm">
          <Link to={`/dashboard/vault?sign=${first.id}`}>Review and Sign</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default AwaitingSignatureBanner;
