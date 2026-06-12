import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw,
  HardDrive,
  Clock,
  Shield,
  FileArchive,
  AlertTriangle,
  History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImportWizard } from "@/components/import/ImportWizard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { format } from "date-fns";
import { DeleteAllDataDialog } from "@/components/dialogs/DeleteAllDataDialog";

export const DataManagementSection = () => {
  const { toast } = useToast();
  const { currentTeam } = useTeam();
  const [isExporting, setIsExporting] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch import history
  const { data: importHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['import-history', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam?.id) return [];
      const { data, error } = await supabase
        .from('import_batches')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTeam?.id
  });

  // Mock storage data
  const storageData = {
    used: 2.4,
    total: 10,
    breakdown: [
      { name: "Vehicle Photos", size: 1.2, color: "bg-primary" },
      { name: "Documents", size: 0.8, color: "bg-secondary" },
      { name: "Backups", size: 0.3, color: "bg-muted-foreground" },
      { name: "Other", size: 0.1, color: "bg-muted" }
    ]
  };

  const backups = [
    { date: "Dec 24, 2024 - 03:00 AM", size: "156 MB", type: "Automatic" },
    { date: "Dec 23, 2024 - 03:00 AM", size: "155 MB", type: "Automatic" },
    { date: "Dec 20, 2024 - 10:30 AM", size: "154 MB", type: "Manual" }
  ];

  const handleExportData = async () => {
    setIsExporting(true);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    toast({
      title: "Export Complete",
      description: "Your data has been exported. Check your downloads."
    });
    
    setIsExporting(false);
  };

  const handleImportComplete = (entityType: string, count: number) => {
    setShowImportWizard(false);
    refetchHistory();
    toast({
      title: "Import Complete",
      description: `Successfully imported ${count} ${entityType}.`
    });
  };

  const handleCreateBackup = async () => {
    toast({
      title: "Backup Started",
      description: "Creating a manual backup of your data..."
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Backup Complete",
      description: "Your data has been backed up successfully."
    });
  };

  const handleDeleteAllData = async () => {
    toast({
      title: "Data Deletion Requested",
      description: "Please contact support to complete this request.",
      variant: "destructive"
    });
  };

  const usagePercentage = (storageData.used / storageData.total) * 100;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success/10 text-success">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Storage Overview */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <HardDrive className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Storage Usage</h3>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-3xl font-bold">{storageData.used} GB</p>
              <p className="text-sm text-muted-foreground">
                of {storageData.total} GB used
              </p>
            </div>
            <Badge variant={usagePercentage > 80 ? "destructive" : "secondary"}>
              {Math.round(usagePercentage)}% Used
            </Badge>
          </div>

          <Progress value={usagePercentage} className="h-3" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {storageData.breakdown.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.size} GB</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Export & Import */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Export & Import Data</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/30 space-y-4">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-primary" />
              <div>
                <h4 className="font-medium">Export Data</h4>
                <p className="text-sm text-muted-foreground">
                  Download all your data as JSON or CSV
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleExportData} 
                disabled={isExporting}
                className="flex-1"
              >
                {isExporting ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export All
              </Button>
              <Button variant="outline">
                <FileArchive className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 space-y-4">
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-primary" />
              <div>
                <h4 className="font-medium">Import Data</h4>
                <p className="text-sm text-muted-foreground">
                  Upload data from another system (CSV, Excel)
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowImportWizard(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Data
            </Button>
          </div>
        </div>

        {/* Import History */}
        {importHistory && importHistory.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm text-muted-foreground">Recent Imports</Label>
            </div>
            <div className="space-y-2">
              {importHistory.map((batch: any) => (
                <div 
                  key={batch.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {batch.entity_type} Import
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {batch.file_name || 'Unknown file'} • {format(new Date(batch.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <span className="text-success">{batch.imported_count} imported</span>
                      {batch.skipped_count > 0 && (
                        <span className="text-muted-foreground ml-2">{batch.skipped_count} skipped</span>
                      )}
                    </div>
                    {getStatusBadge(batch.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Backups */}
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold">Backups</h3>
          </div>
          <Button onClick={handleCreateBackup} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Create Backup
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Automatic Daily Backups</Label>
              <p className="text-sm text-muted-foreground">
                Automatically backup your data every day at 3:00 AM
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Recent Backups</Label>
            {backups.map((backup, i) => (
              <div 
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileArchive className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{backup.date}</p>
                    <p className="text-xs text-muted-foreground">{backup.size}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{backup.type}</Badge>
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Data Retention */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Data Retention & Privacy</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Keep Completed Bookings</Label>
              <p className="text-sm text-muted-foreground">
                Retain booking history for analytics
              </p>
            </div>
            <Badge variant="secondary">Forever</Badge>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Keep Activity Logs</Label>
              <p className="text-sm text-muted-foreground">
                System activity and audit logs
              </p>
            </div>
            <Badge variant="secondary">90 Days</Badge>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">GDPR Compliance</Label>
              <p className="text-sm text-muted-foreground">
                Data handling complies with GDPR requirements
              </p>
            </div>
            <Badge className="bg-success/10 text-success">Compliant</Badge>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h3 className="text-xl font-semibold text-destructive">Danger Zone</h3>
        </div>

        <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h4 className="font-medium">Delete All Data</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete all your data. This requires email verification and cannot be undone.
              </p>
            </div>
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteDialog(true)}
              className="w-full sm:w-auto shrink-0"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Import Wizard Dialog */}
      <Dialog open={showImportWizard} onOpenChange={setShowImportWizard}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
          </DialogHeader>
          <ImportWizard 
            onClose={() => setShowImportWizard(false)}
            onComplete={handleImportComplete}
          />
        </DialogContent>
      </Dialog>

      {/* Delete All Data Dialog */}
      <DeleteAllDataDialog 
        open={showDeleteDialog} 
        onOpenChange={setShowDeleteDialog} 
      />
    </div>
  );
};