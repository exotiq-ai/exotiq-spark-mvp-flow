import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SignatureCanvas, type SignatureCanvasRef } from "@/components/signing/SignatureCanvas";
import {
  TENANT_DOC_TEMPLATES,
  resolveFieldPages,
  ESIGN_ACKNOWLEDGEMENT,
  type TenantDocField,
} from "@/lib/signing/tenantDocTemplates";

interface TenantDoc {
  id: string;
  doc_ref: string | null;
  title: string;
  template: keyof typeof TENANT_DOC_TEMPLATES;
  team_id: string;
  original_storage_path: string;
  status: "sent" | "viewed" | "signed" | "voided";
  signer_name: string | null;
  signer_title: string | null;
}

interface Props {
  documentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSigned?: () => void;
}

/**
 * Tenant signing ceremony. Loads the pending tenant_documents row, renders the
 * original PDF via native browser viewer (iframe), and captures signature +
 * printed name + title. On submit, calls the sign-tenant-document edge function
 * which overlays the signature, appends a Certificate of Completion, and stores
 * the signed PDF in both the tenant Vault and the Exotiq compliance bucket.
 */
export const TenantDocumentSigner = ({ documentId, open, onOpenChange, onSigned }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [doc, setDoc] = useState<TenantDoc | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [printedName, setPrintedName] = useState("");
  const [title, setTitle] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sigRef = useRef<SignatureCanvasRef>(null);

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true); setError(null);
    setPrintedName(""); setTitle(""); setAcknowledged(false); setReviewed(false);

    const { data, error: qErr } = await supabase
      .from("tenant_documents")
      .select("id, doc_ref, title, template, team_id, original_storage_path, status, signer_name, signer_title")
      .eq("id", documentId)
      .maybeSingle();
    if (qErr || !data) {
      setError("Could not load this document.");
      setLoading(false);
      return;
    }
    const td = data as TenantDoc;
    setDoc(td);
    setPrintedName(td.signer_name ?? "");
    setTitle(td.signer_title ?? "");

    // Mark viewed if still 'sent'
    if (td.status === "sent") {
      await supabase
        .from("tenant_documents")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", td.id);
    }

    // Signed URL for the original PDF in the compliance bucket
    const { data: signed, error: urlErr } = await supabase.storage
      .from("exotiq-compliance")
      .createSignedUrl(td.original_storage_path, 60 * 30);
    if (urlErr || !signed?.signedUrl) {
      setError("Could not load the document file.");
    } else {
      setPdfUrl(signed.signedUrl);
    }
    setLoading(false);
  }, [documentId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const canSubmit =
    doc &&
    doc.status !== "signed" &&
    doc.status !== "voided" &&
    printedName.trim().length > 1 &&
    title.trim().length > 1 &&
    acknowledged &&
    reviewed &&
    !!sigRef.current &&
    !sigRef.current.isEmpty() &&
    !submitting;

  const handleSign = async () => {
    if (!doc || !sigRef.current) return;
    if (sigRef.current.isEmpty()) {
      toast({ title: "Signature required", variant: "destructive" });
      return;
    }
    setSubmitting(true); setError(null);
    try {
      // Get original page count via fetching the bytes once
      let pageCount = 1;
      if (pdfUrl) {
        try {
          const head = await fetch(pdfUrl);
          const buf = await head.arrayBuffer();
          // Count "/Type /Page" not "/Type /Pages" — quick heuristic
          const text = new TextDecoder("latin1").decode(new Uint8Array(buf));
          const matches = text.match(/\/Type\s*\/Page[^s]/g);
          pageCount = matches?.length ?? 1;
        } catch {
          pageCount = 1;
        }
      }

      const templateFields: TenantDocField[] = TENANT_DOC_TEMPLATES[doc.template].fields;
      const resolved = resolveFieldPages(templateFields, pageCount).map((f) => ({
        type: f.type, page: f.resolvedPage,
        x: f.x, y: f.y, width: f.width, height: f.height,
      }));

      const signatureDataUrl = sigRef.current.toDataURL();

      const { data, error: fnErr } = await supabase.functions.invoke("sign-tenant-document", {
        body: {
          tenant_document_id: doc.id,
          signature_image_data_url: signatureDataUrl,
          printed_name: printedName.trim(),
          title: title.trim(),
          acknowledged: true,
          fields: resolved,
        },
      });
      if (fnErr) throw fnErr;
      toast({
        title: "Signed",
        description: `Signed copy saved to your Vault (${(data as { doc_ref?: string })?.doc_ref ?? ""}).`,
      });
      onSigned?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setError("Could not record your signature. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[1100px] w-[95vw] h-[92vh] p-0 flex flex-col gap-0 overflow-hidden"
        data-testid="tenant-document-signer"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{doc?.title ?? "Loading…"}</p>
              {doc?.doc_ref && (
                <Badge variant="outline" className="font-mono text-[10px] mt-0.5">
                  {doc.doc_ref}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost" size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading document…
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_360px] overflow-hidden">
            {/* PDF viewer */}
            <div className="bg-muted/30 min-h-[300px]">
              {pdfUrl && (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full"
                  title={doc?.title ?? "Document"}
                />
              )}
            </div>

            {/* Signer panel */}
            <div className="border-l overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Sign this document</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Your signature will be stamped on the document and stored in your Vault.
                  Exotiq retains a sealed copy for compliance.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tds-name">Printed full name</Label>
                <Input
                  id="tds-name" value={printedName}
                  onChange={(e) => setPrintedName(e.target.value)}
                  placeholder={user?.user_metadata?.full_name ?? "Your full name"}
                  maxLength={200} autoComplete="name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tds-title">Your title</Label>
                <Input
                  id="tds-title" value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Founder, CEO, Owner…" maxLength={200}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Signature</Label>
                <SignatureCanvas ref={sigRef} />
              </div>

              <label className="flex items-start gap-2 text-xs">
                <Checkbox
                  checked={reviewed}
                  onCheckedChange={(v) => setReviewed(v === true)}
                  className="mt-0.5"
                />
                <span>
                  I have reviewed the document in full.
                </span>
              </label>

              <label className="flex items-start gap-2 text-xs">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v === true)}
                  className="mt-0.5"
                />
                <span>{ESIGN_ACKNOWLEDGEMENT}</span>
              </label>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                disabled={!canSubmit}
                onClick={handleSign}
              >
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing…</> : "Sign and submit"}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                Electronic signature recorded under ESIGN Act and UETA.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TenantDocumentSigner;
