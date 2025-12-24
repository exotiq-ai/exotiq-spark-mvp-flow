import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, IdCard, Loader2, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Customer {
  id: string;
  full_name: string;
  email: string;
  drivers_license: string | null;
  license_expiry: string | null;
}

interface IDUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onComplete: () => void;
}

export const IDUploadDialog = ({
  open,
  onOpenChange,
  customer,
  onComplete,
}: IDUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [driversLicense, setDriversLicense] = useState(customer?.drivers_license || "");
  const [licenseExpiry, setLicenseExpiry] = useState(customer?.license_expiry || "");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Please upload a JPG, PNG, WebP, or PDF file");
        return;
      }
      
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }

      setFile(selectedFile);
      
      // Create preview for images
      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!customer || !file) {
      toast.error("Please select a file to upload");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${customer.id}/id-document-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("customer-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("customer-documents")
        .getPublicUrl(fileName);

      // Update customer record
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          id_verified: true,
          id_document_url: publicUrl,
          id_verified_at: new Date().toISOString(),
          drivers_license: driversLicense || undefined,
          license_expiry: licenseExpiry || undefined,
        })
        .eq("id", customer.id);

      if (updateError) throw updateError;

      onComplete();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setDriversLicense(customer?.drivers_license || "");
    setLicenseExpiry(customer?.license_expiry || "");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5" />
            Upload ID Document
          </DialogTitle>
          <DialogDescription>
            Upload a government-issued ID for {customer?.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              file ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            
            {preview ? (
              <div className="relative">
                <img src={preview} alt="ID Preview" className="max-h-40 mx-auto rounded" />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreview(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : file ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="font-medium">{file.name}</span>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">JPG, PNG, WebP, or PDF (max 10MB)</p>
              </>
            )}
          </div>

          {/* License Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="license-number">Driver's License Number</Label>
              <Input
                id="license-number"
                placeholder="e.g., DL123456789"
                value={driversLicense}
                onChange={(e) => setDriversLicense(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="license-expiry">License Expiry Date</Label>
              <Input
                id="license-expiry"
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload & Verify
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
