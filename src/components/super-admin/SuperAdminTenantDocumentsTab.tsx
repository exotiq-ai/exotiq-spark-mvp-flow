import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Loader2, CheckCircle2, XCircle, Eye } from "lucide-react";
import { SendTenantDocumentDialog } from "./SendTenantDocumentDialog";

interface TeamRow { id: string; name: string }

interface TdRow {
  id: string;
  team_id: string;
  doc_ref: string | null;
  title: string;
  template: string;
  status: "sent" | "viewed" | "signed" | "voided";
  signer_name: string | null;
  sent_at: string;
  signed_at: string | null;
  team?: { name: string | null };
}

const STATUS_META: Record<TdRow["status"], { label: string; variant: "secondary" | "outline" | "default" | "destructive" }> = {
  sent: { label: "Sent", variant: "outline" },
  viewed: { label: "Viewed", variant: "secondary" },
  signed: { label: "Signed", variant: "default" },
  voided: { label: "Voided", variant: "destructive" },
};

export const SuperAdminTenantDocumentsTab = () => {
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [docs, setDocs] = useState<TdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [teamsRes, docsRes] = await Promise.all([
      supabase.from("teams").select("id, name").order("name", { ascending: true }),
      supabase
        .from("tenant_documents")
        .select("id, team_id, doc_ref, title, template, status, signer_name, sent_at, signed_at, team:teams(name)")
        .order("sent_at", { ascending: false })
        .limit(200),
    ]);
    if (teamsRes.error) {
      toast({ title: "Could not load teams", variant: "destructive" });
    } else {
      setTeams((teamsRes.data ?? []) as TeamRow[]);
    }
    if (docsRes.error) {
      toast({ title: "Could not load documents", variant: "destructive" });
    } else {
      setDocs((docsRes.data ?? []) as unknown as TdRow[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const onSent = () => { setSendOpen(false); load(); };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tenant Documents</CardTitle>
            <CardDescription>
              Send PDFs to a tenant for in-app electronic signature. Signed copies are stored in
              the tenant's Vault and Exotiq's compliance archive.
            </CardDescription>
          </div>
          <Button onClick={() => setSendOpen(true)} data-testid="send-tenant-document">
            <Send className="h-4 w-4 mr-2" />
            Send Document
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : docs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No documents sent yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => {
                const meta = STATUS_META[d.status];
                const Icon = d.status === "signed" ? CheckCircle2 : d.status === "voided" ? XCircle : d.status === "viewed" ? Eye : FileText;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{d.title}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {d.doc_ref ?? "—"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {d.team?.name ?? d.team_id.slice(0, 8)} · Sent {new Date(d.sent_at).toLocaleString()}
                        {d.signed_at && ` · Signed by ${d.signer_name ?? "—"} ${new Date(d.signed_at).toLocaleString()}`}
                      </p>
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <SendTenantDocumentDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        teams={teams}
        onSent={onSent}
      />
    </div>
  );
};

export default SuperAdminTenantDocumentsTab;
