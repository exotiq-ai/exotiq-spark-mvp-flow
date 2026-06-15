import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TENANT_DOC_TEMPLATES } from "@/lib/signing/tenantDocTemplates";

interface Team { id: string; name: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teams: Team[];
  onSent: () => void;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

export const SendTenantDocumentDialog = ({ open, onOpenChange, teams, onSent }: Props) => {
  const { toast } = useToast();
  const [teamId, setTeamId] = useState("");
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<keyof typeof TENANT_DOC_TEMPLATES>("order_form");
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTeamId(""); setTitle(""); setTemplate("order_form");
    setSignerName(""); setSignerTitle(""); setSignerEmail("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => { reset(); onOpenChange(false); };

  const handleSend = async () => {
    if (!teamId || !title.trim() || !file) {
      toast({ title: "Tenant, title and PDF are required", variant: "destructive" });
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
      toast({ title: "Only PDF files are supported", variant: "destructive" });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "PDF exceeds 25MB", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const pdf_base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("prepare-tenant-document", {
        body: {
          team_id: teamId,
          title: title.trim(),
          template,
          signer_name: signerName.trim() || undefined,
          signer_title: signerTitle.trim() || undefined,
          signer_email: signerEmail.trim() || undefined,
          pdf_base64,
        },
      });
      if (error) throw error;
      toast({
        title: "Document sent",
        description: `${(data as { doc_ref?: string })?.doc_ref ?? ""} delivered to the tenant.`,
      });
      reset();
      onSent();
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to send document", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send document for signature</DialogTitle>
          <DialogDescription>
            Upload a PDF. The tenant's account owner or admin will be notified to review and sign in-app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="td-team">Tenant</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger id="td-team"><SelectValue placeholder="Select a tenant…" /></SelectTrigger>
              <SelectContent className="z-[60]">
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name ?? t.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="td-title">Document title</Label>
            <Input
              id="td-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Founding Partner Order Form" maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="td-template">Template</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as keyof typeof TENANT_DOC_TEMPLATES)}>
              <SelectTrigger id="td-template"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[60]">
                {Object.values(TENANT_DOC_TEMPLATES).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TENANT_DOC_TEMPLATES[template].description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="td-signer-name">Expected signer name (optional)</Label>
              <Input id="td-signer-name" value={signerName} onChange={(e) => setSignerName(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="td-signer-title">Signer title (optional)</Label>
              <Input id="td-signer-title" value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="td-signer-email">Signer email (optional)</Label>
            <Input id="td-signer-email" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} maxLength={200} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="td-file">PDF</Label>
            <Input
              id="td-file" ref={fileRef} type="file" accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSend} disabled={submitting || !teamId || !title || !file}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : <><Upload className="h-4 w-4 mr-2" />Send</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
