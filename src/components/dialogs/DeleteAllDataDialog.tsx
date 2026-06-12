import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Mail,
  Shield,
  Trash2,
  Loader2,
  Check,
  RefreshCw,
  Car,
  Users,
  Calendar,
  FileText,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useFleet } from "@/contexts/FleetContext";
import { supabase } from "@/integrations/supabase/client";

interface DeleteAllDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 1 | 2 | 3;

const CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

const LEAVING_REASONS = [
  { value: "switching", label: "Switching to another service" },
  { value: "closing", label: "Business closing" },
  { value: "cost", label: "Cost concerns" },
  { value: "features", label: "Missing features I need" },
  { value: "other", label: "Other" },
];

export const DeleteAllDataDialog = ({
  open,
  onOpenChange,
}: DeleteAllDataDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { vehicles, bookings, customers } = useFleet();

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Step 1: Acknowledgments
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [ack3, setAck3] = useState(false);

  // Step 2: Email sent state
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [deletionRequestId, setDeletionRequestId] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState("");

  // Step 3: Final confirmation
  const [confirmationInput, setConfirmationInput] = useState("");
  const [leavingReason, setLeavingReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [tokenFromUrl, setTokenFromUrl] = useState<string | null>(null);

  // Data counts for display
  const dataStats = {
    vehicles: vehicles?.length || 0,
    bookings: bookings?.length || 0,
    customers: customers?.length || 0,
    documents: 0, // Would need to fetch
  };

  // Check URL for confirmation token on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("deletion_token");
    if (token) {
      setTokenFromUrl(token);
      setStep(3);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setAck1(false);
      setAck2(false);
      setAck3(false);
      setEmailSent(false);
      setDeletionRequestId(null);
      setConfirmationInput("");
      setLeavingReason("");
    }
  }, [open]);

  // Mask email for display
  useEffect(() => {
    if (user?.email) {
      const [localPart, domain] = user.email.split("@");
      const masked =
        localPart.charAt(0) +
        "•".repeat(Math.min(localPart.length - 1, 4)) +
        "@" +
        domain;
      setMaskedEmail(masked);
    }
  }, [user]);

  const canProceedStep1 = ack1 && ack2 && ack3;
  const canProceedStep3 = confirmationInput === CONFIRMATION_PHRASE;

  const handleRequestDeletion = async () => {
    if (!user || !currentTeam) return;

    setIsRequestingDeletion(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-deletion-confirmation",
        {
          body: {
            teamId: currentTeam.id,
            userId: user.id,
            email: user.email,
          },
        }
      );

      if (error) throw error;

      setDeletionRequestId(data.requestId);
      setEmailSent(true);
      setStep(2);

      toast({
        title: "Confirmation Email Sent",
        description: "Please check your inbox to continue.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send confirmation email";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  const handleResendEmail = async () => {
    setIsRequestingDeletion(true);
    try {
      const { error } = await supabase.functions.invoke(
        "send-deletion-confirmation",
        {
          body: {
            teamId: currentTeam?.id,
            userId: user?.id,
            email: user?.email,
            resend: true,
            requestId: deletionRequestId,
          },
        }
      );

      if (error) throw error;

      toast({
        title: "Email Resent",
        description: "Please check your inbox.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to resend email";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  const handleFinalDelete = async () => {
    if (!canProceedStep3) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke(
        "confirm-data-deletion",
        {
          body: {
            token: tokenFromUrl || deletionRequestId,
            confirmationPhrase: confirmationInput,
            reason: leavingReason,
            teamId: currentTeam?.id,
          },
        }
      );

      if (error) throw error;

      toast({
        title: "Account Deleted",
        description: "All your data has been permanently deleted.",
        variant: "destructive",
      });

      // Sign out and redirect
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete data";
      toast({
        title: "Deletion Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const stepVariants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete All Data
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-0.5 ${
                    step > s ? "bg-destructive" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Terms & Warnings */}
          {step === 1 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* What will be deleted */}
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <h4 className="font-semibold text-destructive mb-3">
                  The following will be permanently deleted:
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-muted-foreground" />
                    All vehicles and their photos
                  </li>
                  <li className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    All bookings and payment history
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    All customer records and communications
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    All documents and files
                  </li>
                  <li className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    Subscription will be cancelled (no refund)
                  </li>
                </ul>
              </div>

              {/* Acknowledgments */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Please acknowledge the following:
                </h4>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={ack1}
                      onCheckedChange={(checked) => setAck1(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">
                      I understand this action is <strong>permanent</strong> and{" "}
                      <strong>cannot be undone</strong>. All data will be
                      irrecoverably deleted.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={ack2}
                      onCheckedChange={(checked) => setAck2(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">
                      I have <strong>exported all data</strong> I need to retain
                      before proceeding with this deletion.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={ack3}
                      onCheckedChange={(checked) => setAck3(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">
                      I understand my <strong>subscription will NOT be refunded</strong>{" "}
                      and will be cancelled immediately.
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={!canProceedStep1 || isRequestingDeletion}
                  onClick={handleRequestDeletion}
                >
                  {isRequestingDeletion ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Request Data Deletion
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Email Verification */}
          {step === 2 && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-6 text-center py-6"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-primary" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Check Your Email</h3>
                <p className="text-muted-foreground">
                  We&apos;ve sent a confirmation email to:
                </p>
                <Badge variant="secondary" className="text-base font-mono">
                  {maskedEmail}
                </Badge>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <p>
                  Click the link in the email to proceed with account deletion.
                  The link will expire in <strong>1 hour</strong>.
                </p>
              </div>

              <div className="pt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Didn&apos;t receive the email?
                </p>
                <Button
                  variant="outline"
                  onClick={handleResendEmail}
                  disabled={isRequestingDeletion}
                >
                  {isRequestingDeletion ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Resend Email
                </Button>
              </div>

              <Button
                variant="ghost"
                className="mt-4"
                onClick={() => onOpenChange(false)}
              >
                I&apos;ve changed my mind
              </Button>
            </motion.div>
          )}

          {/* Step 3: Final Confirmation */}
          {step === 3 && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Data counts warning */}
              <div className="p-4 rounded-lg bg-destructive text-destructive-foreground">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Final Warning
                </h4>
                <p className="text-sm mb-3">
                  This will permanently delete:
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <strong>{dataStats.vehicles}</strong> vehicles
                  </div>
                  <div>
                    <strong>{dataStats.bookings}</strong> bookings
                  </div>
                  <div>
                    <strong>{dataStats.customers}</strong> customers
                  </div>
                  <div>
                    All documents & files
                  </div>
                </div>
              </div>

              {/* Type to confirm */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Type <span className="font-mono font-bold text-destructive">{CONFIRMATION_PHRASE}</span> to confirm:
                </Label>
                <Input
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder={CONFIRMATION_PHRASE}
                  className={`font-mono ${
                    confirmationInput === CONFIRMATION_PHRASE
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }`}
                />
                {confirmationInput.length > 0 &&
                  confirmationInput !== CONFIRMATION_PHRASE && (
                    <p className="text-xs text-destructive">
                      Phrase must match exactly (case-sensitive)
                    </p>
                  )}
              </div>

              {/* Reason for leaving (optional) */}
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">
                  Reason for leaving (optional)
                </Label>
                <Select value={leavingReason} onValueChange={setLeavingReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVING_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={!canProceedStep3 || isDeleting}
                  onClick={handleFinalDelete}
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Permanently Delete All Data
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
