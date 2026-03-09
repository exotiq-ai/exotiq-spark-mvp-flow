import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Loader2,
  CheckCircle2,
  Car,
  Calendar as CalendarIcon,
  User,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { SignatureCanvas, SignatureCanvasRef } from "./SignatureCanvas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface BookingInfo {
  id: string;
  customer_name: string;
  customer_email?: string | null;
  vehicle_name?: string | null;
  vehicle_id?: string | null;
  customer_id?: string | null;
  start_date: string;
  end_date: string;
  total_value: number;
  daily_rate: number;
}

interface DocumentInfo {
  id: string;
  name: string;
  file_url: string;
  doc_ref?: string | null;
  team_id?: string | null;
}

interface SigningCeremonyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingInfo;
  document: DocumentInfo;
  onComplete: (signedDocRef: string) => void;
}

type Step = "review" | "sign" | "complete";

export const SigningCeremony = ({
  open,
  onOpenChange,
  booking,
  document: rentalDoc,
  onComplete,
}: SigningCeremonyProps) => {
  const [step, setStep] = useState<Step>("review");
  const [agreed, setAgreed] = useState(false);
  const [signerName, setSignerName] = useState(booking.customer_name || "");
  const [hasSignature, setHasSignature] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completedDocRef, setCompletedDocRef] = useState<string | null>(null);
  const signatureRef = useRef<SignatureCanvasRef>(null);

  const resetState = useCallback(() => {
    setStep("review");
    setAgreed(false);
    setSignerName(booking.customer_name || "");
    setHasSignature(false);
    setLoading(false);
    setCompletedDocRef(null);
  }, [booking.customer_name]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  // Extract storage path from file_url
  const getStoragePath = (fileUrl: string): string => {
    // Signed URLs contain the path after /object/sign/customer-documents/
    const signMatch = fileUrl.match(/\/object\/sign\/customer-documents\/([^?]+)/);
    if (signMatch) return decodeURIComponent(signMatch[1]);

    // Public URLs contain the path after /object/public/customer-documents/
    const pubMatch = fileUrl.match(/\/object\/public\/customer-documents\/([^?]+)/);
    if (pubMatch) return decodeURIComponent(pubMatch[1]);

    // Fallback: assume it's already a path
    return fileUrl;
  };

  const handleSign = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast.error("Please provide your signature");
      return;
    }

    if (!signerName.trim()) {
      toast.error("Please enter your printed name");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const signatureDataUrl = signatureRef.current.toDataURL();
      if (!signatureDataUrl) throw new Error("Failed to capture signature");

      const timestamp = new Date().toISOString();
      const originalPdfPath = getStoragePath(rentalDoc.file_url);

      // Upload signature image to storage
      const sigBase64 = signatureDataUrl.split(",")[1];
      const sigBytes = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));
      const sigFileName = `signatures/${user.id}/${booking.id}-${Date.now()}.png`;

      const { error: sigUploadError } = await supabase.storage
        .from("customer-documents")
        .upload(sigFileName, sigBytes, { contentType: "image/png" });

      if (sigUploadError) throw sigUploadError;

      // Get signed URL for signature
      const { data: sigUrlData } = await supabase.storage
        .from("customer-documents")
        .createSignedUrl(sigFileName, 31536000);

      // Call edge function to generate signed PDF
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "generate-signed-pdf",
        {
          body: {
            originalPdfPath,
            signatureImageDataUrl: signatureDataUrl,
            signerName: signerName.trim(),
            docRef: rentalDoc.doc_ref,
            bookingDetails: {
              vehicleName: booking.vehicle_name,
              customerName: booking.customer_name,
              startDate: format(new Date(booking.start_date), "MMM d, yyyy"),
              endDate: format(new Date(booking.end_date), "MMM d, yyyy"),
              totalValue: booking.total_value,
            },
            timestamp,
          },
        }
      );

      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);

      // Get signed URL for the completed PDF
      const { data: signedPdfUrl } = await supabase.storage
        .from("customer-documents")
        .createSignedUrl(result.signedPdfPath, 31536000);

      // Capture signing metadata
      const signingMetadata = {
        ip: result.clientIp || "unknown",
        userAgent: navigator.userAgent,
        deviceType: /iPad|iPhone|Android|Mobile/.test(navigator.userAgent) ? "mobile" : "desktop",
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        signedAt: timestamp,
      };

      // Insert signed document record
      const { data: insertedDoc, error: insertError } = await supabase
        .from("documents")
        .insert({
          name: `Signed - ${rentalDoc.name}`,
          type: "Signed Rental Agreement",
          file_url: signedPdfUrl?.signedUrl || result.signedPdfPath,
          user_id: user.id,
          team_id: rentalDoc.team_id || null,
          booking_id: booking.id,
          customer_id: booking.customer_id || null,
          vehicle_id: booking.vehicle_id || null,
          signed_at: timestamp,
          signed_by_name: signerName.trim(),
          signature_image_url: sigUrlData?.signedUrl || sigFileName,
          signing_metadata: signingMetadata,
          parent_document_id: rentalDoc.id,
          status: "active",
        })
        .select("doc_ref")
        .single();

      if (insertError) throw insertError;

      const newDocRef = insertedDoc?.doc_ref || "Unknown";
      setCompletedDocRef(newDocRef);
      setStep("complete");
      onComplete(newDocRef);
    } catch (error: any) {
      console.error("Signing error:", error);
      toast.error(error.message || "Failed to complete signing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {step === "review" && "Review Rental Agreement"}
            {step === "sign" && "Sign Document"}
            {step === "complete" && "Signing Complete"}
          </DialogTitle>
        </DialogHeader>

        {/* Booking header */}
        {step !== "complete" && (
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{booking.customer_name}</span>
            </div>
            {booking.vehicle_name && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="h-3.5 w-3.5" />
                <span>{booking.vehicle_name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>
                {format(new Date(booking.start_date), "MMM d")} — {format(new Date(booking.end_date), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        )}

        <Separator />

        {/* Step: Review */}
        {step === "review" && (
          <div className="space-y-4">
            <div className="rounded-lg border overflow-hidden bg-muted/20">
              <iframe
                src={rentalDoc.file_url}
                className="w-full h-[400px]"
                title="Rental Agreement Preview"
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                {rentalDoc.doc_ref && `Ref: ${rentalDoc.doc_ref} • `}
                {rentalDoc.name}
              </p>
              <Button onClick={() => setStep("sign")}>
                Continue to Sign
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Sign */}
        {step === "sign" && (
          <div className="space-y-6">
            {/* Agreement checkbox */}
            <div className="flex items-start gap-3 p-4 rounded-lg border">
              <Checkbox
                id="agree-terms"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="agree-terms" className="text-sm leading-relaxed cursor-pointer">
                I have read and understand the rental agreement above. I agree to all terms and conditions
                outlined in this document.
              </label>
            </div>

            {/* Printed name */}
            <div className="space-y-2">
              <Label htmlFor="signer-name">Printed Name</Label>
              <Input
                id="signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            {/* Signature canvas */}
            <div className="space-y-2">
              <Label>Signature</Label>
              <SignatureCanvas
                ref={signatureRef}
                onSignatureChange={setHasSignature}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("review")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Review
              </Button>
              <Button
                onClick={handleSign}
                disabled={!agreed || !hasSignature || !signerName.trim() || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Signing
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <div className="flex flex-col items-center py-8 space-y-4 text-center">
            <div className="p-4 rounded-full bg-success/10">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </div>
            <h3 className="text-xl font-semibold">Document Signed Successfully</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              The signed rental agreement has been filed in the Vault and linked to this booking.
            </p>
            {completedDocRef && (
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {completedDocRef}
              </Badge>
            )}
            <Button onClick={() => handleClose(false)} className="mt-4">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
