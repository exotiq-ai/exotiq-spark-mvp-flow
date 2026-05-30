// ─────────────────────────────────────────────────────────────────────────────
// DPA §3.8 — RECEIPT/INVOICE OCR
// Receipts may contain financial account numbers (card PANs, ACH details),
// which are prohibited under our signed Lovable DPA §3.8. This flow uploads
// images to the `expense-receipts` Supabase bucket and invokes the
// `parse-expense-receipt` edge function, which routes through the Lovable AI
// Gateway to Google Gemini — all Lovable-managed.
//
// Entry points are gated by the `receiptScanning` feature flag. Do NOT
// re-enable on the Lovable path. Future implementation: call Google
// Document AI / Vision directly with our own GCP credentials, bypassing the
// AI Gateway entirely.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Sparkles, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isFeatureEnabled } from "@/lib/featureFlags";

type Status = "queued" | "uploading" | "parsing" | "done" | "error";
type Item = { file: File; status: Status; error?: string; expenseId?: string };

export function ReceiptUploadDialog({
  open, onOpenChange, onComplete,
}: { open: boolean; onOpenChange: (v: boolean) => void; onComplete: () => void }) {
  const { currentTeam } = useTeam();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // DPA §3.8 safeguard: defensive render-time block in case the dialog is
  // ever invoked while the feature flag is off.
  if (!isFeatureEnabled('receiptScanning')) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receipt scanning unavailable</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Coming soon — pending a compliant OCR integration.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }


  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setItems((prev) => [
      ...prev,
      ...Array.from(files).map((f) => ({ file: f, status: "queued" as Status })),
    ]);
  };

  const processOne = async (idx: number, item: Item): Promise<{ ok: boolean }> => {
    if (!currentTeam?.id || !user?.id) return { ok: false };
    const set = (patch: Partial<Item>) =>
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

    set({ status: "uploading" });
    const path = `${currentTeam.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${item.file.name}`;
    const { error: upErr } = await supabase.storage
      .from("expense-receipts")
      .upload(path, item.file, { cacheControl: "3600", upsert: false });
    if (upErr) { set({ status: "error", error: upErr.message }); return { ok: false }; }

    set({ status: "parsing" });
    try {
      const { data, error } = await supabase.functions.invoke("parse-expense-receipt", {
        body: { receipt_path: path, team_id: currentTeam.id },
      });
      if (error) throw error;
      set({ status: "done", expenseId: data?.expense_id });
      return { ok: true };
    } catch (e: any) {
      console.error("parse-expense-receipt invoke failed:", e);
      set({ status: "error", error: e?.message || "AI could not read this file" });
      return { ok: false };
    }
  };

  const runAll = async () => {
    setRunning(true);
    // 3-worker pool with local success/error tracking (avoids stale state)
    const queue = items.map((it, idx) => ({ it, idx })).filter(({ it }) => it.status === "queued" || it.status === "error");
    let okCount = 0;
    let errCount = 0;
    const workers = Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const next = queue.shift();
        if (!next) break;
        try {
          const res = await processOne(next.idx, next.it);
          if (res?.ok) okCount++;
          else errCount++;
        } catch {
          errCount++;
        }
      }
    });
    await Promise.all(workers);
    setRunning(false);
    if (okCount > 0) toast.success(`${okCount} receipt${okCount === 1 ? "" : "s"} added to Review queue`);
    if (errCount > 0) toast.error(`${errCount} file${errCount === 1 ? "" : "s"} failed — check the list`);
    onComplete();
    // Auto-close + reset only when everything succeeded
    if (errCount === 0 && okCount > 0) {
      setItems([]);
      onOpenChange(false);
    }
  };

  const done = items.filter((i) => i.status === "done").length;
  const total = items.length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!running) onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Upload Receipts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          >
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm">Drag receipts here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">PDF or image · we'll read them with AI and route to Review</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              {running && <Progress value={(done / Math.max(total, 1)) * 100} className="h-1.5" />}
              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                    <span className="truncate flex-1">{it.file.name}</span>
                    <span className="ml-2 shrink-0">
                      {it.status === "queued" && <span className="text-muted-foreground">Queued</span>}
                      {it.status === "uploading" && <Loader2 className="h-3 w-3 animate-spin" />}
                      {it.status === "parsing" && <span className="text-primary flex items-center gap-1"><Sparkles className="h-3 w-3" /> Parsing</span>}
                      {it.status === "done" && <Check className="h-3 w-3 text-success" />}
                      {it.status === "error" && <span className="text-destructive flex items-center gap-1"><X className="h-3 w-3" /> {it.error}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>
            {done > 0 ? "Done" : "Cancel"}
          </Button>
          <Button onClick={runAll} disabled={running || items.length === 0 || items.every((i) => i.status === "done")}>
            {running ? "Processing…" : `Process ${items.filter(i => i.status !== "done").length} file(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
