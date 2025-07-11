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

export const Vault = () => {
  const complianceStatus = [
    { category: "Insurance", status: "compliant", items: 12, expiring: 2 },
    { category: "Registration", status: "warning", items: 10, expiring: 4 },
    { category: "Inspections", status: "compliant", items: 8, expiring: 1 },
    { category: "Licenses", status: "urgent", items: 6, expiring: 1 }
  ];

  const recentDocuments = [
    {
      name: "McLaren 720S Insurance Policy",
      type: "Insurance",
      uploaded: "2 days ago",
      expires: "Mar 15, 2025",
      status: "active"
    },
    {
      name: "Driver License - John Smith", 
      type: "License",
      uploaded: "1 week ago",
      expires: "Dec 22, 2024",
      status: "expiring"
    },
    {
      name: "Lamborghini Registration",
      type: "Registration", 
      uploaded: "3 days ago",
      expires: "Jun 30, 2025",
      status: "active"
    },
    {
      name: "Safety Inspection - Ferrari 488",
      type: "Inspection",
      uploaded: "1 day ago", 
      expires: "Nov 18, 2024",
      status: "urgent"
    }
  ];

  const upcomingExpirations = [
    {
      document: "Driver License - Sarah M.",
      vehicle: "Porsche 911 GT3",
      expires: "In 5 days",
      type: "License",
      priority: "high"
    },
    {
      document: "Insurance Policy",
      vehicle: "BMW i8", 
      expires: "In 12 days",
      type: "Insurance",
      priority: "medium"
    },
    {
      document: "Safety Inspection",
      vehicle: "Audi R8",
      expires: "In 18 days", 
      type: "Inspection",
      priority: "low"
    }
  ];

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
      case 'urgent': return 'bg-destructive/10 text-destructive border-destructive/20';
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
          <p className="text-muted-foreground mt-1">Intelligent compliance and document management</p>
        </div>
        <Button className="btn-premium">
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
                <Input placeholder="Search documents..." className="pl-10 w-40" />
              </div>
              <Button variant="outline" size="sm">
                All Documents
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            {recentDocuments.map((doc, index) => (
              <div key={index} className="p-4 rounded-lg bg-muted/30 border border-primary/10">
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
                    <Button size="sm" variant="ghost">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
            {upcomingExpirations.map((item, index) => (
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
            ))}
          </div>
        </Card>
      </div>

      {/* Document Categories */}
      <Card className="card-premium p-6">
        <h3 className="text-xl font-semibold mb-6">Document Categories</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: "Insurance Policies", count: 12, icon: Shield, color: "text-primary" },
            { name: "Vehicle Registration", count: 10, icon: FileText, color: "text-success" },
            { name: "Driver Licenses", count: 8, icon: FileText, color: "text-accent" },
            { name: "Inspections", count: 6, icon: CheckCircle, color: "text-warning" }
          ].map((category) => (
            <div key={category.name} className="p-4 rounded-lg bg-muted/30 border border-primary/10 hover-scale cursor-pointer">
              <div className="flex items-center mb-3">
                <category.icon className={`w-6 h-6 ${category.color}`} />
                <h4 className="ml-2 font-semibold text-sm">{category.name}</h4>
              </div>
              <div className="text-2xl font-bold">{category.count}</div>
              <div className="text-xs text-muted-foreground">Documents</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};