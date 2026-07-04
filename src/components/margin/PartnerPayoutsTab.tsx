import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, Check, ChevronRight, ChevronDown, MoreHorizontal, Ban, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";
import { toCsv, downloadCsv, formatCurrency } from "@/lib/marginCsv";
import { allowedActions, type PayoutAction } from "@/lib/payoutTransitions";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const PAYOUT_METHODS = ["ACH", "Check", "Wire", "Stripe", "Cash", "Other"];

interface Payout {
  id: string;
  booking_id: string;
  partner_id: string;
  vehicle_id: string;
  gross_rental_base: number;
  platform_fee_amount: number;
  net_after_fee: number;
  net_to_partner: number;
  split_type: string;
  split_value_snapshot: number;
  operator_adjustments: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  payout_reference: string | null;
  payout_method: string | null;
  void_reason: string | null;
  voided_at: string | null;
  reconcile_flag?: boolean | null;
  reconcile_note?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  voided: "bg-muted text-muted-foreground",
};

const startOfMonth = () => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; };
const startOfYear = () => { const d = new Date(); d.setMonth(0,1); d.setHours(0,0,0,0); return d; };

export function PartnerPayoutsTab() {
  const { currentTeam } = useTeam();
  const { isOwnerOrAdmin } = useUserRole();
  const [rows, setRows] = useState<Payout[]>([]);
  const [partners, setPartners] = useState<Record<string, string>>({});
  const [vehicles, setVehicles] = useState<Record<string, string>>({});
  const [bookings, setBookings] = useState<Record<string, { reference?: string | null; start_date?: string | null; end_date?: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [bulkRef, setBulkRef] = useState("");
  const [bulkMethod, setBulkMethod] = useState<string>("ACH");
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Payout | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!currentTeam?.id) return;
    setLoading(true);
    const [{ data: ps }, { data: prs }, { data: vehs }] = await Promise.all([
      supabase.from("partner_payouts").select("*").eq("team_id", currentTeam.id).order("created_at", { ascending: false }),
      supabase.from("vehicle_partners").select("id, name").eq("team_id", currentTeam.id),
      supabase.from("vehicles").select("id, make, model, name").eq("team_id", currentTeam.id),
    ]);
    setRows((ps || []) as any);
    const pm: Record<string, string> = {};
    (prs || []).forEach((p: any) => (pm[p.id] = p.name));
    setPartners(pm);
    const vm: Record<string, string> = {};
    (vehs || []).forEach((v: any) => (vm[v.id] = v.name || `${v.make} ${v.model}`));
    setVehicles(vm);

    const bookingIds = Array.from(new Set((ps || []).map((p: any) => p.booking_id).filter(Boolean)));
    if (bookingIds.length) {
      const { data: bks } = await supabase
        .from("bookings")
        .select("id, booking_ref, start_date, end_date")
        .in("id", bookingIds);
      const bm: typeof bookings = {};
      (bks || []).forEach((b: any) => (bm[b.id] = { reference: b.booking_ref, start_date: b.start_date, end_date: b.end_date }));
      setBookings(bm);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [currentTeam?.id]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterPartner !== "all" && r.partner_id !== filterPartner) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    });
  }, [rows, filterPartner, filterStatus]);

  const summary = useMemo(() => {
    const som = startOfMonth().getTime();
    const soy = startOfYear().getTime();
    let pending = 0, paidMTD = 0, paidYTD = 0;
    rows.forEach((r) => {
      const amt = Number(r.net_to_partner) || 0;
      if (r.status === "pending" || r.status === "scheduled") pending += amt;
      if (r.status === "paid" && r.paid_at) {
        const t = new Date(r.paid_at).getTime();
        if (t >= soy) paidYTD += amt;
        if (t >= som) paidMTD += amt;
      }
    });
    return { pending, paidMTD, paidYTD };
  }, [rows]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const togglePending = () => {
    const pendingIds = filtered.filter((r) => r.status === "pending").map((r) => r.id);
    const allSelected = pendingIds.every((id) => selected.has(id));
    const next = new Set(selected);
    pendingIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
    setSelected(next);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const transition = async (
    payoutId: string,
    action: PayoutAction,
    extra: { paidAt?: string; reference?: string; method?: string; reason?: string } = {}
  ) => {
    const { error } = await supabase.rpc("fn_transition_payout", {
      p_payout_id: payoutId,
      p_action: action,
      p_paid_at: extra.paidAt ? new Date(extra.paidAt).toISOString() : null,
      p_reference: extra.reference || null,
      p_method: extra.method || null,
      p_reason: extra.reason || null,
    });
    if (error) throw error;
  };

  const markPaid = async (ids: string[], paidAt: string, reference: string, method: string) => {
    setBusy(true);
    try {
      for (const id of ids) {
        await transition(id, "mark_paid", { paidAt, reference, method });
      }
      toast.success(`${ids.length} payout${ids.length === 1 ? "" : "s"} marked paid`);
      setSelected(new Set());
      setBulkOpen(false);
      setBulkRef("");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to mark paid");
    } finally {
      setBusy(false);
    }
  };

  const confirmVoid = async () => {
    if (!voidTarget) return;
    setBusy(true);
    try {
      await transition(voidTarget.id, "void", { reason: voidReason });
      toast.success("Payout voided");
      setVoidOpen(false);
      setVoidTarget(null);
      setVoidReason("");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to void");
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (payout: Payout) => {
    if (!confirm(`Re-open this voided payout? It returns to pending and clears void details.`)) return;
    setBusy(true);
    try {
      await transition(payout.id, "reopen");
      toast.success("Payout re-opened");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to re-open");
    } finally {
      setBusy(false);
    }
  };

  const recompute = async (payout: Payout) => {
    if (!confirm(`Recompute this payout from the current booking? Only pending payouts can be refreshed.`)) return;
    setBusy(true);
    try {
      await transition(payout.id, "recompute" as any);
      toast.success("Payout recomputed from booking");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to recompute");
    } finally {
      setBusy(false);
    }
  };

  const openVoid = (payout: Payout) => {
    setVoidTarget(payout);
    setVoidReason("");
    setVoidOpen(true);
  };


  const handleExport = () => {
    const csv = toCsv(
      filtered.map((r) => ({
        ...r,
        partner: partners[r.partner_id] || r.partner_id,
        vehicle: vehicles[r.vehicle_id] || r.vehicle_id,
        booking_ref: bookings[r.booking_id]?.reference || r.booking_id,
      })) as any,
      [
        { key: "created_at", label: "Created" },
        { key: "partner", label: "Partner" },
        { key: "vehicle", label: "Vehicle" },
        { key: "booking_ref", label: "Booking" },
        { key: "gross_rental_base", label: "Gross Base" },
        { key: "platform_fee_amount", label: "Platform Fee" },
        { key: "net_after_fee", label: "Net After Fee" },
        { key: "split_type", label: "Split Type" },
        { key: "split_value_snapshot", label: "Split Value" },
        { key: "net_to_partner", label: "Net to Partner" },
        { key: "status", label: "Status" },
        { key: "paid_at", label: "Paid At" },
        { key: "payout_reference", label: "Reference" },
      ]
    );
    downloadCsv(`partner-payouts-${Date.now()}.csv`, csv);
  };

  const selectedCount = selected.size;
  const partnerOptions = Object.entries(partners).sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Pending Obligations</div>
          <div className="text-xl font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(summary.pending)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Paid MTD</div>
          <div className="text-xl font-semibold">{formatCurrency(summary.paidMTD)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Paid YTD</div>
          <div className="text-xl font-semibold">{formatCurrency(summary.paidYTD)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-base">Partner Payouts</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterPartner} onValueChange={setFilterPartner}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Partners</SelectItem>
                {partnerOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
              </SelectContent>
            </Select>
            {selectedCount > 0 && (
              <Button size="sm" onClick={() => setBulkOpen(true)}>
                <Check className="h-4 w-4 mr-2" /> Mark {selectedCount} Paid
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleExport} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={filtered.filter((r) => r.status === "pending").length > 0 && filtered.filter((r) => r.status === "pending").every((r) => selected.has(r.id))}
                      onCheckedChange={togglePending}
                      aria-label="Select all pending"
                    />
                  </TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">To Partner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No partner payouts match the current filters.</TableCell></TableRow>
                ) : (
                  filtered.map((r) => {
                    const isOpen = expanded.has(r.id);
                    const bk = bookings[r.booking_id];
                    return (
                      <Fragment key={r.id}>
                        <TableRow>
                          <TableCell>
                            {r.status === "pending" && (
                              <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                            )}
                          </TableCell>
                          <TableCell>
                            <button onClick={() => toggleExpand(r.id)} className="text-muted-foreground hover:text-foreground">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{partners[r.partner_id] || "—"}</TableCell>
                          <TableCell className="text-sm">{vehicles[r.vehicle_id] || "—"}</TableCell>
                          <TableCell className="text-sm font-mono">{bk?.reference || r.booking_id.slice(0, 8)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.net_after_fee)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(r.net_to_partner)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={STATUS_STYLES[r.status] || ""}>{r.status}</Badge>
                              {r.reconcile_flag && (
                                <span title={r.reconcile_note || "Booking changed after payout — review required"}>
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <RowActions
                              payout={r}
                              isOwnerOrAdmin={isOwnerOrAdmin}
                              busy={busy}
                              onMarkPaid={() => { setSelected(new Set([r.id])); setBulkOpen(true); }}
                              onVoid={() => openVoid(r)}
                              onReopen={() => reopen(r)}
                              onRecompute={() => recompute(r)}
                            />
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={10} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <Stat label="Gross Base" value={formatCurrency(r.gross_rental_base)} />
                                <Stat label="Platform Fee" value={formatCurrency(r.platform_fee_amount)} />
                                <Stat label="Net After Fee" value={formatCurrency(r.net_after_fee)} />
                                <Stat label="Adjustments" value={formatCurrency(r.operator_adjustments)} />
                                <Stat label="Split" value={r.split_type === "percentage" ? `${r.split_value_snapshot}% to partner` : `${formatCurrency(r.split_value_snapshot)}/day`} />
                                <Stat label="To Partner" value={formatCurrency(r.net_to_partner)} highlight />
                                <Stat label="Method" value={r.payout_method || "—"} />
                                <Stat label="Reference" value={r.payout_reference || "—"} />
                                {r.status === "voided" && r.void_reason && <Stat label="Void Reason" value={r.void_reason} />}
                                {bk?.start_date && <Stat label="Booking Window" value={`${bk.start_date.slice(0,10)} → ${bk.end_date?.slice(0,10) || "?"}`} />}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Mark {selectedCount} payout{selectedCount === 1 ? "" : "s"} as paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Payout Date</Label>
              <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={bulkMethod} onValueChange={setBulkMethod}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYOUT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input value={bulkRef} onChange={(e) => setBulkRef(e.target.value)} placeholder="ACH batch #, check #, …" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => markPaid(Array.from(selected), bulkDate, bulkRef, bulkMethod)} disabled={busy}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Void payout</DialogTitle>
            <DialogDescription>
              This removes the obligation from your margin. A reason is required for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason</Label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Booking cancelled, duplicate, settled off-platform…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={confirmVoid} disabled={busy || !voidReason.trim()}>Void payout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowActions({
  payout,
  isOwnerOrAdmin,
  busy,
  onMarkPaid,
  onVoid,
  onReopen,
  onRecompute,
}: {
  payout: Payout;
  isOwnerOrAdmin: boolean;
  busy: boolean;
  onMarkPaid: () => void;
  onVoid: () => void;
  onReopen: () => void;
  onRecompute: () => void;
}) {
  const actions = allowedActions(payout.status).filter((a) => a !== "reopen" || isOwnerOrAdmin);
  const canRecompute = payout.status === "pending" || payout.status === "scheduled";
  if (actions.length === 0 && !canRecompute) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.includes("mark_paid") && (
          <DropdownMenuItem onClick={onMarkPaid}><Check className="h-4 w-4 mr-2" /> Mark Paid</DropdownMenuItem>
        )}
        {canRecompute && (
          <DropdownMenuItem onClick={onRecompute}><RefreshCw className="h-4 w-4 mr-2" /> Recompute from booking</DropdownMenuItem>
        )}
        {actions.includes("void") && (
          <DropdownMenuItem onClick={onVoid} className="text-destructive focus:text-destructive">
            <Ban className="h-4 w-4 mr-2" /> Void
          </DropdownMenuItem>
        )}
        {actions.includes("reopen") && (
          <DropdownMenuItem onClick={onReopen}><RotateCcw className="h-4 w-4 mr-2" /> Re-open</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-medium ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
