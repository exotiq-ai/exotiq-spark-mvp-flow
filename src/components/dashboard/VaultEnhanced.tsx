import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleet } from "@/contexts/FleetContext";
import { DocumentUploadDialog } from "@/components/dialogs/DocumentUploadDialog";
import { DamageClaimsSection } from "@/components/dashboard/DamageClaimsSection";
import { PaymentsSection } from "@/components/dashboard/PaymentsSection";
import { VerificationSection } from "@/components/dashboard/VerificationSection";
import { ComplianceStackedBar } from "@/components/charts/ComplianceStackedBar";
import { AskRariButton } from "@/components/common/AskRariButton";
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
  UserCheck
} from "lucide-react";

export const VaultEnhanced = () => {
  const { documents, uploadDocument, deleteDocument, loading } = useFleet();
  const { toast } = useToast();
  const [showUploadDialog, setShowUploadDialog] = useState(false);

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
      <Tabs defaultValue="documents" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full overflow-x-auto flex flex-nowrap gap-1 sm:grid sm:grid-cols-4 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="documents" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Docs</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Pay</span>
          </TabsTrigger>
          <TabsTrigger value="verification" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>ID</span>
          </TabsTrigger>
          <TabsTrigger value="claims" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Claims</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="documents" className="space-y-4 sm:space-y-6">
          <SkeletonCard />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </div>
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <>
      <DocumentUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onSubmit={uploadDocument}
      />

      {/* Ask Rari Floating Button */}
      <AskRariButton 
        moduleId="vault" 
        moduleName="Vault"
        contextPrompt="Ask me about compliance requirements, document management, or insurance policies."
      />

      <Tabs defaultValue="documents" className="space-y-4 sm:space-y-6">
        <TabsList className="sticky top-0 z-10 w-full overflow-x-auto flex flex-nowrap gap-1 sm:grid sm:grid-cols-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-1 rounded-lg border-b border-border/50">
          <TabsTrigger value="documents" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Documents</span>
            <span className="xs:hidden">Docs</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Pay</span>
          </TabsTrigger>
          <TabsTrigger value="verification" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Verify</span>
            <span className="xs:hidden">ID</span>
          </TabsTrigger>
          <TabsTrigger value="claims" className="flex-shrink-0 flex items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Claims</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4 sm:space-y-6">
      {/* Hero - Urgent Alert */}
      <Card className="card-premium bg-gradient-to-br from-warning/10 to-destructive/10 border-warning/20 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 mb-2 sm:mb-3 text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Urgent Action Required
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">{urgentAlert.daysLeft} Days</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Until Expiration</p>
          </div>
          <div className="p-2 sm:p-3 bg-destructive/10 rounded-xl sm:rounded-2xl flex-shrink-0">
            <AlertTriangle className="h-8 w-8 sm:h-10 sm:w-10 text-destructive" />
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-lg sm:text-xl font-semibold">{urgentAlert.title}</h3>
            <AskRariQuickAction
              variant="icon"
              prompt={`Help me handle this urgent compliance issue: ${urgentAlert.title} for ${urgentAlert.document} on ${urgentAlert.vehicle}. What are my options and next steps?`}
            />
          </div>
          <div className="space-y-1 sm:space-y-2">
            <p className="text-sm sm:text-base">{urgentAlert.document}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Vehicle: {urgentAlert.vehicle}</p>
          </div>
        </div>

        <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
          <Button 
            className="btn-premium hover-scale text-sm"
            onClick={() => setShowUploadDialog(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Renew Now
          </Button>
          <Button 
            variant="outline" 
            className="hover-scale text-sm"
            onClick={() => toast({
              title: "Document Details",
              description: "Opening detailed compliance view...",
            })}
          >
            View Details
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>

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
      </Tabs>
    </>
  );
};
