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
import { Upload, FileCheck, Loader2, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Customer {
  id: string;
  full_name: string;
  email: string;
  insurance_provider: string | null;
  insurance_policy: string | null;
  insurance_expiry: string | null;
}

interface InsuranceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onComplete: () => void;
}

export const InsuranceUploadDialog = ({
  open,
  onOpenChange,
  customer,
  onComplete,
}: InsuranceUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [insuranceProvider, setInsuranceProvider] = useState(customer?.insurance_provider || "");
  const [policyNumber, setPolicyNumber] = useState(customer?.insurance_policy || "");
  const [expiryDate, setExpiryDate] = useState(customer?.insurance_expiry || "");
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

    if (!insuranceProvider || !policyNumber) {
      toast.error("Please fill in insurance provider and policy number");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${customer.id}/insurance-${Date.now()}.${fileExt}`;
      
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
          insurance_verified: true,
          insurance_document_url: publicUrl,
          insurance_verified_at: new Date().toISOString(),
          insurance_provider: insuranceProvider,
          insurance_policy: policyNumber,
          insurance_expiry: expiryDate || undefined,
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
    setInsuranceProvider(customer?.insurance_provider || "");
    setPolicyNumber(customer?.insurance_policy || "");
    setExpiryDate(customer?.insurance_expiry || "");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Upload Insurance Document
          </DialogTitle>
          <DialogDescription>
            Upload proof of insurance for {customer?.full_name}
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
                <img src={preview} alt="Insurance Preview" className="max-h-40 mx-auto rounded" />
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

          {/* Insurance Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="insurance-provider">Insurance Provider *</Label>
              <Input
                id="insurance-provider"
                placeholder="e.g., State Farm, GEICO, Progressive"
                value={insuranceProvider}
                onChange={(e) => setInsuranceProvider(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="policy-number">Policy Number *</Label>
              <Input
                id="policy-number"
                placeholder="e.g., POL-123456789"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry-date">Policy Expiry Date</Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || !insuranceProvider || !policyNumber || loading}>
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
