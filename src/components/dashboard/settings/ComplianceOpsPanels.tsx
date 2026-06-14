// Three owner/admin-only panels surfaced under Settings → Legal when the
// complianceEuUk feature flag is on:
//   1. Retention sweeps (dry-run reports + per-entity enable toggle)
//   2. Data subject requests (generate exports)
//   3. Access log (last 90 days of PII reads/writes)
//
// All additive. None of these panels render unless the user has the
// admin/owner role.

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2, FileDown, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/contexts/TeamContext";

interface SweepRow {
  id: string;
  entity_type: string;
  retention_days: number;
  would_delete_count: number;
  deleted_count: number;
  dry_run: boolean;
  error: string | null;
  ran_at: string;
}

interface PolicyRow {
  id: string;
  entity_type: string;
  retention_days: number;
  enabled: boolean;
  action: string;
}

interface DsrRow {
  id: string;
  request_type: string;
  subject_email: string | null;
  subject_user_id: string | null;
  subject_customer_id: string | null;
  status: string;
  fulfilled_at: string | null;
  export_url: string | null;
  export_expires_at: string | null;
  created_at: string;
}

interface AccessLogRow {
  id: string;
  actor_email: string | null;
  entity: string;
  record_id: string | null;
  action: string;
  created_at: string;
}

export const RetentionSweepsPanel = () => {
  const { toast } = useToast();
  const [sweeps, setSweeps] = useState<SweepRow[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [s, p] = await Promise.all([
      (supabase.from("retention_sweep_log") as any)
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(50),
      (supabase.from("retention_policies") as any)
        .select("id, entity_type, retention_days, enabled, action")
        .order("entity_type"),
    ]);
    setSweeps((s.data ?? []) as SweepRow[]);
    setPolicies((p.data ?? []) as PolicyRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const togglePolicy = async (row: PolicyRow, next: boolean) => {
    setSavingId(row.id);
    const { error } = await (supabase.from("retention_policies") as any)
      .update({ enabled: next })
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Could not update policy", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: next ? "Enforcement enabled" : "Switched to dry-run",
      description: `${row.entity_type} retention is now ${next ? "deleting" : "reporting only"}.`,
    });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-primary" />
          Retention sweeps
        </CardTitle>
        <CardDescription>
          Daily sweep reports what would be deleted under each retention rule.
          Switch a rule to enforce only after reviewing its dry-run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {policies.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No retention rules configured yet.
                </p>
              )}
              {policies.map((p) => {
                const latest = sweeps.find((s) => s.entity_type === p.entity_type);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{p.entity_type}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {p.retention_days}d
                        </Badge>
                        <Badge
                          variant={p.enabled ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {p.enabled ? "enforcing" : "dry-run"}
                        </Badge>
                      </div>
                      {latest && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Last sweep {new Date(latest.ran_at).toLocaleString()}:{" "}
                          {latest.would_delete_count} rows past window
                          {latest.deleted_count > 0
                            ? ` · ${latest.deleted_count} deleted`
                            : ""}
                          {latest.error ? ` · error: ${latest.error}` : ""}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={p.enabled}
                      disabled={savingId === p.id}
                      onCheckedChange={(v) => togglePolicy(p, v)}
                      aria-label={`Toggle enforcement for ${p.entity_type}`}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const DsrRequestsPanel = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<DsrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from("data_subject_requests") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data ?? []) as DsrRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("dsr-export", {
      body: { request_id: id },
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Export generated",
      description: `Signed link valid for 7 days. ${Object.keys((data as any)?.counts ?? {}).length} tables included.`,
    });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileDown className="h-4 w-4 text-primary" />
          Data subject requests
        </CardTitle>
        <CardDescription>
          Generate a machine-readable export of everything held about a
          renter or operator user. Link is signed for 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {r.subject_email ?? r.subject_user_id ?? r.subject_customer_id ?? "—"}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {r.request_type}
                    </Badge>
                    <Badge
                      variant={r.status === "fulfilled" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Opened {new Date(r.created_at).toLocaleString()}
                    {r.fulfilled_at
                      ? ` · fulfilled ${new Date(r.fulfilled_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.export_url && (
                    <a
                      href={r.export_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline text-muted-foreground hover:text-foreground"
                    >
                      Download
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generate(r.id)}
                    disabled={busyId === r.id}
                  >
                    {busyId === r.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : null}
                    {r.export_url ? "Regenerate" : "Generate export"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export const AccessLogPanel = () => {
  const { currentTeam } = useTeam();
  const [rows, setRows] = useState<AccessLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 90 * 86400 * 1000).toISOString();
      let q = (supabase.from("data_access_log") as any)
        .select("id, actor_email, entity, record_id, action, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      if (currentTeam?.id) q = q.eq("team_id", currentTeam.id);
      const { data } = await q;
      setRows((data ?? []) as AccessLogRow[]);
      setLoading(false);
    })();
  }, [currentTeam?.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-primary" />
          Access log
        </CardTitle>
        <CardDescription>
          Last 90 days of personal-data reads and changes by your team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <ul className="space-y-1 max-h-96 overflow-y-auto text-xs font-mono">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-1 border-b border-border/40">
                <span className="text-muted-foreground shrink-0 w-36">
                  {new Date(r.created_at).toLocaleString()}
                </span>
                <span className="shrink-0 w-12 uppercase text-[10px] text-muted-foreground">
                  {r.action}
                </span>
                <span className="shrink-0 w-40 truncate">{r.entity}</span>
                <span className="truncate text-muted-foreground">{r.actor_email ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
