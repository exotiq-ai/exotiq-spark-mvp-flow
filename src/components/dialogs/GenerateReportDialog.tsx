import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFleet } from "@/contexts/FleetContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { BarChart3, FileText, TrendingUp, FolderOpen, Users, Download, Sparkles, Loader2, FileJson, FileSpreadsheet } from "lucide-react";
import { exportToCSV, exportToJSON, exportToPDF } from "@/lib/exportUtils";

interface GenerateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate?: (reportType: string, dateRange: { start: string; end: string }, format: string) => Promise<void>;
}

export const GenerateReportDialog = ({ 
  open, 
  onOpenChange, 
  onGenerate 
}: GenerateReportDialogProps) => {
  const { bookings, vehicles, customers, payments, documents } = useFleet();
  const [reportType, setReportType] = useState("revenue");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  const reportTypes = [
    { value: "revenue", label: "Revenue Report", icon: TrendingUp, description: "Revenue breakdown and payment analytics" },
    { value: "utilization", label: "Fleet Utilization", icon: BarChart3, description: "Vehicle usage and performance metrics" },
    { value: "bookings", label: "Booking History", icon: FileText, description: "Complete booking records and status" },
    { value: "customers", label: "Customer Analytics", icon: Users, description: "Customer lifetime value and activity" },
    { value: "documents", label: "Document Status", icon: FolderOpen, description: "Compliance and document expiry tracking" }
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportType || !startDate || !endDate) return;

    setLoading(true);
    setReportData(null);
    setAiInsights(null);

    try {
      // Call edge function with data
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: {
          reportType,
          dateRange: { start: startDate, end: endDate },
          format: exportFormat,
          data: { bookings, vehicles, customers, payments, documents },
        },
      });

      if (error) throw error;

      setReportData(data.content);
      setAiInsights(data.aiInsights);

      toast("Report generated successfully");
    } catch (error) {
      console.error("Report generation error:", error);
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!reportData) return;

    const fileName = `${reportType}-report-${format(new Date(), "yyyy-MM-dd")}`;
    const selectedReport = reportTypes.find(r => r.value === reportType);

    try {
      if (exportFormat === "csv") {
        exportToCSV(reportData.details || [], fileName);
        toast("CSV exported successfully");
      } else if (exportFormat === "json") {
        exportToJSON(reportData, fileName);
        toast("JSON exported successfully");
      } else if (exportFormat === "pdf") {
        await exportToPDF(
          {
            title: `${selectedReport?.label || reportType} - ${format(new Date(startDate), "MMM d")} to ${format(new Date(endDate), "MMM d, yyyy")}`,
            content: reportData,
            summary: reportData.summary
          },
          fileName
        );
        toast("PDF export initiated", { description: "Check your browser's print dialog" });
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error("Export failed", { description: error.message });
    }
  };

  const selectedReport = reportTypes.find(r => r.value === reportType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Report
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <form onSubmit={handleGenerate} className="space-y-4 px-1">
            {/* Report Type Selection */}
            <div className="space-y-2">
              <Label>Report Type</Label>
              <div className="grid grid-cols-1 gap-2">
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  const isSelected = reportType === type.value;
                  return (
                    <div
                      key={type.value}
                      onClick={() => setReportType(type.value)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? "border-primary bg-primary/10" 
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <div className="flex-1">
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                        {isSelected && <Badge>Selected</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Export Format */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      CSV Spreadsheet
                    </div>
                  </SelectItem>
                  <SelectItem value="json">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      JSON Data
                    </div>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      PDF Document
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading} className="w-full btn-premium">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>

            {/* Report Results */}
            {reportData && (
              <>
                <Separator />
                
                {/* Summary */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Report Summary</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {reportData.summary && Object.entries(reportData.summary).map(([key, value]) => (
                      <div key={key} className="p-3 rounded-lg bg-muted/30 border">
                        <div className="text-xs text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </div>
                        <div className="text-lg font-bold">
                          {typeof value === "number" && key.toLowerCase().includes("value") 
                            ? `$${(value as number).toLocaleString()}`
                            : typeof value === "number" && key.toLowerCase().includes("rate")
                              ? `${value}%`
                              : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Insights */}
                {aiInsights && (
                  <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">AI Insights</span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiInsights}</p>
                  </div>
                )}

                {/* Export Button */}
                <Button onClick={handleExport} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export as {exportFormat.toUpperCase()}
                </Button>
              </>
            )}
          </form>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
