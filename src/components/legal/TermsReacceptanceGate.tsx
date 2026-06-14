import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import {
  LEGAL_DOCS,
  REQUIRED_AT_SIGNUP,
  CURRENT_CONSENT_STATEMENT,
  buildDocumentsPayload,
  type LegalDocType,
} from "@/lib/legal/versions";

interface AcceptanceRow {
  documents_accepted: Array<{ document_type: LegalDocType; version: string }>;
}

/**
 * Blocks the app until the signed-in user has a current acceptance for every
 * required document. Owners/admins can accept on behalf of the team; other
 * roles see a read-only "your account owner must accept" screen.
 */
export const TermsReacceptanceGate = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { currentTeam, userRole } = useTeam();
  const [checking, setChecking] = useState(true);
  const [outdated, setOutdated] = useState<LegalDocType[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const teamId = currentTeam?.id ?? null;
  const canAcceptForTeam = userRole === "owner" || userRole === "admin";

  const evaluate = useCallback(async () => {
    if (!user) {
      setChecking(false);
      return;
    }
    setChecking(true);
    setError(null);

    // Latest version accepted per doc type for this user
    const { data, error: qErr } = await supabase
      .from("terms_acceptances")
      .select("documents_accepted")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false })
      .limit(50);

    if (qErr) {
      // Fail open on a transient read error rather than locking the user out
      console.warn("TermsReacceptanceGate: read failed, allowing entry", qErr);
      setOutdated([]);
      setChecking(false);
      return;
    }

    const latest = new Map<LegalDocType, string>();
    for (const row of (data ?? []) as AcceptanceRow[]) {
      for (const d of row.documents_accepted ?? []) {
        if (!latest.has(d.document_type)) latest.set(d.document_type, d.version);
      }
    }

    const stale = REQUIRED_AT_SIGNUP.filter(
      (t) => latest.get(t) !== LEGAL_DOCS[t].version
    );
    setOutdated(stale);
    setChecking(false);
  }, [user]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  const handleAccept = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: fnErr } = await supabase.functions.invoke("record-terms-acceptance", {
        body: {
          team_id: teamId,
          event_type: "terms_update",
          documents: buildDocumentsPayload(REQUIRED_AT_SIGNUP),
          consent_statement: CURRENT_CONSENT_STATEMENT,
          acceptance_method: "checkbox_click",
          page_url: window.location.href,
          is_authorized_representative: canAcceptForTeam,
        },
      });
      if (fnErr) throw fnErr;
      await evaluate();
      setAgreed(false);
    } catch (e) {
      console.error(e);
      setError("Could not record your acceptance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // While checking, render children to avoid a flash; the gate will mount
  // the modal on top once it determines acceptance is required.
  if (!user || checking || outdated.length === 0) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <Dialog open={true} onOpenChange={() => { /* non-dismissable */ }}>
        <DialogContent
          className="max-w-lg z-[60]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <DialogTitle>Updated terms require your acceptance</DialogTitle>
            </div>
            <DialogDescription>
              We've updated the legal documents that govern your use of Exotiq.
              Please review and accept to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <ul className="space-y-2 text-sm">
              {outdated.map((t) => (
                <li key={t} className="flex justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                  <a
                    href={LEGAL_DOCS[t].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:underline"
                  >
                    {LEGAL_DOCS[t].label}
                  </a>
                  <span className="text-muted-foreground">
                    Effective {LEGAL_DOCS[t].effectiveDate}
                  </span>
                </li>
              ))}
            </ul>

            {canAcceptForTeam ? (
              <>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    id="reaccept-terms"
                    checked={agreed}
                    onCheckedChange={(v) => setAgreed(v === true)}
                    className="mt-0.5"
                  />
                  <span>{CURRENT_CONSENT_STATEMENT}</span>
                </label>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  className="w-full"
                  disabled={!agreed || submitting}
                  onClick={handleAccept}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recording acceptance…
                    </>
                  ) : (
                    "Accept and continue"
                  )}
                </Button>
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your account owner needs to accept the updated terms before
                  the team can continue using Exotiq. Please reach out to them
                  to complete this step.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
