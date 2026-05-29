import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Check, X, Upload, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/marginCsv";
import { ReceiptUploadDialog } from "./ReceiptUploadDialog";

type ReviewExpense = {
  id: string;
  vehicle_id: string | null;
  booking_id: string | null;
  expense_type: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
  notes: string | null;
  source_module: string;
  review_reason: string | null;
  ai_confidence: number | null;
  ai_parsed_fields: any;
  receipt_url: string | null;
  linked_damage_claim_id: string | null;
};

const TYPES = [
  "fuel","insurance","maintenance","cleaning","storage","registration","detailing",
  "toll","parking","damage","transport","tax","overhead","other",
];

const SOURCE_LABEL: Record<string, string> = {
  ai_receipt: "AI Receipt",
  maintenance: "Maintenance",
  work_orders: "Work Order",
  damage: "Damage Claim",
  margin_manual: "Manual",
};

export function ReviewTab() {
  const { currentTeam } = useTeam();
  const [rows, setRows] = useState<ReviewExpense[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, Partial<ReviewExpense>>>({});

  const refresh = useCallback(async () => {
    if (!currentTeam?.id) return;
    setLoading(true);
    const [{ data: exps }, { data: vehs }] = await Promise.all([
      supabase
        .from("vehicle_expenses")
        .select("id, vehicle_id, booking_id, expense_type, amount, expense_date, vendor, notes, source_module, review_reason, ai_confidence, ai_parsed_fields, receipt_url, linked_damage_claim_id")
        .eq("team_id", currentTeam.id)
        .eq("status", "pending_review")
        .order("created_at", { ascending: false }),
      supabase.from("vehicles").select("id, make, model").eq("team_id", currentTeam.id),
    ]);
    setRows((exps || []) as any);
    const map: Record<string, string> = {};
    (vehs || []).forEach((v: any) => (map[v.id] = `${v.make} ${v.model}`));
    setVehicleMap(map);
    setLoading(false);
  }, [currentTeam?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime subscription
  useEffect(() => {
    if (!currentTeam?.id) return;
    const ch = supabase
      .channel(`expense-review-${currentTeam.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicle_expenses", filter: `team_id=eq.${currentTeam.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentTeam?.id, refresh]);

  const update = (id: string, patch: Partial<ReviewExpense>) =>
    setEditing((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const approve = async (row: ReviewExpense) => {
    const p = editing[row.id] || {};
    const { error } = await supabase.rpc("review_expense", {
      p_expense_id: row.id,
      p_action: "approve",
      p_amount: p.amount ?? null,
      p_expense_type: p.expense_type ?? null,
      p_vehicle_id: (p.vehicle_id === "" ? null : p.vehicle_id) ?? null,
      p_booking_id: null,
      p_notes: p.notes ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Expense approved");
    refresh();
  };

  const reject = async (row: ReviewExpense) => {
    const reason = window.prompt("Reason for rejecting? (optional)") || null;
    const { error } = await supabase.rpc("review_expense", {
      p_expense_id: row.id,
      p_action: "reject",
      p_notes: reason,
    });
    if (error) return toast.error(error.message);
    toast.success("Expense rejected");
    refresh();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Review Queue
              {rows.length > 0 && <Badge variant="secondary">{rows.length}</Badge>}
            </CardTitle>
            <CardDescription className="text-xs">
              Expenses awaiting your confirmation. Nothing here counts toward P&L until approved.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Upload Receipts
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center text-muted-foreground py-8 text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">
              <Check className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Inbox zero. New AI-parsed receipts, big-ticket maintenance, and damage claims will appear here.
            </div>
          ) : (
            rows.map((row) => {
              const draft = editing[row.id] || {};
              const amount = draft.amount ?? row.amount;
              const expense_type = draft.expense_type ?? row.expense_type;
              const vehicle_id = draft.vehicle_id ?? row.vehicle_id ?? "";
              const isAI = row.source_module === "ai_receipt";
              const isDamage = row.source_module === "damage";
              return (
                <div key={row.id} className="border rounded-lg p-3 space-y-3 bg-card">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {SOURCE_LABEL[row.source_module] || row.source_module}
                      </Badge>
                      {isAI && row.ai_confidence != null && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {Math.round(row.ai_confidence * 100)}% confidence
                        </Badge>
                      )}
                      {isDamage && <Badge variant="destructive" className="text-xs">Owner confirm</Badge>}
                      {row.review_reason && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {row.review_reason}
                        </span>
                      )}
                    </div>
                    {row.receipt_url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const { data } = await supabase.storage
                            .from("expense-receipts")
                            .createSignedUrl(row.receipt_url!, 600);
                          if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" /> View receipt
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => update(row.id, { amount: Number(e.target.value) })}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={expense_type} onValueChange={(v) => update(row.id, { expense_type: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[60]">
                          {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Vehicle</Label>
                      <Select
                        value={vehicle_id || "none"}
                        onValueChange={(v) => update(row.id, { vehicle_id: v === "none" ? "" : v })}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="Overhead" /></SelectTrigger>
                        <SelectContent className="z-[60]">
                          <SelectItem value="none">Overhead</SelectItem>
                          {Object.entries(vehicleMap).map(([id, label]) => (
                            <SelectItem key={id} value={id}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground">
                    <span>
                      {new Date(row.expense_date).toLocaleDateString()} · {row.vendor || "No vendor"}
                      {row.notes && <> · <span className="italic">{row.notes}</span></>}
                    </span>
                    <span className="font-medium text-foreground">{formatCurrency(amount)}</span>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => reject(row)}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => approve(row)}>
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      <ReceiptUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onComplete={refresh} />
    </>
  );
}
