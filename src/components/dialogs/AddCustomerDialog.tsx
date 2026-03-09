import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Database } from "@/integrations/supabase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { validators, validateForm } from "@/lib/validation";
import { toast } from "@/hooks/use-toast";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (customer: Omit<Database['public']['Tables']['customers']['Insert'], 'user_id'>) => Promise<void>;
}

export const AddCustomerDialog = ({
  open,
  onOpenChange,
  onSubmit,
}: AddCustomerDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [isVIP, setIsVIP] = useState(false);
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
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate form
    const validation = validateForm([
      () => validators.required(formData.full_name, 'Full name'),
      () => validators.email(formData.email),
      () => formData.phone ? validators.phone(formData.phone) : { isValid: true },
    ]);

    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    setLoading(true);
    
    try {
      await onSubmit({
        ...formData,
        customer_status: isVIP ? 'vip' : 'active',
        lifetime_value: 0,
        total_bookings: 0,
      });
      
      // Reset form
      setFormData({
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
        emergency_contact_name: "",
        emergency_contact_phone: "",
      });
      setIsVIP(false);
      setError(null);
      onOpenChange(false);
      
      toast({
        title: "Success",
        description: "Customer added successfully",
      });
    } catch (err) {
      setError("Failed to add customer. Please try again.");
      console.error("Error adding customer:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
          <DialogDescription>
            Enter customer details to add them to your CRM system
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
            {/* VIP Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div>
                <Label htmlFor="vip" className="text-base">VIP Customer</Label>
                <p className="text-sm text-muted-foreground">Mark as high-value customer</p>
              </div>
              <Switch
                id="vip"
                checked={isVIP}
                onCheckedChange={setIsVIP}
              />
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main St, City, State"
                  />
                </div>
              </div>
            </div>

            {/* License Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground">Driver's License</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="drivers_license">License Number</Label>
                  <Input
                    id="drivers_license"
                    value={formData.drivers_license}
                    onChange={(e) => setFormData({ ...formData, drivers_license: e.target.value })}
                    placeholder="D1234567"
                  />
                </div>
                <div>
                  <Label htmlFor="license_expiry">Expiry Date</Label>
                  <Input
                    id="license_expiry"
                    type="date"
                    value={formData.license_expiry}
                    onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Insurance Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground">Insurance Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="insurance_provider">Provider</Label>
                  <Input
                    id="insurance_provider"
                    value={formData.insurance_provider}
                    onChange={(e) => setFormData({ ...formData, insurance_provider: e.target.value })}
                    placeholder="Geico"
                  />
                </div>
                <div>
                  <Label htmlFor="insurance_policy">Policy Number</Label>
                  <Input
                    id="insurance_policy"
                    value={formData.insurance_policy}
                    onChange={(e) => setFormData({ ...formData, insurance_policy: e.target.value })}
                    placeholder="POL-123456"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="insurance_expiry">Expiry Date</Label>
                  <Input
                    id="insurance_expiry"
                    type="date"
                    value={formData.insurance_expiry}
                    onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special preferences or notes about this customer..."
                className="h-24"
              />
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
                  Adding...
                </>
              ) : (
                "Add Customer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
