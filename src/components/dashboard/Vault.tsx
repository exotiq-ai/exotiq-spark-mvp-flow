import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Shield, 
  FileText, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Upload,
  Search,
  Download,
  Eye,
  Calendar
} from "lucide-react";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { format, addDays, isBefore, differenceInDays } from "date-fns";

export const Vault = () => {
  const { documents, vehicles, isAllLocations, currentLocation, uploadDocument } = useLocationFilteredFleet();
  const [searchQuery, setSearchQuery] = useState("");

  // Group documents by type
  const documentsByType = documents.reduce((acc, doc) => {
    const type = doc.type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);

  // Calculate compliance status based on real documents
  const getComplianceStatus = (type: string) => {
    const docs = documentsByType[type] || [];
    const now = new Date();
    const soonThreshold = addDays(now, 30);
    
    const expiring = docs.filter(d => {
      if (!d.expires_at) return false;
      const expiryDate = new Date(d.expires_at);
      return isBefore(expiryDate, soonThreshold) && !isBefore(expiryDate, now);
    }).length;

    const expired = docs.filter(d => {
      if (!d.expires_at) return false;
      return isBefore(new Date(d.expires_at), now);
    }).length;

    if (expired > 0) return 'urgent';
    if (expiring > 2) return 'warning';
    return 'compliant';
  };

  const complianceStatus = [
    { category: "Insurance", status: getComplianceStatus('insurance'), items: documentsByType['insurance']?.length || 0 },
    { category: "Registration", status: getComplianceStatus('registration'), items: documentsByType['registration']?.length || 0 },
    { category: "Inspection", status: getComplianceStatus('inspection'), items: documentsByType['inspection']?.length || 0 },
    { category: "License", status: getComplianceStatus('license'), items: documentsByType['license']?.length || 0 }
  ].map(cat => ({
    ...cat,
    expiring: (documentsByType[cat.category.toLowerCase()] || []).filter(d => {
      if (!d.expires_at) return false;
      const expiryDate = new Date(d.expires_at);
      return differenceInDays(expiryDate, new Date()) <= 30 && differenceInDays(expiryDate, new Date()) > 0;
    }).length
  }));

  // Recent documents
  const recentDocuments = documents
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 4)
    .map(doc => {
      const expiryDate = doc.expires_at ? new Date(doc.expires_at) : null;
      const now = new Date();
      let status = 'active';
      
      if (expiryDate) {
        const daysUntilExpiry = differenceInDays(expiryDate, now);
        if (daysUntilExpiry < 0) status = 'expired';
        else if (daysUntilExpiry < 14) status = 'urgent';
        else if (daysUntilExpiry < 30) status = 'expiring';
      }

      return {
        ...doc,
        status,
        uploaded: doc.created_at ? format(new Date(doc.created_at), 'MMM d, yyyy') : 'Unknown',
        expires: doc.expires_at ? format(new Date(doc.expires_at), 'MMM d, yyyy') : 'No expiry'
      };
    });

  // Upcoming expirations
  const upcomingExpirations = documents
    .filter(d => d.expires_at && differenceInDays(new Date(d.expires_at), new Date()) > 0)
    .sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime())
    .slice(0, 3)
    .map(doc => {
      const daysUntil = differenceInDays(new Date(doc.expires_at!), new Date());
      const vehicle = vehicles.find(v => v.id === doc.vehicle_id);
      
      return {
        document: doc.name,
        vehicle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'N/A',
        expires: `In ${daysUntil} days`,
        type: doc.type,
        priority: daysUntil < 7 ? 'high' : daysUntil < 14 ? 'medium' : 'low'
      };
    });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'urgent': return <AlertTriangle className="w-5 h-5 text-destructive" />;
      default: return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/10 text-success border-success/20';
      case 'expiring': return 'bg-warning/10 text-warning border-warning/20';
      case 'urgent':
      case 'expired': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'medium': return 'bg-warning/10 text-warning border-warning/20';
      case 'low': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Vault</h2>
          <p className="text-muted-foreground mt-1">
            Intelligent compliance and document management
            {!isAllLocations && currentLocation && (
              <span className="ml-2 text-primary">• {currentLocation.name}</span>
            )}
          </p>
        </div>
        <Button className="btn-premium" disabled>
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {complianceStatus.map((category) => (
          <Card key={category.category} className="card-premium p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                {getStatusIcon(category.status)}
                <h3 className="ml-2 font-semibold">{category.category}</h3>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Items:</span>
                <span className="font-medium">{category.items}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expiring Soon:</span>
                <span className={`font-medium ${category.expiring > 2 ? 'text-destructive' : 'text-success'}`}>
                  {category.expiring}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Recent Documents</h3>
            <div className="flex space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search documents..." 
                  className="pl-10 w-40"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm">
                All Documents
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            {recentDocuments.length > 0 ? (
              recentDocuments.map((doc) => (
                <div key={doc.id} className="p-4 rounded-lg bg-muted/30 border border-primary/10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{doc.name}</h4>
                        <p className="text-xs text-muted-foreground">{doc.type} • {doc.uploaded}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(doc.status)}>
                      {doc.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 mr-1" />
                      Expires: {doc.expires}
                    </div>
                    <div className="flex space-x-1">
                      <Button size="sm" variant="ghost" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Eye className="w-4 h-4" />
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={doc.file_url} download>
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No documents uploaded yet
              </div>
            )}
          </div>
        </Card>

        {/* Upcoming Expirations */}
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Upcoming Expirations</h3>
            <Badge className="bg-warning/10 text-warning border-warning/20">
              {upcomingExpirations.length} Items
            </Badge>
          </div>
          
          <div className="space-y-4">
            {upcomingExpirations.length > 0 ? (
              upcomingExpirations.map((item, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/30 border border-warning/20">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-sm">{item.document}</h4>
                      <p className="text-xs text-muted-foreground">{item.vehicle}</p>
                    </div>
                    <Badge className={getPriorityColor(item.priority)}>
                      {item.priority}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1 text-warning" />
                      {item.expires}
                    </div>
                    <Button size="sm" variant="outline">
                      Renew
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming expirations
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Document Categories */}
      <Card className="card-premium p-6">
        <h3 className="text-xl font-semibold mb-6">Document Categories</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: "Insurance Policies", type: "insurance", icon: Shield, color: "text-primary" },
            { name: "Vehicle Registration", type: "registration", icon: FileText, color: "text-success" },
            { name: "Driver Licenses", type: "license", icon: FileText, color: "text-accent" },
            { name: "Inspections", type: "inspection", icon: CheckCircle, color: "text-warning" }
          ].map((category) => (
            <div key={category.name} className="p-4 rounded-lg bg-muted/30 border border-primary/10 hover-scale cursor-pointer">
              <div className="flex items-center mb-3">
                <category.icon className={`w-6 h-6 ${category.color}`} />
                <h4 className="ml-2 font-semibold text-sm">{category.name}</h4>
              </div>
              <div className="text-2xl font-bold">{documentsByType[category.type]?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Documents</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
