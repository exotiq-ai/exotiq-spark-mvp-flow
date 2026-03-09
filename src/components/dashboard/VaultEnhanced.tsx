import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useFleet } from "@/contexts/FleetContext";
import { useTeam } from "@/contexts/TeamContext";
import { DocumentUploadDialog } from "@/components/dialogs/DocumentUploadDialog";
import { DamageClaimsSection } from "@/components/dashboard/DamageClaimsSection";
import { PaymentsSection } from "@/components/dashboard/PaymentsSection";
import { VerificationSection } from "@/components/dashboard/VerificationSection";
import { ComplianceStackedBar } from "@/components/charts/ComplianceStackedBar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import { useToast } from "@/hooks/use-toast";
import { DocumentPreviewDialog } from "@/components/common/DocumentPreviewDialog";
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
  X,
  Search
} from "lucide-react";

const EXPIRING_SOON_DAYS = 30;
const CATEGORY_TYPES = ['Insurance', 'Registration', 'Inspection', 'License'];

export const VaultEnhanced = () => {
  const { documents, vehicles, uploadDocument, deleteDocument, loading } = useLocationFilteredFleet();
  const { refreshMaintenance } = useFleet();
  const { currentTeam } = useTeam();
  const { toast } = useToast();

  useRealtimeTable('maintenance_schedules', {
    teamId: currentTeam?.id,
    onUpdate: refreshMaintenance,
    enabled: !loading,
  });

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [alertExpanded, setAlertExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);

  // Calculate urgent alert from real documents
  const urgentAlert = useMemo(() => {
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
    
    const expiringDocs = (documents || [])
      .filter(d => {
        if (!d.expires_at) return false;
        const expiry = new Date(d.expires_at);
        return expiry > now && expiry <= soonThreshold;
      })
      .sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime());

    if (expiringDocs.length === 0) return null;

    const doc = expiringDocs[0];
    const daysLeft = Math.ceil((new Date(doc.expires_at!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    const vehicle = vehicles?.find(v => v.id === doc.vehicle_id);
    const vehicleName = vehicle ? `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() : null;

    return {
      title: `${doc.type || 'Document'} Expiring Soon`,
      document: doc.name,
      vehicle: vehicleName,
      daysLeft,
      priority: daysLeft <= 7 ? "high" : "medium"
    };
  }, [documents, vehicles]);

  // Compliance score
  const complianceScore = useMemo(() => {
    const now = new Date();
    const docs = documents || [];
    
    if (docs.length === 0) {
      return { percentage: 0, status: "empty", itemsCompliant: 0, itemsTotal: 0 };
    }

    const compliantDocs = docs.filter(d => {
      if (!d.expires_at) return true;
      return new Date(d.expires_at) > now;
    }).length;

    const percentage = Math.round((compliantDocs / docs.length) * 100);
    
    return {
      percentage,
      status: percentage >= 80 ? "good" : percentage >= 50 ? "warning" : "critical",
      itemsCompliant: compliantDocs,
      itemsTotal: docs.length
    };
  }, [documents]);

  // Categories
  const categories = useMemo(() => {
    const now = new Date();
    const docs = documents || [];
    
    return CATEGORY_TYPES.map(categoryName => {
      const categoryDocs = docs.filter(d => 
        d.type?.toLowerCase().includes(categoryName.toLowerCase()) ||
        d.type?.toLowerCase().includes(categoryName.slice(0, -1).toLowerCase())
      );
      
      const expired = categoryDocs.filter(d => 
        d.expires_at && new Date(d.expires_at) < now
      ).length;
      
      const expiring = categoryDocs.filter(d => {
        if (!d.expires_at) return false;
        const expiry = new Date(d.expires_at);
        const daysUntil = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntil > 0 && daysUntil <= EXPIRING_SOON_DAYS;
      }).length;
      
      const compliant = categoryDocs.length - expired - expiring;
      
      let status: "compliant" | "warning" | "urgent" = "compliant";
      if (expired > 0) status = "urgent";
      else if (expiring > 0) status = "warning";
      
      const iconMap: Record<string, any> = {
        'Insurance': Shield,
        'Registration': FileText,
        'Inspection': CheckCircle,
        'License': AlertTriangle
      };
      
      return {
        name: categoryName,
        status,
        items: categoryDocs.length,
        expiring: expiring + expired,
        icon: iconMap[categoryName] || FileText
      };
    });
  }, [documents]);

  // Filter documents by search
  const filteredDocuments = useMemo(() => {
    const docs = Array.isArray(documents) ? documents : [];
    if (!searchQuery.trim()) return docs.slice(0, 20);
    
    const q = searchQuery.toLowerCase();
    return docs.filter(d =>
      d.name?.toLowerCase().includes(q) ||
      d.type?.toLowerCase().includes(q) ||
      (d as any).doc_ref?.toLowerCase().includes(q) ||
      (d as any).signed_by_name?.toLowerCase().includes(q) ||
      (d as any).booking_id?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [documents, searchQuery]);

  const handleDownload = async (doc: any) => {
    if (!doc.file_url) {
      toast({ title: "No file available", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(doc.file_url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.name || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast({ title: "Download failed", description: "Try opening in a new tab instead.", variant: "destructive" });
    }
  };

  const handleView = (doc: any) => {
    if (doc.file_url) {
      setPreviewDoc({ url: doc.file_url, name: doc.name || "Document" });
    } else {
      toast({ title: "No file available", variant: "destructive" });
    }
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
      <DocumentPreviewDialog
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        documentUrl={previewDoc?.url ?? null}
        documentName={previewDoc?.name ?? ""}
      />

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
        data-tour="vault-tabs"
      >
        <TabsContent value="documents" className="space-y-4 sm:space-y-6">
      {/* Compact Urgent Alert */}
      {urgentAlert && !alertDismissed && (
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
                {urgentAlert.vehicle && (
                  <div className="text-xs text-muted-foreground">
                    Vehicle: {urgentAlert.vehicle}
                  </div>
                )}
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
      <Card className="card-premium p-4 sm:p-6" data-tour="compliance-overview">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-semibold">Compliance Overview</h3>
          {complianceScore.itemsTotal > 0 && (
            <Badge className={
              complianceScore.status === 'good' ? 'bg-success/10 text-success' : 
              complianceScore.status === 'warning' ? 'bg-warning/10 text-warning' : 
              'bg-destructive/10 text-destructive'
            }>
              {complianceScore.status === 'good' ? 'GOOD' : complianceScore.status === 'warning' ? 'NEEDS ATTENTION' : 'CRITICAL'}
            </Badge>
          )}
        </div>

        {complianceScore.itemsTotal === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <Shield className="w-10 h-10 text-muted-foreground" />
            </div>
            <h4 className="text-lg font-semibold mb-2">No Documents Tracked</h4>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Upload documents to start tracking compliance for your fleet.
            </p>
            <Button onClick={() => setShowUploadDialog(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </div>
        ) : (
          <>
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
                    category.items === 0 ? 'text-muted-foreground' :
                    category.status === 'compliant' ? 'text-success' :
                    category.status === 'warning' ? 'text-warning' : 'text-destructive'
                  }`} />
                  <div className="font-semibold text-xs sm:text-sm mb-0.5 sm:mb-1">{category.name}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">
                    {category.items > 0 ? `${category.items} items` : 'No docs'}
                  </div>
                  {category.expiring > 0 && (
                    <div className="text-[10px] sm:text-xs text-warning mt-0.5 sm:mt-1">{category.expiring} expiring</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Compliance Distribution Chart */}
      <ComplianceStackedBar />

      {/* Documents List */}
      <Card className="card-premium p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
          <h3 className="text-lg sm:text-xl font-semibold">Documents</h3>
          <Button 
            className="btn-premium hover-scale text-xs sm:text-sm px-3 sm:px-4"
            onClick={() => setShowUploadDialog(true)}
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            Upload
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, type, doc ref, signer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="space-y-3 sm:space-y-4">
          {filteredDocuments.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-12 w-12 sm:h-16 sm:w-16" />}
              title={searchQuery ? "No documents match your search" : "No documents yet"}
              description={searchQuery ? "Try a different search term." : "Upload your first document to track insurance, registration, inspections, and compliance."}
              action={!searchQuery ? {
                label: "Upload Document",
                onClick: () => setShowUploadDialog(true)
              } : undefined}
            />
          ) : (
            filteredDocuments.map((doc, index) => (
            <div key={index} className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/30 border border-primary/10 hover-scale cursor-pointer">
              <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm sm:text-base truncate">{doc.name}</h4>
                      {(doc as any).is_default && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">Default</Badge>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {(doc as any).doc_ref && <span className="font-mono">{(doc as any).doc_ref} • </span>}
                      {doc.type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} • {formatDate(doc.created_at)}
                      {(doc as any).signed_by_name && ` • Signed by ${(doc as any).signed_by_name}`}
                    </p>
                  </div>
                </div>
                <Badge className={`text-[10px] sm:text-xs flex-shrink-0 ${
                  (doc as any).signed_at ? 'bg-primary/10 text-primary' :
                  doc.status === 'active' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                }`}>
                  {(doc as any).signed_at ? 'Signed' : doc.status}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center text-[10px] sm:text-xs text-muted-foreground">
                  {(doc as any).signed_at ? (
                    <>
                      <Calendar className="w-3 h-3 mr-1" />
                      Signed: {formatDate((doc as any).signed_at)}
                    </>
                  ) : (
                    <>
                      <Calendar className="w-3 h-3 mr-1" />
                      Expires: {formatDate(doc.expires_at)}
                    </>
                  )}
                </div>
                <div className="flex">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                    onClick={() => handleView(doc)}
                  >
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                    onClick={() => handleDownload(doc)}
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
