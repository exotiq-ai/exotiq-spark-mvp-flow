import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { toast } from "sonner";

const TYPES = [
  "fuel","insurance","maintenance","cleaning","storage","registration","detailing",
  "toll","parking","damage","transport","tax","overhead","other",
];

type Template = {
  id?: string;
  name: string;
  expense_type: string;
  amount: number;
  vendor: string | null;
  notes: string | null;
  cadence: "monthly" | "quarterly" | "annual";
  day_of_month: number;
  next_run_at: string;
  vehicle_id: string | null;
  is_active: boolean;
};

const empty = (): Template => ({
  name: "", expense_type: "insurance", amount: 0, vendor: "", notes: "",
  cadence: "monthly", day_of_month: 1,
  next_run_at: new Date().toISOString().slice(0, 10),
  vehicle_id: null, is_active: true,
});

export function RecurringTemplateDialog({
  open, onOpenChange, onSaved, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  initial?: Template | null;
}) {
  const { currentTeam } = useTeam();
  const [form, setForm] = useState<Template>(empty());
  const [vehicles, setVehicles] = useState<{ id: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial ? { ...initial } : empty());
  }, [initial, open]);

  useEffect(() => {
    if (!currentTeam?.id) return;
    supabase.from("vehicles").select("id, make, model").eq("team_id", currentTeam.id).then(({ data }) => {
      setVehicles((data || []).map((v: any) => ({ id: v.id, label: `${v.make} ${v.model}` })));
    });
  }, [currentTeam?.id]);

  const save = async () => {
    if (!currentTeam?.id) return;
    if (!form.name || form.amount <= 0) return toast.error("Name and amount are required");
    setSaving(true);
    const payload = {
      team_id: currentTeam.id,
      name: form.name,
      expense_type: form.expense_type,
      amount: form.amount,
      vendor: form.vendor || null,
      notes: form.notes || null,
      cadence: form.cadence,
      day_of_month: form.day_of_month,
      next_run_at: form.next_run_at,
      vehicle_id: form.vehicle_id || null,
      is_active: form.is_active,
    };
    const res = initial?.id
      ? await supabase.from("recurring_expense_templates").update(payload).eq("id", initial.id)
      : await supabase.from("recurring_expense_templates").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(initial?.id ? "Template updated" : "Recurring expense added");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit recurring expense" : "New recurring expense"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Garage rent" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={form.expense_type} onValueChange={(v) => setForm({ ...form, expense_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[60]">
                  {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vendor (optional)</Label>
            <Input value={form.vendor || ""} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Cadence</Label>
              <Select value={form.cadence} onValueChange={(v: any) => setForm({ ...form, cadence: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[60]">
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Next run</Label>
              <Input type="date" value={form.next_run_at} onChange={(e) => setForm({ ...form, next_run_at: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vehicle (optional — overhead if blank)</Label>
            <Select value={form.vehicle_id || "none"} onValueChange={(v) => setForm({ ...form, vehicle_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Overhead" /></SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="none">Overhead (no vehicle)</SelectItem>
                {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
