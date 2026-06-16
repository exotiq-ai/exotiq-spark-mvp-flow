import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
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
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure worker (Vite-friendly URL import)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

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

export const TenantDocumentSigner = ({ documentId, open, onOpenChange, onSigned }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [doc, setDoc] = useState<TenantDoc | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageWidth, setPageWidth] = useState<number>(700);
  const [loading, setLoading] = useState(true);
  const [printedName, setPrintedName] = useState("");
  const [title, setTitle] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sigRef = useRef<SignatureCanvasRef>(null);
  const pdfDocRef = useRef<any>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true); setError(null);
    setPrintedName(""); setTitle(""); setAcknowledged(false); setReviewed(false);
    setNumPages(0); setCurrentPage(1);

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

    if (td.status === "sent") {
      await supabase
        .from("tenant_documents")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", td.id);
    }

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

  // Track viewer width for responsive page rendering
  useEffect(() => {
    if (!viewerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(320, Math.min(900, e.contentRect.width - 32));
        setPageWidth(w);
      }
    });
    ro.observe(viewerRef.current);
    return () => ro.disconnect();
  }, [loading]);

  const pdfFile = useMemo(() => (pdfUrl ? { url: pdfUrl } : null), [pdfUrl]);

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

  /**
   * Read filled AcroForm values out of the loaded pdf.js document via
   * annotationStorage. Returns a flat string/boolean map keyed by field name.
   */
  const collectFormValues = async (): Promise<Record<string, string | boolean>> => {
    const result: Record<string, string | boolean> = {};
    const pdf = pdfDocRef.current;
    if (!pdf) return result;
    try {
      const storage = pdf.annotationStorage?.getAll?.() ?? {};
      // pdf.js keys storage entries by annotation id, not field name. Resolve
      // each to its underlying field name via the page's annotation list.
      const idToName = new Map<string, string>();
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const anns = await page.getAnnotations({ intent: "display" });
        for (const a of anns) {
          if (a.id && a.fieldName) idToName.set(a.id, a.fieldName);
        }
      }
      for (const [id, entry] of Object.entries(storage)) {
        const name = idToName.get(id);
        if (!name) continue;
        const e = entry as { value?: unknown };
        if (typeof e.value === "boolean") result[name] = e.value;
        else if (e.value != null) result[name] = String(e.value);
      }
    } catch (err) {
      console.warn("collectFormValues failed", err);
    }
    return result;
  };

  const handleSign = async () => {
    if (!doc || !sigRef.current) return;
    if (sigRef.current.isEmpty()) {
      toast({ title: "Signature required", variant: "destructive" });
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const pageCount = numPages || 1;
      const templateFields: TenantDocField[] = TENANT_DOC_TEMPLATES[doc.template].fields;
      const resolved = resolveFieldPages(templateFields, pageCount).map((f) => ({
        type: f.type, page: f.resolvedPage,
        x: f.x, y: f.y, width: f.width, height: f.height,
      }));

      const signatureDataUrl = sigRef.current.toDataURL();
      const form_values = await collectFormValues();

      const { data, error: fnErr } = await supabase.functions.invoke("sign-tenant-document", {
        body: {
          tenant_document_id: doc.id,
          signature_image_data_url: signatureDataUrl,
          printed_name: printedName.trim(),
          title: title.trim(),
          acknowledged: true,
          fields: resolved,
          form_values,
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
        <VisuallyHidden>
          <DialogTitle>{doc?.title ?? "Sign document"}</DialogTitle>
          <DialogDescription>
            Review and electronically sign {doc?.doc_ref ?? "this document"}.
          </DialogDescription>
        </VisuallyHidden>
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
            {/* PDF viewer (react-pdf w/ AcroForm) */}
            <div ref={viewerRef} className="bg-muted/30 min-h-[300px] overflow-auto flex flex-col items-center">
              {pdfFile && (
                <Document
                  file={pdfFile}
                  onLoadSuccess={(pdf) => {
                    pdfDocRef.current = pdf;
                    setNumPages(pdf.numPages);
                  }}
                  onLoadError={(err) => {
                    console.error("PDF load error", err);
                    setError("Could not render the document.");
                  }}
                  loading={
                    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Rendering…
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    width={pageWidth}
                    renderAnnotationLayer
                    renderForms
                    renderTextLayer={false}
                  />
                </Document>
              )}
              {numPages > 1 && (
                <div className="sticky bottom-0 left-0 right-0 flex items-center justify-center gap-2 py-2 bg-background/90 backdrop-blur border-t w-full">
                  <Button
                    size="sm" variant="ghost"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage} of {numPages}
                  </span>
                  <Button
                    size="sm" variant="ghost"
                    disabled={currentPage >= numPages}
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Signer panel */}
            <div className="border-l overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Sign this document</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Review the document, then sign below. Your signature will be
                  stamped on the last page and a signed copy saved to your
                  Vault. Exotiq retains a sealed compliance copy.
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
                <span>I have reviewed the document in full.</span>
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
