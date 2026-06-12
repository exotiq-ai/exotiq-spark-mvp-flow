import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database } from "@/integrations/supabase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { validators, validateForm } from "@/lib/validation";
import { toast } from "@/hooks/use-toast";
import { isFeatureEnabled } from "@/lib/featureFlags";

type Customer = Database['public']['Tables']['customers']['Row'];

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  onSubmit: (customerId: string, updates: Partial<Customer>) => Promise<void>;
}

export const EditCustomerDialog = ({
  open,
  onOpenChange,
  customer,
  onSubmit,
}: EditCustomerDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    secondary_phone: "",
    drivers_license: "",
    license_expiry: "",
    insurance_provider: "",
    insurance_policy: "",
    insurance_expiry: "",
    date_of_birth: "",
    address: "",
    notes: "",
    customer_status: "active",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  useEffect(() => {
    if (open && customer) {
      setFormData({
        full_name: customer.full_name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        secondary_phone: (customer as any).secondary_phone || "",
        drivers_license: customer.drivers_license || "",
        license_expiry: customer.license_expiry || "",
        insurance_provider: customer.insurance_provider || "",
        insurance_policy: customer.insurance_policy || "",
        insurance_expiry: customer.insurance_expiry || "",
        date_of_birth: customer.date_of_birth || "",
        address: customer.address || "",
        notes: customer.notes || "",
        customer_status: customer.customer_status || "active",
        emergency_contact_name: (customer as any).emergency_contact_name || "",
        emergency_contact_phone: (customer as any).emergency_contact_phone || "",
      });
      setError(null);
    }
  }, [open, customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validateForm([
      () => validators.required(formData.full_name, 'Full name'),
      () => validators.email(formData.email),
      () => formData.phone ? validators.phone(formData.phone) : { isValid: true },
      () => formData.secondary_phone ? validators.phone(formData.secondary_phone) : { isValid: true },
      () => formData.emergency_contact_phone ? validators.phone(formData.emergency_contact_phone) : { isValid: true },
    ]);

    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    setLoading(true);
    try {
      await onSubmit(customer.id, {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone || null,
        drivers_license: formData.drivers_license || null,
        license_expiry: formData.license_expiry || null,
        insurance_provider: formData.insurance_provider || null,
        insurance_policy: formData.insurance_policy || null,
        insurance_expiry: formData.insurance_expiry || null,
        date_of_birth: formData.date_of_birth || null,
        address: formData.address || null,
        notes: formData.notes || null,
        customer_status: formData.customer_status,
        // Cast for new columns not yet in generated types
        ...(formData.secondary_phone !== undefined && { secondary_phone: formData.secondary_phone || null } as any),
        ...(formData.emergency_contact_name !== undefined && { emergency_contact_name: formData.emergency_contact_name || null } as any),
        ...(formData.emergency_contact_phone !== undefined && { emergency_contact_phone: formData.emergency_contact_phone || null } as any),
      });

      onOpenChange(false);
      toast({
        title: "Customer updated",
        description: `${formData.full_name}'s information has been saved`,
      });
    } catch (err) {
      setError("Failed to update customer. Please try again.");
      console.error("Error updating customer:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update information for {customer.full_name}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Customer Status</Label>
              <Select value={formData.customer_status} onValueChange={(v) => updateField("customer_status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="blacklisted">Blacklisted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="edit_full_name">Full Name *</Label>
                  <Input id="edit_full_name" required value={formData.full_name} onChange={(e) => updateField("full_name", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit_email">Email *</Label>
                  <Input id="edit_email" type="email" required value={formData.email} onChange={(e) => updateField("email", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit_phone">Phone</Label>
                  <Input id="edit_phone" type="tel" value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit_secondary_phone">Secondary Phone</Label>
                  <Input id="edit_secondary_phone" type="tel" value={formData.secondary_phone} onChange={(e) => updateField("secondary_phone", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit_dob">Date of Birth</Label>
                  <Input id="edit_dob" type="date" value={formData.date_of_birth} onChange={(e) => updateField("date_of_birth", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit_address">Address</Label>
                  <Input id="edit_address" value={formData.address} onChange={(e) => updateField("address", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground">Emergency Contact</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_ec_name">Contact Name</Label>
                  <Input id="edit_ec_name" value={formData.emergency_contact_name} onChange={(e) => updateField("emergency_contact_name", e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <Label htmlFor="edit_ec_phone">Contact Phone</Label>
                  <Input id="edit_ec_phone" type="tel" value={formData.emergency_contact_phone} onChange={(e) => updateField("emergency_contact_phone", e.target.value)} placeholder="+1 555 000 0000" />
                </div>
              </div>
            </div>

            {/* License */}
            {/* DPA §3.8: typed government identifier (DL number) input is gated.
                Existing stored values are preserved on save — we just hide the
                form input so new values can't be added via this path. */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground">Driver's License</h4>
              <div className={isFeatureEnabled('driversLicenseNumberField') ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
                {isFeatureEnabled('driversLicenseNumberField') && (
                  <div>
                    <Label htmlFor="edit_license">License Number</Label>
                    <Input id="edit_license" value={formData.drivers_license} onChange={(e) => updateField("drivers_license", e.target.value)} />
                  </div>
                )}
                <div>
                  <Label htmlFor="edit_license_exp">Expiry Date</Label>
                  <Input id="edit_license_exp" type="date" value={formData.license_expiry} onChange={(e) => updateField("license_expiry", e.target.value)} />
                </div>
              </div>
            </div>


            {/* Insurance */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground">Insurance Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_ins_provider">Provider</Label>
                  <Input id="edit_ins_provider" value={formData.insurance_provider} onChange={(e) => updateField("insurance_provider", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit_ins_policy">Policy Number</Label>
                  <Input id="edit_ins_policy" value={formData.insurance_policy} onChange={(e) => updateField("insurance_policy", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit_ins_exp">Expiry Date</Label>
                  <Input id="edit_ins_exp" type="date" value={formData.insurance_expiry} onChange={(e) => updateField("insurance_expiry", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea id="edit_notes" value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} className="h-24" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="btn-premium">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
