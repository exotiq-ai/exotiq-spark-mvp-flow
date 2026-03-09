import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, X } from "lucide-react";
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

  const handleDownload = async () => {
    if (!documentUrl) return;
    try {
      const response = await fetch(documentUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = documentName || "document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast({
        title: "Download failed",
        description: "Could not download the file. Try opening in a new tab.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-sm font-medium truncate pr-4">
            {documentName}
          </DialogTitle>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => documentUrl && window.open(documentUrl, "_blank")}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {documentUrl ? (
            <iframe
              src={documentUrl}
              className="w-full h-full border-0"
              title={documentName}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No document URL available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
