import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface PaymentExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PaymentExportDialog = ({
  open,
  onOpenChange,
}: PaymentExportDialogProps) => {
  const [format_, setFormat] = useState<"csv" | "quickbooks" | "pdf">("csv");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to export");
        return;
      }

      if (format_ === "pdf") {
        // For PDF, we'll generate client-side
        await generatePDF();
      } else {
        // For CSV and QuickBooks, use the edge function
        const { data, error } = await supabase.functions.invoke("export-payments", {
          body: {
            format: format_,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
          },
        });

        if (error) throw error;

        // Create blob and download
        const blob = new Blob([data], { 
          type: format_ === "csv" ? "text/csv" : "text/plain" 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payments-${format_}-${format(new Date(), "yyyy-MM-dd")}.${format_ === "csv" ? "csv" : "iif"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`${format_.toUpperCase()} export downloaded successfully`);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export payments");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    // Fetch payment data
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("payments")
      .select(`
        id,
        amount,
        payment_type,
        payment_method,
        payment_status,
        transaction_date,
        notes,
        created_at,
        bookings (
          customer_name,
          customer_email,
          vehicles (name, make, model)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data: payments, error } = await query;
    if (error) throw error;

    // Generate HTML for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1 { color: #1a1a2e; border-bottom: 2px solid #e94560; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #1a1a2e; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .total { font-weight: bold; font-size: 18px; margin-top: 20px; }
            .status-completed { color: #10b981; }
            .status-pending { color: #f59e0b; }
            .status-failed { color: #ef4444; }
          </style>
        </head>
        <body>
          <h1>Payment Report</h1>
          <p>Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
          ${startDate || endDate ? `<p>Period: ${startDate || "Start"} to ${endDate || "Present"}</p>` : ""}
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Type</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${(payments || []).map(p => {
                const booking = p.bookings as { customer_name: string; vehicles: { make: string; model: string } | null } | null;
                return `
                  <tr>
                    <td>${p.created_at ? format(new Date(p.created_at), "MMM d, yyyy") : "N/A"}</td>
                    <td>${booking?.customer_name || "Unknown"}</td>
                    <td>${booking?.vehicles ? `${booking.vehicles.make} ${booking.vehicles.model}` : "N/A"}</td>
                    <td>${p.payment_type || "N/A"}</td>
                    <td>${p.payment_method || "N/A"}</td>
                    <td>$${p.amount?.toLocaleString() || "0"}</td>
                    <td class="status-${p.payment_status?.toLowerCase()}">${p.payment_status || "N/A"}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
          
          <p class="total">
            Total: $${(payments || []).reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
          </p>
        </body>
      </html>
    `;

    // Open in new window for printing
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }

    toast.success("PDF generated - use browser print to save");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Payments
          </DialogTitle>
          <DialogDescription>
            Download your payment history in your preferred format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup
              value={format_}
              onValueChange={(value) => setFormat(value as typeof format_)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="font-medium">CSV Spreadsheet</p>
                    <p className="text-sm text-muted-foreground">Excel, Google Sheets compatible</p>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="quickbooks" id="quickbooks" />
                <Label htmlFor="quickbooks" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">QuickBooks (IIF)</p>
                    <p className="text-sm text-muted-foreground">Import directly to QuickBooks</p>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileText className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium">PDF Report</p>
                    <p className="text-sm text-muted-foreground">Printable payment report</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date (Optional)</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date (Optional)</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
