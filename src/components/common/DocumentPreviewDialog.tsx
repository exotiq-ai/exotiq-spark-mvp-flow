import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentUrl: string | null;
  documentName: string;
}

export const DocumentPreviewDialog = ({
  open,
  onOpenChange,
  documentUrl,
  documentName,
}: DocumentPreviewDialogProps) => {
  const { toast } = useToast();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);

  useEffect(() => {
    if (!open || !documentUrl) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      return;
    }
    let cancelled = false;
    setBlobLoading(true);
    fetch(documentUrl)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return;
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        // Fallback to direct URL
        if (!cancelled) setBlobUrl(documentUrl);
      })
      .finally(() => { if (!cancelled) setBlobLoading(false); });
    return () => { cancelled = true; };
  }, [open, documentUrl]);

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

// ... keep existing code

        <div className="flex-1 min-h-0">
          {blobLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={documentName}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No document URL available
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
};
