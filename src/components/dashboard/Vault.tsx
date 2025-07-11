import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Upload, FileText, AlertTriangle } from "lucide-react";

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
    </div>
  );
};

export default Vault;