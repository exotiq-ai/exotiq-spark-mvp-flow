import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleet } from "@/contexts/FleetContext";
import { DocumentUploadDialog } from "@/components/dialogs/DocumentUploadDialog";
import { DamageClaimsSection } from "@/components/dashboard/DamageClaimsSection";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  FileText, 
  AlertTriangle, 
  CheckCircle,
  Upload,
  Eye,
  Download,
  Calendar,
  ArrowRight
} from "lucide-react";

export const VaultEnhanced = () => {
  const { documents, uploadDocument, deleteDocument } = useFleet();
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

  const recentDocuments = documents.slice(0, 5);

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

  return (
    <>
      <DocumentUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onSubmit={uploadDocument}
      />

      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents">
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="claims">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Damage Claims
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
      {/* Hero - Urgent Alert */}
      <Card className="card-premium bg-gradient-to-br from-warning/10 to-destructive/10 border-warning/20 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 mb-3">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Urgent Action Required
            </Badge>
            <h2 className="text-4xl font-bold mb-2">{urgentAlert.daysLeft} Days</h2>
            <p className="text-xl text-muted-foreground">Until Expiration</p>
          </div>
          <div className="p-4 bg-destructive/10 rounded-2xl">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 mb-4">
          <h3 className="text-2xl font-semibold mb-2">{urgentAlert.title}</h3>
          <div className="space-y-2">
            <p className="text-lg">{urgentAlert.document}</p>
            <p className="text-sm text-muted-foreground">Vehicle: {urgentAlert.vehicle}</p>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button 
            className="btn-premium hover-scale"
            onClick={() => setShowUploadDialog(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Renew Now
          </Button>
          <Button 
            variant="outline" 
            className="hover-scale"
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
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Compliance Score</h3>
          <Badge className={complianceScore.status === 'good' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
            {complianceScore.status.toUpperCase()}
          </Badge>
        </div>

        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="text-6xl font-bold text-primary">{complianceScore.percentage}%</div>
            <div className="text-sm text-muted-foreground text-center mt-2">
              {complianceScore.itemsCompliant} of {complianceScore.itemsTotal} items compliant
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((category) => (
            <div key={category.name} className="p-4 rounded-xl bg-muted/30 text-center hover-scale cursor-pointer">
              <category.icon className={`h-6 w-6 mx-auto mb-2 ${
                category.status === 'compliant' ? 'text-success' :
                category.status === 'warning' ? 'text-warning' : 'text-destructive'
              }`} />
              <div className="font-semibold text-sm mb-1">{category.name}</div>
              <div className="text-xs text-muted-foreground">{category.items} items</div>
              {category.expiring > 0 && (
                <div className="text-xs text-warning mt-1">{category.expiring} expiring</div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Documents */}
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Recent Documents</h3>
          <Button 
            className="btn-premium hover-scale"
            onClick={() => setShowUploadDialog(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>
        
        <div className="space-y-4">
          {recentDocuments.map((doc, index) => (
            <div key={index} className="p-4 rounded-xl bg-muted/30 border border-primary/10 hover-scale cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{doc.name}</h4>
                    <p className="text-xs text-muted-foreground">{doc.type} • {formatDate(doc.created_at)}</p>
                  </div>
                </div>
                <Badge className={doc.status === 'active' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                  {doc.status}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-1" />
                  Expires: {formatDate(doc.expires_at)}
                </div>
                <div className="flex space-x-1">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleView(doc.name)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleDownload(doc.name)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
        </TabsContent>

        <TabsContent value="claims">
          <DamageClaimsSection />
        </TabsContent>
      </Tabs>
    </>
  );
};
