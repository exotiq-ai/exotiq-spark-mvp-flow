import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  buildDocumentsPayload,
  consentStatementForJurisdiction,
  requiredDocsForJurisdiction,
  type LegalDocType,
} from "@/lib/legal/versions";
import { getChangeSummary } from "@/lib/legal/changelog";

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
  const jurisdiction = (currentTeam as { primary_jurisdiction?: string | null } | null)?.primary_jurisdiction ?? null;
  // Memoize so requiredDocs identity is stable across renders. Otherwise the
  // evaluate effect retriggers every render and fires dozens of reads.
  const requiredDocs = useMemo(
    () => requiredDocsForJurisdiction(jurisdiction),
    [jurisdiction]
  );
  const consentStatement = consentStatementForJurisdiction(jurisdiction);
  const canAcceptForTeam = userRole === "owner" || userRole === "admin";
  const inFlightRef = useRef(false);

  const evaluate = useCallback(async () => {
    if (!user) {
      setChecking(false);
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setChecking(true);
    setError(null);

    try {
      // 1. Find owners/admins on the current team. Their acceptance covers
      //    every member (they sign as authorized representative).
      const adminIds: string[] = [];
      if (teamId) {
        const { data: admins } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("team_id", teamId)
          .eq("is_active", true)
          .in("role", ["owner", "admin"]);
        for (const a of (admins ?? []) as Array<{ user_id: string }>) {
          if (a.user_id) adminIds.push(a.user_id);
        }
      }

      // 2. Pull this user's own acceptances plus any team-admin acceptances
      //    scoped to the current team. RLS allows team members to read rows
      //    where team_id matches their team.
      const userIds = Array.from(new Set([user.id, ...adminIds]));
      let query = supabase
        .from("terms_acceptances")
        .select("documents_accepted,user_id,team_id,accepted_at")
        .in("user_id", userIds)
        .order("accepted_at", { ascending: false })
        .limit(100);
      if (teamId) {
        // Either the row is the user's own, or it's a team-admin row scoped
        // to this team. Avoids picking up admin rows from a different team
        // the admin also belongs to.
        query = query.or(`user_id.eq.${user.id},team_id.eq.${teamId}`);
      }
      const { data, error: qErr } = await query;

      if (qErr) {
        console.warn("TermsReacceptanceGate: read failed, allowing entry", qErr);
        setOutdated([]);
        return;
      }

      const latest = new Map<LegalDocType, string>();
      for (const row of (data ?? []) as unknown as AcceptanceRow[]) {
        for (const d of row.documents_accepted ?? []) {
          if (!latest.has(d.document_type)) latest.set(d.document_type, d.version);
        }
      }

      const stale = requiredDocs.filter(
        (t) => latest.get(t) !== LEGAL_DOCS[t].version
      );
      setOutdated(stale);
    } finally {
      setChecking(false);
      inFlightRef.current = false;
    }
  }, [user, requiredDocs, teamId]);


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
          documents: buildDocumentsPayload(requiredDocs),
          consent_statement: consentStatement,
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
          data-testid="terms-reacceptance-gate"
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
              {outdated.map((t) => {
                const summary = getChangeSummary(t, LEGAL_DOCS[t].version);
                return (
                  <li
                    key={t}
                    className="rounded-md border border-border/60 px-3 py-2"
                    data-testid={`terms-gate-doc-${t}`}
                  >
                    <div className="flex justify-between gap-3">
                      <a
                        href={LEGAL_DOCS[t].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:underline"
                      >
                        {LEGAL_DOCS[t].label}
                      </a>
                      <span className="text-muted-foreground text-right">
                        <span className="block">Effective {LEGAL_DOCS[t].effectiveDate}</span>
                        {LEGAL_DOCS[t].lastUpdated &&
                          LEGAL_DOCS[t].lastUpdated !== LEGAL_DOCS[t].effectiveDate && (
                            <span className="block text-[11px]">
                              Updated {LEGAL_DOCS[t].lastUpdated}
                            </span>
                          )}
                      </span>
                    </div>
                    {summary && (
                      <p className="text-xs text-muted-foreground mt-1">
                        What's changed: {summary}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {canAcceptForTeam ? (
              <>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    id="reaccept-terms"
                    checked={agreed}
                    data-testid="terms-gate-checkbox"
                    onCheckedChange={(v) => setAgreed(v === true)}
                    className="mt-0.5"
                  />
                  <span>{consentStatement}</span>
                </label>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  className="w-full"
                  data-testid="terms-gate-accept"
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
