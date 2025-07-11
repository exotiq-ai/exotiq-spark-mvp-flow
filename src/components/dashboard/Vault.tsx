import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Shield, Upload, FileText, AlertTriangle, Download, Eye, Calendar } from "lucide-react";

const Vault = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Vault</h1>
          <p className="text-muted-foreground">Compliance Hub</p>
        </div>
        <Button className="btn-premium">
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary">24</div>
          <div className="text-sm text-muted-foreground">Total Documents</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="text-2xl font-bold text-primary">3</div>
          <div className="text-sm text-muted-foreground">Expiring Soon</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Shield className="h-5 w-5 text-success" />
          </div>
          <div className="text-2xl font-bold text-primary">89%</div>
          <div className="text-sm text-muted-foreground">Compliance Rate</div>
        </Card>
      </div>

      {/* Document Upload and Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-premium">
          <h3 className="text-lg font-semibold mb-4">Document Upload</h3>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Drop files here or click to browse</p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports PDF, JPG, PNG up to 10MB
            </p>
            <Button>Select Files</Button>
          </div>
          
          <div className="mt-6 space-y-2">
            <h4 className="font-medium">Upload Progress</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>insurance_policy.pdf</span>
                  <span>75%</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>registration_docs.pdf</span>
                  <span>100%</span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="card-premium">
          <h3 className="text-lg font-semibold mb-4">Recent Documents</h3>
          <div className="space-y-4">
            {[
              { name: "Vehicle Registration - BMW M4", type: "PDF", status: "Active", expires: "2025-03-15" },
              { name: "Insurance Policy - Fleet Coverage", type: "PDF", status: "Expiring", expires: "2024-12-20" },
              { name: "Safety Inspection - Lamborghini", type: "PDF", status: "Active", expires: "2025-06-10" },
              { name: "Business License", type: "PDF", status: "Active", expires: "2025-12-31" }
            ].map((doc, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium text-sm">{doc.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center space-x-2">
                      <span>{doc.type}</span>
                      <span>•</span>
                      <Calendar className="h-3 w-3" />
                      <span>Expires {doc.expires}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={doc.status === "Active" ? "default" : "destructive"}>
                    {doc.status}
                  </Badge>
                  <Button size="sm" variant="ghost">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Vault;