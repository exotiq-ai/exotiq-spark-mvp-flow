import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFleet } from "@/contexts/FleetContext";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { z } from "zod";

const damageClaimSchema = z.object({
  vehicle_id: z.string().uuid({ message: "Valid vehicle selection required" }),
  claim_type: z.enum(["accident", "vandalism", "theft", "mechanical", "weather", "other"], {
    errorMap: () => ({ message: "Please select a valid claim type" })
  }),
  severity: z.enum(["minor", "moderate", "major"], {
    errorMap: () => ({ message: "Please select a valid severity level" })
  }),
  description: z.string()
    .trim()
    .min(10, { message: "Description must be at least 10 characters" })
    .max(2000, { message: "Description must be less than 2000 characters" }),
  estimated_cost: z.string()
    .optional()
    .refine((val) => {
      if (!val || val === "") return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 1000000;
    }, { message: "Estimated cost must be between $0 and $1,000,000" }),
  insurance_claim_number: z.string()
    .trim()
    .max(100, { message: "Insurance claim number must be less than 100 characters" })
    .optional()
});

type Vehicle = Tables<"vehicles">;

interface DamageReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
}

export const DamageReportDialog = ({ open, onOpenChange, vehicles }: DamageReportDialogProps) => {
  const { createDamageClaim } = useFleet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    vehicle_id: "",
    claim_type: "",
    severity: "",
    description: "",
    estimated_cost: "",
    insurance_claim_number: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data with zod schema
    const validation = damageClaimSchema.safeParse(formData);
    
    if (!validation.success) {
      const errors = validation.error.errors;
      toast.error(errors[0].message);
      return;
    }

    setIsSubmitting(true);
    try {
      await createDamageClaim({
        vehicle_id: validation.data.vehicle_id,
        claim_type: validation.data.claim_type,
        severity: validation.data.severity,
        description: validation.data.description,
        estimated_cost: validation.data.estimated_cost ? parseFloat(validation.data.estimated_cost) : undefined,
        insurance_claim_number: validation.data.insurance_claim_number || undefined
      });

      // Reset form
      setFormData({
        vehicle_id: "",
        claim_type: "",
        severity: "",
        description: "",
        estimated_cost: "",
        insurance_claim_number: ""
      });
      
      toast.success("Damage claim created successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to create damage claim. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Damage Claim</DialogTitle>
          <DialogDescription>
            Create a new damage claim report for a vehicle
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vehicle Selection */}
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle *</Label>
            <Select value={formData.vehicle_id} onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} - {vehicle.license_plate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Claim Type */}
          <div className="space-y-2">
            <Label htmlFor="claim_type">Claim Type *</Label>
            <Select value={formData.claim_type} onValueChange={(value) => setFormData({ ...formData, claim_type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accident">Accident</SelectItem>
                <SelectItem value="vandalism">Vandalism</SelectItem>
                <SelectItem value="theft">Theft</SelectItem>
                <SelectItem value="mechanical">Mechanical</SelectItem>
                <SelectItem value="weather">Weather Damage</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label htmlFor="severity">Severity *</Label>
            <Select value={formData.severity} onValueChange={(value) => setFormData({ ...formData, severity: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">Minor - Cosmetic only</SelectItem>
                <SelectItem value="moderate">Moderate - Requires repair</SelectItem>
                <SelectItem value="major">Major - Vehicle out of service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the damage in detail..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              maxLength={2000}
              required
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/2000 characters
            </p>
          </div>

          {/* Estimated Cost */}
          <div className="space-y-2">
            <Label htmlFor="estimated_cost">Estimated Cost</Label>
            <Input
              id="estimated_cost"
              type="number"
              step="0.01"
              min="0"
              max="1000000"
              placeholder="0.00"
              value={formData.estimated_cost}
              onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
            />
          </div>

          {/* Insurance Claim Number */}
          <div className="space-y-2">
            <Label htmlFor="insurance_claim_number">Insurance Claim Number</Label>
            <Input
              id="insurance_claim_number"
              placeholder="Optional"
              maxLength={100}
              value={formData.insurance_claim_number}
              onChange={(e) => setFormData({ ...formData, insurance_claim_number: e.target.value })}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Claim"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
