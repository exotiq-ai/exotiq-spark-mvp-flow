import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";

interface DocumentOption {
  id: string;
  name: string;
  doc_ref: string | null;
  created_at: string | null;
  is_default: boolean | null;
  file_url: string;
}

interface DocumentPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (document: DocumentOption) => void;
}

export const DocumentPicker = ({ open, onOpenChange, onSelect }: DocumentPickerProps) => {
  const { currentTeam } = useTeam();
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !currentTeam?.id) return;

    const fetchDocs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, doc_ref, created_at, is_default, file_url")
        .eq("team_id", currentTeam.id)
        .eq("type", "Rental Agreement")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (!error && data) {
        setDocuments(data);
        const defaultDoc = data.find((d) => d.is_default);
        if (defaultDoc) setSelected(defaultDoc.id);
      }
      setLoading(false);
    };

    fetchDocs();
  }, [open, currentTeam?.id]);

  const handleConfirm = () => {
    const doc = documents.find((d) => d.id === selected);
    if (doc) onSelect(doc);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Rental Agreement
          </DialogTitle>
          <DialogDescription>
            Choose which rental agreement to use for this signing ceremony.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No rental agreements found. Upload one in the Vault first.
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2 p-1">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelected(doc.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    selected === doc.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selected === doc.id ? "bg-primary/10" : "bg-muted"}`}>
                    <FileText className={`h-4 w-4 ${selected === doc.id ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.doc_ref || "No ref"} • {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.is_default && (
                      <Badge variant="secondary" className="text-[10px]">Default</Badge>
                    )}
                    {selected === doc.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selected || documents.length === 0}>
            Continue to Signing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
