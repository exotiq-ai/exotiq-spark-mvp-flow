// Two-step erasure UI: preview then execute. Owner/admin only.
// Pairs with the dsr-erase edge function.

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Eraser } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Row {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  subject_user_id: string | null;
  subject_customer_id: string | null;
  reason: string | null;
  status: string;
  preview_counts: Record<string, number> | null;
  executed_at: string | null;
  created_at: string;
}

export const ErasurePanel = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from("deletion_requests") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const preview = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("dsr-erase", {
      body: { request_id: id, mode: "preview" },
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Preview failed", description: error.message, variant: "destructive" });
      return;
    }
    const counts = (data as any)?.counts ?? {};
    toast({
      title: "Preview ready",
      description: `${Object.values(counts).reduce((a: number, b: any) => a + (b as number), 0)} rows across ${Object.keys(counts).length} tables.`,
    });
    load();
  };

  const execute = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("dsr-erase", {
      body: { request_id: id, mode: "execute" },
    });
    setBusyId(null);
    setConfirmId(null);
    if (error) {
      toast({ title: "Erasure failed", description: error.message, variant: "destructive" });
      return;
    }
    const counts = (data as any)?.counts ?? {};
    toast({
      title: "Erasure completed",
      description: `${Object.keys(counts).length} tables processed. Receipt written to access log.`,
    });
    load();
  };

  const target = rows.find((r) => r.id === confirmId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Eraser className="h-4 w-4 text-primary" />
          Hard erasure (Art. 17)
        </CardTitle>
        <CardDescription>
          Preview which rows would be removed, then execute. Financial and
          consent records are anonymized in place to respect tax and audit
          retention floors.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No erasure requests yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const previewed = r.preview_counts && Object.keys(r.preview_counts).length > 0;
              const done = !!r.executed_at;
              return (
                <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {r.subject_customer_id ?? r.customer_id ?? r.subject_user_id ?? r.user_id ?? "—"}
                      </p>
                      <Badge variant={done ? "default" : "secondary"} className="text-[10px]">
                        {done ? "completed" : r.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Opened {new Date(r.created_at).toLocaleString()}
                      {previewed
                        ? ` · preview ${Object.values(r.preview_counts!).reduce((a, b) => a + (b as number), 0)} rows`
                        : ""}
                      {done ? ` · erased ${new Date(r.executed_at!).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => preview(r.id)}
                      disabled={busyId === r.id || done}
                    >
                      {busyId === r.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmId(r.id)}
                      disabled={!previewed || done || busyId === r.id}
                    >
                      Execute
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={!!confirmId} onOpenChange={(v) => !v && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Execute hard erasure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete or anonymize {target?.preview_counts
                ? Object.values(target.preview_counts).reduce((a, b) => a + (b as number), 0)
                : 0}{" "}
              rows across {target?.preview_counts ? Object.keys(target.preview_counts).length : 0} tables.
              Financial and consent records are anonymized in place. A signed
              receipt is written to the access log. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmId && execute(confirmId)}>
              Erase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
