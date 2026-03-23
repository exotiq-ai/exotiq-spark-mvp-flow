import { useState, useRef } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Image, Loader2 } from "lucide-react";

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<{ url: string; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    vehicle_id: "",
    claim_type: "",
    severity: "",
    description: "",
    estimated_cost: "",
    insurance_claim_number: ""
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newPhotos: { url: string; name: string }[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to upload photos");
        return;
      }

      const { uploadVehiclePhoto } = await import('@/lib/photoUpload');

      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image file`);
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }

        const result = await uploadVehiclePhoto(
          file,
          `damage/${Date.now()}`,
          user.id,
          { preset: 'operational', bucket: 'damage-photos' }
        );

        if (result.error) {
          toast.error(`Failed to upload ${file.name}: ${result.error}`);
          continue;
        }

        newPhotos.push({ url: result.url, name: file.name });
      }

      setUploadedPhotos(prev => [...prev, ...newPhotos]);
      if (newPhotos.length > 0) {
        toast.success(`Uploaded ${newPhotos.length} photo(s)`);
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      toast.error("Failed to upload photos");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        insurance_claim_number: validation.data.insurance_claim_number || undefined,
        photo_urls: uploadedPhotos.map(p => p.url)
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
      setUploadedPhotos([]);
      
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

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label>Damage Photos</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                id="damage-photo-upload"
              />
              <label
                htmlFor="damage-photo-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {isUploading ? "Uploading..." : "Click to upload damage photos"}
                </span>
                <span className="text-xs text-muted-foreground">
                  JPG, PNG up to 10MB each
                </span>
              </label>
            </div>

            {/* Uploaded Photos Preview */}
            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {uploadedPhotos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="w-full h-24 object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Photos stored securely in encrypted cloud storage
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
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {isSubmitting ? "Creating..." : "Create Claim"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};