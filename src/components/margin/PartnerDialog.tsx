import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePartners, type VehiclePartner } from "@/hooks/usePartners";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partner?: VehiclePartner | null;
}

const PAYOUT_METHODS = [
  { value: "ach", label: "ACH / Bank Transfer" },
  { value: "wire", label: "Wire" },
  { value: "check", label: "Check" },
  { value: "stripe", label: "Stripe Connect" },
  { value: "other", label: "Other" },
];

export function PartnerDialog({ open, onOpenChange, partner }: Props) {
  const { create, update } = usePartners();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(partner?.name || "");
    setEmail(partner?.email || "");
    setPhone(partner?.phone || "");
    setPayoutMethod(partner?.payout_method || "");
    setNotes(partner?.notes || "");
    setIsActive(partner?.is_active ?? true);
  }, [open, partner]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        payout_method: payoutMethod || null,
        notes: notes.trim() || null,
        is_active: isActive,
      };
      if (partner) {
        await update(partner.id, payload);
        toast.success("Partner updated");
      } else {
        await create(payload);
        toast.success("Partner created");
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save partner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{partner ? "Edit Partner" : "New Partner"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} id="partner-form" className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="p-name">Name *</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-phone">Phone</Label>
              <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payout Method</Label>
            <Select value={payoutMethod} onValueChange={setPayoutMethod}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                {PAYOUT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-notes">Notes</Label>
            <Textarea id="p-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Inactive partners won't appear in vehicle assignment.</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button form="partner-form" type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {partner ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
