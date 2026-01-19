import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plug, 
  Check, 
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Key,
  CreditCard,
  Calendar,
  MessageSquare,
  Map,
  FileText,
  Cloud,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  status: "connected" | "disconnected" | "error";
  category: "payments" | "calendar" | "communication" | "maps" | "documents" | "ai";
  lastSync?: string;
}

export const IntegrationsSection = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const integrations: Integration[] = [
    {
      id: "stripe",
      name: "Stripe",
      description: "Payment processing and invoicing",
      icon: CreditCard,
      status: "connected",
      category: "payments",
      lastSync: "2 minutes ago"
    },
    {
      id: "google-calendar",
      name: "Google Calendar",
      description: "Sync bookings with Google Calendar",
      icon: Calendar,
      status: "disconnected",
      category: "calendar"
    },
    {
      id: "twilio",
      name: "Twilio",
      description: "SMS and WhatsApp notifications",
      icon: MessageSquare,
      status: "disconnected",
      category: "communication"
    },
    {
      id: "google-maps",
      name: "Google Maps",
      description: "Location services and routing",
      icon: Map,
      status: "connected",
      category: "maps",
      lastSync: "Live"
    },
    {
      id: "docusign",
      name: "DocuSign",
      description: "Digital contract signing",
      icon: FileText,
      status: "disconnected",
      category: "documents"
    },
    {
      id: "openai",
      name: "AI Services",
      description: "Powered by Lovable AI for intelligent features",
      icon: Sparkles,
      status: "connected",
      category: "ai",
      lastSync: "Active"
    }
  ];

  const handleConnect = async (integrationId: string) => {
    setIsLoading(integrationId);
    
    // Simulate connection process
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Integration Ready",
      description: "Please complete the authorization in the popup window."
    });
    
    setIsLoading(null);
  };

  const handleDisconnect = async (integrationId: string) => {
    setIsLoading(integrationId);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Disconnected",
      description: "Integration has been disconnected."
    });
    
    setIsLoading(null);
  };

  const handleSync = async (integrationId: string) => {
    setIsLoading(integrationId);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Sync Complete",
      description: "Data has been synchronized successfully."
    });
    
    setIsLoading(null);
  };

  const getStatusBadge = (status: Integration["status"]) => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-success/10 text-success border-success/30">
            <Check className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Not Connected
          </Badge>
        );
    }
  };

  const groupedIntegrations = {
    payments: integrations.filter(i => i.category === "payments"),
    calendar: integrations.filter(i => i.category === "calendar"),
    communication: integrations.filter(i => i.category === "communication"),
    maps: integrations.filter(i => i.category === "maps"),
    documents: integrations.filter(i => i.category === "documents"),
    ai: integrations.filter(i => i.category === "ai")
  };

  const categoryLabels: Record<string, string> = {
    payments: "Payment Processing",
    calendar: "Calendar & Scheduling",
    communication: "Communication",
    maps: "Maps & Location",
    documents: "Document Management",
    ai: "AI & Intelligence"
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Plug className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Integrations Overview</h3>
        </div>
        <p className="text-muted-foreground mb-6">
          Connect third-party services to extend EXOTIQ functionality. All integrations are securely managed and can be disconnected at any time.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <p className="text-2xl font-bold text-success">
              {integrations.filter(i => i.status === "connected").length}
            </p>
            <p className="text-sm text-muted-foreground">Connected</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-2xl font-bold">
              {integrations.filter(i => i.status === "disconnected").length}
            </p>
            <p className="text-sm text-muted-foreground">Available</p>
          </div>
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-2xl font-bold text-destructive">
              {integrations.filter(i => i.status === "error").length}
            </p>
            <p className="text-sm text-muted-foreground">Errors</p>
          </div>
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-2xl font-bold text-primary">
              {integrations.length}
            </p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
        </div>
      </Card>

      {/* Integration Categories */}
      {Object.entries(groupedIntegrations).map(([category, items]) => (
        items.length > 0 && (
          <Card key={category} className="card-premium p-6">
            <h3 className="text-lg font-semibold mb-4">
              {categoryLabels[category]}
            </h3>
            
            <div className="space-y-4">
              {items.map((integration) => (
                <div 
                  key={integration.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-background border shrink-0">
                      <integration.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{integration.name}</h4>
                        {integration.status === "connected" && (
                          <Check className="w-4 h-4 text-success shrink-0" />
                        )}
                        {integration.status === "error" && (
                          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                        {integration.status === "disconnected" && (
                          <span className="text-xs text-muted-foreground">Not connected</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {integration.description}
                      </p>
                      {integration.lastSync && integration.status === "connected" && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last sync: {integration.lastSync}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                    {integration.status === "connected" && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleSync(integration.id)}
                          disabled={isLoading === integration.id}
                          className="h-8 w-8 p-0"
                        >
                          <RefreshCw className={`w-4 h-4 ${isLoading === integration.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDisconnect(integration.id)}
                          disabled={isLoading === integration.id}
                          className="h-8"
                        >
                          Disconnect
                        </Button>
                      </>
                    )}
                    {integration.status === "disconnected" && (
                      <Button 
                        size="sm"
                        onClick={() => handleConnect(integration.id)}
                        disabled={isLoading === integration.id}
                        className="btn-premium h-8"
                      >
                        {isLoading === integration.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <ExternalLink className="w-4 h-4 mr-2" />
                        )}
                        Connect
                      </Button>
                    )}
                    {integration.status === "error" && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleConnect(integration.id)}
                        disabled={isLoading === integration.id}
                        className="h-8"
                      >
                        Reconnect
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      ))}

      {/* API Keys Section */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Key className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">API Access</h3>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <Label>API Key</Label>
              <Badge variant="secondary">Read Only</Badge>
            </div>
            <div className="flex gap-2">
              <Input 
                value="exq_live_••••••••••••••••••••••••" 
                disabled 
                className="font-mono text-sm"
              />
              <Button variant="outline">
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Use this key to access the EXOTIQ API. Keep it secure and never share publicly.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Webhook Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive real-time event notifications
              </p>
            </div>
            <Switch />
          </div>
        </div>
      </Card>
    </div>
  );
};
