import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const TYPES = [
  "fuel", "insurance", "maintenance", "cleaning", "storage", "registration",
  "detailing", "toll", "parking", "damage", "transport", "tax", "overhead", "other",
];

export function AddExpenseDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { currentTeam } = useTeam();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<{ id: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    expense_type: "maintenance",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    vehicle_id: "",
    vendor: "",
    notes: "",
  });
  const [receipt, setReceipt] = useState<File | null>(null);

  useEffect(() => {
    if (!open || !currentTeam?.id) return;
    supabase.from("vehicles").select("id, make, model").eq("team_id", currentTeam.id).then(({ data }) => {
      setVehicles((data || []).map((v: any) => ({ id: v.id, label: `${v.make} ${v.model}` })));
    });
  }, [open, currentTeam?.id]);

  const submit = async () => {
    if (!currentTeam?.id || !user?.id) return;
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    setSaving(true);
    let receipt_url: string | null = null;
    if (receipt) {
      const path = `${currentTeam.id}/${Date.now()}-${receipt.name}`;
      const { error: upErr } = await supabase.storage.from("expense-receipts").upload(path, receipt);
      if (upErr) {
        toast.error(`Receipt upload failed: ${upErr.message}`);
        setSaving(false);
        return;
      }
      receipt_url = path;
    }
    const { error } = await supabase.from("vehicle_expenses").insert({
      team_id: currentTeam.id,
      expense_type: form.expense_type,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      vehicle_id: form.vehicle_id || null,
      vendor: form.vendor || null,
      notes: form.notes || null,
      receipt_url,
      source_module: "margin_manual",
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense added");
    onCreated();
    onOpenChange(false);
    setForm({ expense_type: "maintenance", amount: "", expense_date: new Date().toISOString().slice(0, 10), vehicle_id: "", vendor: "", notes: "" });
    setReceipt(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.expense_type} onValueChange={(v) => setForm({ ...form, expense_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[60]">
                  {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (USD)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Vehicle (optional — leave blank for overhead)</Label>
            <Select value={form.vehicle_id || "none"} onValueChange={(v) => setForm({ ...form, vehicle_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Overhead" /></SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="none">Overhead (no specific vehicle)</SelectItem>
                {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Receipt (optional)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
