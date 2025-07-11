import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Users, MessageSquare, Settings } from "lucide-react";

const Core = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Core</h1>
          <p className="text-muted-foreground">Admin Control Center</p>
        </div>
        <Button className="btn-premium">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary">156</div>
          <div className="text-sm text-muted-foreground">Total Customers</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
          <div className="text-2xl font-bold text-primary">8</div>
          <div className="text-sm text-muted-foreground">Active Messages</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Brain className="h-5 w-5 text-success" />
          </div>
          <div className="text-2xl font-bold text-primary">12</div>
          <div className="text-sm text-muted-foreground">AI Alerts</div>
        </Card>
      </div>
    </div>
  );
};

export default Core;