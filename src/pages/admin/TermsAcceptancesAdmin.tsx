import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ShieldCheck, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

interface Row {
  id: string;
  user_id: string;
  actor_email: string | null;
  actor_display_name: string | null;
  event_type: string;
  documents_accepted: Array<{
    document_type: string;
    version: string;
    url: string;
    content_hash: string;
    effective_date: string;
  }>;
  consent_statement: string;
  acceptance_method: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  page_url: string | null;
  is_authorized_representative: boolean;
}

const TermsAcceptancesAdmin = () => {
  const { currentTeam, userRole } = useTeam();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const teamId = currentTeam?.id;
  const isOwner = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    if (!teamId || !isOwner) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("terms_acceptances")
        .select("*")
        .eq("team_id", teamId)
        .order("accepted_at", { ascending: false })
        .limit(500);
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
  }, [teamId, isOwner]);

  const exportCsv = () => {
    const headers = [
      "accepted_at", "actor_email", "actor_display_name", "event_type",
      "acceptance_method", "is_authorized_representative", "ip_address",
      "user_agent", "page_url", "consent_statement", "documents_accepted",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const docs = JSON.stringify(r.documents_accepted).replace(/"/g, '""');
      const fields = [
        r.accepted_at,
        r.actor_email ?? "",
        r.actor_display_name ?? "",
        r.event_type,
        r.acceptance_method,
        String(r.is_authorized_representative),
        r.ip_address ?? "",
        (r.user_agent ?? "").replace(/"/g, '""'),
        r.page_url ?? "",
        r.consent_statement.replace(/"/g, '""'),
        docs,
      ].map((f) => `"${f}"`);
      lines.push(fields.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terms-acceptances-${teamId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOwner) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This page is only available to account owners and admins.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Terms acceptance history</h1>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Every time someone on your team accepts our legal terms, we save a
        permanent record of who clicked, when, from where, and exactly what
        they saw. These records cannot be edited or deleted.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No acceptance records yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.actor_display_name ?? r.actor_email ?? "Unknown user"}</span>
                  <Badge variant="outline" className="text-xs">{r.event_type}</Badge>
                  {r.is_authorized_representative && (
                    <Badge variant="secondary" className="text-xs">authorized rep</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(r.accepted_at), "PPpp")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <div>IP: {r.ip_address ?? "—"}</div>
                <div>Method: {r.acceptance_method}</div>
                <div className="sm:col-span-2 truncate">UA: {r.user_agent ?? "—"}</div>
                {r.page_url && <div className="sm:col-span-2 truncate">Page: {r.page_url}</div>}
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Snapshot ({r.documents_accepted.length} document{r.documents_accepted.length === 1 ? "" : "s"})
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="rounded border border-border/60 p-2 bg-muted/30">
                    <div className="font-medium text-foreground mb-1">Consent statement shown:</div>
                    <div className="text-muted-foreground">{r.consent_statement}</div>
                  </div>
                  <ul className="space-y-1">
                    {r.documents_accepted.map((d, i) => (
                      <li key={i} className="rounded border border-border/60 p-2">
                        <div className="font-medium text-foreground">
                          {d.document_type} · v{d.version}
                        </div>
                        <div className="text-muted-foreground">Effective {d.effective_date}</div>
                        <div className="text-muted-foreground truncate">Hash: {d.content_hash}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TermsAcceptancesAdmin;
