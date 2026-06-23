import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Download, ShieldCheck, FileText, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";
import {
  LEGAL_DOCS,
  SMS_CONSENT_STATEMENT,
  buildDocumentsPayload,
  type LegalDocType,
} from "@/lib/legal/versions";
import { featureFlags } from "@/lib/featureFlags";
import { ComplianceSection } from "./ComplianceSection";

interface AcceptanceRow {
  id: string;
  accepted_at: string;
  event_type: string;
  consent_statement: string;
  documents_accepted: Array<{
    document_type: LegalDocType;
    version: string;
    url?: string;
    effective_date?: string;
    content_hash?: string;
  }>;
  ip_address: string | null;
  user_agent: string | null;
  page_url: string | null;
}

const DPA_CONSENT_STATEMENT =
  "On behalf of my organization, I execute and agree to the Exotiq Data Processing Agreement, including its sub-processor list and security commitments.";

const PER_DOC_CONSENT_STATEMENT: Record<LegalDocType, string> = {
  terms:
    "I have read and agree to the Exotiq Terms and Conditions. I represent that I am authorized to bind my organization to these terms.",
  privacy:
    "I acknowledge the Exotiq Privacy Policy and how my organization's data is processed.",
  aup: "On behalf of my organization, I agree to the Exotiq Acceptable Use Policy.",
  dpa: DPA_CONSENT_STATEMENT,
  sms: SMS_CONSENT_STATEMENT,
  cookies: "I acknowledge the Exotiq Cookie Policy.",
  dmca: "I acknowledge the Exotiq DMCA and Copyright Policy.",
  transfer_addendum:
    "On behalf of my organization, I execute the International Data Transfer Addendum (SCCs / UK IDTA) for transfers of personal data outside the EEA/UK.",
};

export const LegalSection = () => {
  const { user } = useAuth();
  const { currentTeam, userRole } = useTeam();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AcceptanceRow[]>([]);
  const [dpaAgreed, setDpaAgreed] = useState(false);
  const [submittingDpa, setSubmittingDpa] = useState(false);

  // Inline per-row acceptance state
  const [acceptDocType, setAcceptDocType] = useState<LegalDocType | null>(null);
  const [acceptAgreed, setAcceptAgreed] = useState(false);
  const [submittingAccept, setSubmittingAccept] = useState(false);

  const canAcceptForTeam = userRole === "owner" || userRole === "admin";
  const canExecuteDpa = canAcceptForTeam;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("terms_acceptances")
      .select(
        "id, accepted_at, event_type, consent_statement, documents_accepted, ip_address, user_agent, page_url"
      )
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("Failed to load acceptances", error);
      toast({ title: "Could not load legal history", variant: "destructive" });
    } else {
      setRows((data ?? []) as unknown as AcceptanceRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Latest accepted version per doc, for the "current acceptance" summary
  const currentByDoc = new Map<LegalDocType, { version: string; accepted_at: string }>();
  for (const r of rows) {
    for (const d of r.documents_accepted ?? []) {
      if (!currentByDoc.has(d.document_type)) {
        currentByDoc.set(d.document_type, { version: d.version, accepted_at: r.accepted_at });
      }
    }
  }

  const dpaAccepted = currentByDoc.get("dpa")?.version === LEGAL_DOCS.dpa.version;

  const handleAcceptDpa = async () => {
    if (!dpaAgreed || submittingDpa) return;
    setSubmittingDpa(true);
    try {
      const { error } = await supabase.functions.invoke("record-terms-acceptance", {
        body: {
          team_id: currentTeam?.id ?? null,
          event_type: "order_form",
          documents: buildDocumentsPayload(["dpa"]),
          consent_statement: DPA_CONSENT_STATEMENT,
          acceptance_method: "checkbox_click",
          page_url: window.location.href,
          is_authorized_representative: true,
        },
      });
      if (error) throw error;
      toast({ title: "Data Processing Agreement executed", description: "A record has been added to your legal history." });
      setDpaAgreed(false);
      await load();
    } catch (e) {
      console.error(e);
      toast({ title: "Could not record DPA acceptance", variant: "destructive" });
    } finally {
      setSubmittingDpa(false);
    }
  };

  const openAcceptDialog = (docType: LegalDocType) => {
    setAcceptDocType(docType);
    setAcceptAgreed(false);
  };

  const closeAcceptDialog = () => {
    if (submittingAccept) return;
    setAcceptDocType(null);
    setAcceptAgreed(false);
  };

  const handleAcceptDoc = async () => {
    if (!acceptDocType || !acceptAgreed || submittingAccept) return;
    setSubmittingAccept(true);
    try {
      const eventType = acceptDocType === "dpa" ? "order_form" : "terms_update";
      const { error } = await supabase.functions.invoke("record-terms-acceptance", {
        body: {
          team_id: currentTeam?.id ?? null,
          event_type: eventType,
          documents: buildDocumentsPayload([acceptDocType]),
          consent_statement: PER_DOC_CONSENT_STATEMENT[acceptDocType],
          acceptance_method: "checkbox_click",
          page_url: window.location.href,
          is_authorized_representative: true,
        },
      });
      if (error) throw error;
      toast({
        title: `${LEGAL_DOCS[acceptDocType].label} accepted`,
        description: "A record has been added to your legal history.",
      });
      setAcceptDocType(null);
      setAcceptAgreed(false);
      await load();
    } catch (e) {
      console.error(e);
      toast({ title: "Could not record acceptance", variant: "destructive" });
    } finally {
      setSubmittingAccept(false);
    }
  };

  const handleExport = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      user_id: user?.id,
      user_email: user?.email,
      team_id: currentTeam?.id ?? null,
      acceptance_count: rows.length,
      acceptances: rows,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `exotiq-legal-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const activeDoc = acceptDocType ? LEGAL_DOCS[acceptDocType] : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Legal & Agreements</h2>
        </div>

        {/* Current published versions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current policies</CardTitle>
            <CardDescription>
              The versions of Exotiq's legal documents currently in force.
              {canAcceptForTeam
                ? " As an account owner or admin, you can accept any policy on behalf of your organization."
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {(Object.keys(LEGAL_DOCS) as LegalDocType[]).map((t) => {
                const doc = LEGAL_DOCS[t];
                const accepted = currentByDoc.get(t);
                const isCurrent = accepted?.version === doc.version;
                const status: "accepted" | "older" | "missing" = isCurrent
                  ? "accepted"
                  : accepted
                    ? "older"
                    : "missing";
                return (
                  <li key={t} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        {doc.label}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        v{doc.version} · Effective {doc.effectiveDate}
                        {doc.lastUpdated && doc.lastUpdated !== doc.effectiveDate
                          ? ` · Updated ${doc.lastUpdated}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {status === "accepted" ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Accepted
                        </Badge>
                      ) : status === "older" ? (
                        <Badge variant="outline">Older version on file</Badge>
                      ) : (
                        <Badge variant="outline">Not yet accepted</Badge>
                      )}
                      {status !== "accepted" && (
                        canAcceptForTeam ? (
                          <Button
                            size="sm"
                            variant={status === "older" ? "outline" : "default"}
                            onClick={() => openAcceptDialog(t)}
                          >
                            {status === "older" ? "Accept update" : "Accept"}
                          </Button>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[11px] text-muted-foreground italic">
                                Owner/admin only
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Only an account owner or admin can accept on behalf of your organization.
                            </TooltipContent>
                          </Tooltip>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* DPA execution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Processing Agreement</CardTitle>
            <CardDescription>
              Required for organizations processing personal data of EU/UK residents
              (GDPR Article 28). Optional otherwise.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dpaAccepted ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Your organization has executed the current DPA (v{LEGAL_DOCS.dpa.version}).
                </AlertDescription>
              </Alert>
            ) : canExecuteDpa ? (
              <>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={dpaAgreed}
                    onCheckedChange={(v) => setDpaAgreed(v === true)}
                    className="mt-0.5"
                  />
                  <span>{DPA_CONSENT_STATEMENT}</span>
                </label>
                <Button onClick={handleAcceptDpa} disabled={!dpaAgreed || submittingDpa}>
                  {submittingDpa ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recording…
                    </>
                  ) : (
                    "Execute DPA"
                  )}
                </Button>
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Only an account owner or admin can execute the DPA on behalf of your organization.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* History + export */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Acceptance history</CardTitle>
              <CardDescription>
                Tamper-evident record of every agreement you've accepted on this account.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No acceptances on file yet.</p>
            ) : (
              <ul className="space-y-3">
                {rows.map((r) => (
                  <li key={r.id} className="rounded-md border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline" className="capitalize">
                        <FileText className="h-3 w-3 mr-1" />
                        {r.event_type.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.accepted_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      {(r.documents_accepted ?? []).map((d, i) => (
                        <div key={i} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground capitalize">{d.document_type}</span>
                          {" "}· v{d.version}
                        </div>
                      ))}
                    </div>
                    {r.ip_address && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        IP {r.ip_address}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {featureFlags.complianceEuUk && <ComplianceSection />}

        {/* Per-document accept dialog */}
        <Dialog open={acceptDocType !== null} onOpenChange={(open) => { if (!open) closeAcceptDialog(); }}>
          <DialogContent className="max-w-md">
            {activeDoc && acceptDocType && (
              <>
                <DialogHeader>
                  <DialogTitle>Accept {activeDoc.label}</DialogTitle>
                  <DialogDescription>
                    v{activeDoc.version} · Effective {activeDoc.effectiveDate}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <a
                    href={activeDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Open full document
                    <ExternalLink className="h-3 w-3" />
                  </a>

                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={acceptAgreed}
                      onCheckedChange={(v) => setAcceptAgreed(v === true)}
                      className="mt-0.5"
                    />
                    <span>{PER_DOC_CONSENT_STATEMENT[acceptDocType]}</span>
                  </label>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={closeAcceptDialog} disabled={submittingAccept}>
                    Cancel
                  </Button>
                  <Button onClick={handleAcceptDoc} disabled={!acceptAgreed || submittingAccept}>
                    {submittingAccept ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Recording…
                      </>
                    ) : (
                      "Accept"
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default LegalSection;
