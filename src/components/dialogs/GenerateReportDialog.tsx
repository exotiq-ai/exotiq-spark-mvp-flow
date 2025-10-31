import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart3, FileText, TrendingUp, FolderOpen } from "lucide-react";

interface GenerateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (reportType: string, dateRange: { start: string; end: string }, format: string) => Promise<void>;
}

export const GenerateReportDialog = ({ 
  open, 
  onOpenChange, 
  onGenerate 
}: GenerateReportDialogProps) => {
  const [reportType, setReportType] = useState("revenue");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState("pdf");
  const [loading, setLoading] = useState(false);

  const reportTypes = [
    { value: "revenue", label: "Revenue Report", icon: TrendingUp },
    { value: "utilization", label: "Fleet Utilization", icon: BarChart3 },
    { value: "bookings", label: "Booking History", icon: FileText },
    { value: "documents", label: "Document Status", icon: FolderOpen }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reportType || !startDate || !endDate) {
      return;
    }

    setLoading(true);
    try {
      await onGenerate(reportType, { start: startDate, end: endDate }, format);
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reportType">Report Type *</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center">
                        <Icon className="w-4 h-4 mr-2" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Export Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF Document</SelectItem>
                <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                <SelectItem value="excel">Excel Workbook</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-primary/20">
            <p className="text-sm text-muted-foreground">
              The report will include detailed insights and analytics for the selected date range.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Generating..." : "Generate Report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
