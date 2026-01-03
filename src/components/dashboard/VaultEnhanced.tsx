import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { DocumentUploadDialog } from "@/components/dialogs/DocumentUploadDialog";
import { DamageClaimsSection } from "@/components/dashboard/DamageClaimsSection";
import { PaymentsSection } from "@/components/dashboard/PaymentsSection";
import { VerificationSection } from "@/components/dashboard/VerificationSection";
import { ComplianceStackedBar } from "@/components/charts/ComplianceStackedBar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import { useToast } from "@/hooks/use-toast";
import { SkeletonCard, SkeletonMetric } from "@/components/ui/skeleton-card";
import { EmptyState } from "@/components/common/EmptyState";
import { 
  Shield, 
  FileText, 
  AlertTriangle, 
  CheckCircle,
  Upload,
  Eye,
  Download,
  Calendar,
  ArrowRight,
  CreditCard,
  UserCheck,
  ChevronDown,
  ChevronUp,
  X
} from "lucide-react";

export const VaultEnhanced = () => {
  const { documents, uploadDocument, deleteDocument, loading } = useLocationFilteredFleet();
  const { toast } = useToast();
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [alertExpanded, setAlertExpanded] = useState(false);

  const urgentAlert = {
    title: "License Expiring Soon",
    document: "Driver License - Sarah M.",
    vehicle: "Porsche 911 GT3",
    daysLeft: 5,
    priority: "high"
  };

  const complianceScore = {
    percentage: 87,
    status: "good",
    itemsCompliant: 36,
    itemsTotal: 42
  };

  const categories = [
    { name: "Insurance", status: "compliant", items: 12, expiring: 2, icon: Shield },
    { name: "Registration", status: "warning", items: 10, expiring: 4, icon: FileText },
    { name: "Inspections", status: "compliant", items: 8, expiring: 1, icon: CheckCircle },
    { name: "Licenses", status: "urgent", items: 6, expiring: 1, icon: AlertTriangle }
  ];

  const recentDocuments = Array.isArray(documents) ? documents.slice(0, 5) : [];

  const handleDownload = (docName: string) => {
    toast({
      title: "Download Started",
      description: `Downloading ${docName}...`,
    });
  };

  const handleView = (docName: string) => {
    toast({
      title: "Opening Document",
      description: `Opening ${docName} in viewer...`,
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
        <SkeletonCard />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
        </div>
      </div>
    );
  }

  return (
    <>
      <DocumentUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onSubmit={uploadDocument}
      />

      <ModuleTabs
        tabs={[
          { id: "documents", label: "Documents", shortLabel: "Docs", icon: FileText },
          { id: "payments", label: "Payments", shortLabel: "Pay", icon: CreditCard },
          { id: "verification", label: "Verification", shortLabel: "ID", icon: UserCheck },
          { id: "claims", label: "Claims", shortLabel: "Claims", icon: AlertTriangle },
        ]}
        defaultValue="documents"
      >
        <TabsContent value="documents" className="space-y-4 sm:space-y-6">
      {/* Compact Urgent Alert - Collapsible */}
      {!alertDismissed && (
        <Collapsible open={alertExpanded} onOpenChange={setAlertExpanded}>
          <Card className="border-l-4 border-l-warning bg-warning/5 overflow-hidden">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-1.5 bg-warning/20 rounded-lg flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{urgentAlert.title}</span>
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {urgentAlert.daysLeft}d left
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{urgentAlert.document}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); setAlertDismissed(true); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  {alertExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-0 space-y-3">
                <div className="text-xs text-muted-foreground">
                  Vehicle: {urgentAlert.vehicle}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setShowUploadDialog(true)}
                  >
                    <Upload className="w-3 h-3 mr-1.5" />
                    Renew Now
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 text-xs"
                  >
                    View Details
                    <ArrowRight className="w-3 h-3 ml-1.5" />
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Compliance Score */}
      <Card className="card-premium p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-semibold">Compliance Overview</h3>
          <Badge className={complianceScore.status === 'good' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
            {complianceScore.status.toUpperCase()}
          </Badge>
        </div>

        <div className="flex items-center justify-center mb-4 sm:mb-6">
          <div className="relative text-center">
            <div className="text-4xl sm:text-6xl font-bold text-primary">{complianceScore.percentage}%</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
              {complianceScore.itemsCompliant} of {complianceScore.itemsTotal} items compliant
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {categories.map((category) => (
            <div key={category.name} className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/30 text-center hover-scale cursor-pointer">
              <category.icon className={`h-5 w-5 sm:h-6 sm:w-6 mx-auto mb-1 sm:mb-2 ${
                category.status === 'compliant' ? 'text-success' :
                category.status === 'warning' ? 'text-warning' : 'text-destructive'
              }`} />
              <div className="font-semibold text-xs sm:text-sm mb-0.5 sm:mb-1">{category.name}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">{category.items} items</div>
              {category.expiring > 0 && (
                <div className="text-[10px] sm:text-xs text-warning mt-0.5 sm:mt-1">{category.expiring} expiring</div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Compliance Distribution Chart */}
      <ComplianceStackedBar />

      {/* Recent Documents */}
      <Card className="card-premium p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
          <h3 className="text-lg sm:text-xl font-semibold">Recent Documents</h3>
          <Button 
            className="btn-premium hover-scale text-xs sm:text-sm px-3 sm:px-4"
            onClick={() => setShowUploadDialog(true)}
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            Upload
          </Button>
        </div>
        
        <div className="space-y-3 sm:space-y-4">
          {recentDocuments.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-12 w-12 sm:h-16 sm:w-16" />}
              title="No documents yet"
              description="Upload your first document to track insurance, registration, inspections, and compliance."
              action={{
                label: "Upload Document",
                onClick: () => setShowUploadDialog(true)
              }}
            />
          ) : (
            recentDocuments.map((doc, index) => (
            <div key={index} className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/30 border border-primary/10 hover-scale cursor-pointer">
              <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm sm:text-base truncate">{doc.name}</h4>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{doc.type} • {formatDate(doc.created_at)}</p>
                  </div>
                </div>
                <Badge className={`text-[10px] sm:text-xs flex-shrink-0 ${doc.status === 'active' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                  {doc.status}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center text-[10px] sm:text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-1" />
                  Expires: {formatDate(doc.expires_at)}
                </div>
                <div className="flex">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                    onClick={() => handleView(doc.name)}
                  >
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                    onClick={() => handleDownload(doc.name)}
                  >
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
          )}
        </div>
      </Card>
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsSection />
        </TabsContent>

        <TabsContent value="verification">
          <VerificationSection />
        </TabsContent>

        <TabsContent value="claims">
          <DamageClaimsSection />
        </TabsContent>
      </ModuleTabs>
    </>
  );
};
