import { useState, useRef, useCallback, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Loader2,
  CheckCircle2,
  Car,
  Calendar as CalendarIcon,
  User,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { SignatureCanvas, SignatureCanvasRef } from "./SignatureCanvas";
import { ExotiqLogoCompact } from "@/components/common/ExotiqLogo";
import { VehicleThumbnail } from "@/components/common/VehicleThumbnail";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Celebration } from "@/components/common/MicroInteractions";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
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

const ACKNOWLEDGEMENTS = [
  "I have read and understand all terms and conditions of this Agreement.",
  "I confirm that I hold a valid driver's license and am legally authorized to operate a motor vehicle.",
  "I confirm that my insurance policy covers exotic/high-value vehicles and have provided proof of coverage.",
  "I have inspected the Vehicle and acknowledge its current condition as documented.",
  "I understand that I am personally liable for any damage, loss, or violation occurring during the rental period.",
  "I understand that the Vehicle is equipped with GPS tracking and I consent to location monitoring.",
  "I have been informed of the Vehicle's fuel requirements (91+ octane premium fuel).",
  "I understand that this Vehicle may not be operated by anyone not listed on this Agreement.",
];

type Step = "review" | "acknowledge" | "sign" | "complete";

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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [acknowledgements, setAcknowledgements] = useState<boolean[]>(new Array(ACKNOWLEDGEMENTS.length).fill(false));
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const { currentTeam } = useTeam();

  const allAcknowledged = acknowledgements.every(Boolean);

  const resetState = useCallback(() => {
    setStep("review");
    setAgreed(false);
    setSignerName(booking.customer_name || "");
    setHasSignature(false);
    setLoading(false);
    setCompletedDocRef(null);
    setCelebrate(false);
    setAcknowledgements(new Array(ACKNOWLEDGEMENTS.length).fill(false));
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
  }, [booking.customer_name, pdfBlobUrl]);

  // Fetch PDF as blob for iframe preview
  useEffect(() => {
    if (!open || !rentalDoc.file_url) return;
    let cancelled = false;
    setPdfLoading(true);

    fetch(rentalDoc.file_url)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
      })
      .catch((err) => {
        console.error("Failed to fetch PDF for preview:", err);
      })
      .finally(() => {
        if (!cancelled) setPdfLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, rentalDoc.file_url]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  // Prevent accidental navigation when signing is in progress
  useEffect(() => {
    if (!open) return;
    const inProgress = (step === "sign" || step === "acknowledge") && (hasSignature || agreed || acknowledgements.some(Boolean));
    if (!inProgress) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open, step, hasSignature, agreed, acknowledgements]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && (step === "sign" || step === "acknowledge") && (hasSignature || agreed || acknowledgements.some(Boolean))) {
      setShowCloseConfirm(true);
      return;
    }
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    resetState();
    onOpenChange(false);
  };

  // Extract storage path from file_url
  const getStoragePath = (fileUrl: string): string => {
    const signMatch = fileUrl.match(/\/object\/sign\/customer-documents\/([^?]+)/);
    if (signMatch) return decodeURIComponent(signMatch[1]);
    const pubMatch = fileUrl.match(/\/object\/public\/customer-documents\/([^?]+)/);
    if (pubMatch) return decodeURIComponent(pubMatch[1]);
    return fileUrl;
  };

  const toggleAcknowledgement = (index: number) => {
    setAcknowledgements((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
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

      // Upload signature image
      const sigBase64 = signatureDataUrl.split(",")[1];
      const sigBytes = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));
      const sigFileName = `signatures/${user.id}/${booking.id}-${Date.now()}.png`;

      const { error: sigUploadError } = await supabase.storage
        .from("customer-documents")
        .upload(sigFileName, sigBytes, { contentType: "image/png" });
      if (sigUploadError) throw sigUploadError;

      const { data: sigUrlData } = await supabase.storage
        .from("customer-documents")
        .createSignedUrl(sigFileName, 31536000);

      // Get operator name from team or user profile
      const operatorName = currentTeam?.name || user.user_metadata?.full_name || "Operator";

      // Call edge function to generate signed PDF
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "generate-signed-pdf",
        {
          body: {
            originalPdfPath,
            signatureImageDataUrl: signatureDataUrl,
            signerName: signerName.trim(),
            operatorName,
            docRef: rentalDoc.doc_ref,
            bookingDetails: {
              vehicleName: booking.vehicle_name,
              customerName: booking.customer_name,
              startDate: format(new Date(booking.start_date), "MMM d, yyyy"),
              endDate: format(new Date(booking.end_date), "MMM d, yyyy"),
              totalValue: booking.total_value,
            },
            timestamp,
            acknowledgements: ACKNOWLEDGEMENTS.map((text, i) => ({
              text,
              acknowledged: acknowledgements[i],
              acknowledgedAt: timestamp,
            })),
          },
        }
      );

      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);

      const { data: signedPdfUrl } = await supabase.storage
        .from("customer-documents")
        .createSignedUrl(result.signedPdfPath, 31536000);

      const signingMetadata = {
        ip: result.clientIp || "unknown",
        userAgent: navigator.userAgent,
        deviceType: /iPad|iPhone|Android|Mobile/.test(navigator.userAgent) ? "mobile" : "desktop",
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        signedAt: timestamp,
        acknowledgements: ACKNOWLEDGEMENTS.map((text, i) => ({
          text,
          acknowledged: acknowledgements[i],
          acknowledgedAt: timestamp,
        })),
      };

      const { data: insertedDoc, error: insertError } = await supabase
        .from("documents")
        .insert({
          name: `Signed - ${rentalDoc.name}`,
          type: "rental_agreement",
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
      setCelebrate(true);
      onComplete(newDocRef);
    } catch (error: any) {
      console.error("Signing error:", error);
      toast.error(error.message || "Failed to complete signing");
    } finally {
      setLoading(false);
    }
  };

  const stepTitle = {
    review: "Review Rental Agreement",
    acknowledge: "Renter Acknowledgements",
    sign: "Sign Document",
    complete: "Signing Complete",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:rounded-none max-sm:border-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <ExotiqLogoCompact variant="auto" />
              <Separator orientation="vertical" className="h-5" />
              <span className="flex items-center gap-2">
                {step === "acknowledge" ? <ShieldCheck className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                {stepTitle[step]}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Progress indicator */}
          {step !== "complete" && (
            <div className="flex items-center gap-1 px-1">
              {(["review", "acknowledge", "sign"] as const).map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    s === step ? "bg-primary" : (["review", "acknowledge", "sign"].indexOf(step) > i ? "bg-primary/40" : "bg-muted")
                  }`}
                />
              ))}
            </div>
          )}

          {/* Booking context card */}
          {step !== "complete" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
              <VehicleThumbnail
                vehicleName={booking.vehicle_name || "Vehicle"}
                size="sm"
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
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
            </div>
          )}

          <Separator />

          {/* Step: Review */}
          {step === "review" && (
            <div className="space-y-4">
              <div className="rounded-lg border overflow-hidden bg-muted/20">
                {pdfLoading ? (
                  <div className="w-full h-[400px] max-sm:h-[50dvh] flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <iframe
                    src={pdfBlobUrl || rentalDoc.file_url}
                    className="w-full h-[400px] max-sm:h-[50dvh]"
                    title="Rental Agreement Preview"
                  />
                )}
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  {rentalDoc.doc_ref && `Ref: ${rentalDoc.doc_ref} • `}
                  {rentalDoc.name}
                </p>
                <Button onClick={() => setStep("acknowledge")}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step: Acknowledge */}
          {step === "acknowledge" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please review and confirm each item below before signing.
              </p>
              <ScrollArea className="h-[400px] max-sm:h-[50dvh] pr-4">
                <div className="space-y-3">
                  {ACKNOWLEDGEMENTS.map((text, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        acknowledgements[i] ? "bg-success/5 border-success/30" : "hover:bg-muted/30"
                      }`}
                      onClick={() => toggleAcknowledgement(i)}
                    >
                      <Checkbox
                        checked={acknowledgements[i]}
                        onCheckedChange={() => toggleAcknowledgement(i)}
                        className="mt-0.5"
                      />
                      <span className="text-sm leading-relaxed">{text}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={() => setStep("review")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {acknowledgements.filter(Boolean).length}/{ACKNOWLEDGEMENTS.length} confirmed
                  </span>
                  <Button onClick={() => setStep("sign")} disabled={!allAcknowledged}>
                    Continue to Sign
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Sign */}
          {step === "sign" && (
            <div className="space-y-6">
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

              <div className="space-y-2">
                <Label htmlFor="signer-name">Printed Name</Label>
                <Input
                  id="signer-name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <Label>Signature</Label>
                <SignatureCanvas
                  ref={signatureRef}
                  onSignatureChange={setHasSignature}
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("acknowledge")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
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

      {/* Close confirmation */}
      <ConfirmationDialog
        open={showCloseConfirm}
        onOpenChange={setShowCloseConfirm}
        title="Cancel Signing?"
        description="You have an in-progress signature. Closing now will discard your work."
        confirmText="Discard & Close"
        cancelText="Continue Signing"
        variant="destructive"
        onConfirm={confirmClose}
      />

      {/* Celebration confetti */}
      <Celebration
        trigger={celebrate}
        message="Document signed! 🎉"
        variant="success"
      />
    </>
  );
};
