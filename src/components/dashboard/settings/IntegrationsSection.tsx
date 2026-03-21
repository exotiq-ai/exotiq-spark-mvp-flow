import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plug, 
  Check, 
  AlertCircle,
  ExternalLink,
  RefreshCw,
  CreditCard,
  Calendar,
  MessageSquare,
  Map,
  FileText,
  Sparkles,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

interface GCalConfig {
  connected_email: string;
  calendar_name: string;
  calendar_id: string;
}

export const IntegrationsSection = () => {
  const { toast } = useToast();
  const { currentTeam } = useTeam();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [gcalIntegration, setGcalIntegration] = useState<{
    is_active: boolean;
    config: GCalConfig;
    last_used_at: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Handle gcal callback params
  useEffect(() => {
    const gcalStatus = searchParams.get("gcal");
    if (gcalStatus === "success") {
      toast({ title: "Google Calendar Connected", description: "Your bookings will now sync automatically." });
      searchParams.delete("gcal");
      setSearchParams(searchParams, { replace: true });
      fetchIntegration();
    } else if (gcalStatus === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast({ title: "Connection Failed", description: `Google Calendar connection failed: ${reason}`, variant: "destructive" });
      searchParams.delete("gcal");
      searchParams.delete("reason");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const fetchIntegration = async () => {
    if (!currentTeam?.id) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from("team_integrations")
        .select("is_active, config, last_used_at")
        .eq("team_id", currentTeam.id)
        .eq("integration_type", "google_calendar")
        .maybeSingle();
      
      if (data && data.is_active) {
        setGcalIntegration({
          is_active: true,
          config: data.config as unknown as GCalConfig,
          last_used_at: data.last_used_at,
        });
      } else {
        setGcalIntegration(null);
      }
    } catch (err) {
      console.error("Failed to fetch gcal integration:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegration();
  }, [currentTeam?.id]);

  const handleConnect = async () => {
    if (!currentTeam?.id) {
      toast({ title: "Error", description: "No team selected.", variant: "destructive" });
      return;
    }
    setIsConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gcal-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ team_id: currentTeam.id }),
        }
      );
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result.error || "Failed to get auth URL");
      }
    } catch (err: any) {
      toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentTeam?.id) return;
    setIsDisconnecting(true);
    try {
      await supabase
        .from("team_integrations")
        .update({ is_active: false })
        .eq("team_id", currentTeam.id)
        .eq("integration_type", "google_calendar");

      setGcalIntegration(null);
      toast({ title: "Disconnected", description: "Google Calendar has been disconnected. Events already synced will remain." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncNow = async () => {
    if (!currentTeam?.id) return;
    setIsSyncing(true);
    try {
      // Get all bookings that don't have a gcal event ID yet
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("team_id", currentTeam.id)
        .is("google_calendar_event_id", null)
        .in("status", ["pending", "confirmed"]);

      if (!bookings?.length) {
        toast({ title: "Already Synced", description: "All bookings are up to date." });
        setIsSyncing(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      // Fire sync for each unsynced booking
      const promises = bookings.map((b) =>
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gcal-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: "create", booking_id: b.id, team_id: currentTeam.id }),
        }).catch(() => null)
      );

      await Promise.all(promises);
      toast({ title: "Sync Complete", description: `Synced ${bookings.length} booking(s) to Google Calendar.` });
      fetchIntegration();
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const comingSoonIntegrations = [
    { name: "Stripe", description: "Payment processing and invoicing", icon: CreditCard },
    { name: "Twilio", description: "SMS and WhatsApp notifications", icon: MessageSquare },
    { name: "Google Maps", description: "Location services and routing", icon: Map },
    { name: "DocuSign", description: "Digital contract signing", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Plug className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Integrations</h3>
        </div>
        <p className="text-muted-foreground">
          Connect third-party services to extend EXOTIQ functionality. All integrations are tenant-specific and securely managed.
        </p>
      </Card>

      {/* Google Calendar — Real Integration */}
      <Card className="card-premium p-6">
        <h3 className="text-lg font-semibold mb-4">Calendar & Scheduling</h3>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-background border shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium">Google Calendar</h4>
                {gcalIntegration ? (
                  <Badge className="bg-success/10 text-success border-success/30">
                    <Check className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Connected</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {gcalIntegration
                  ? `Syncing to "${gcalIntegration.config.calendar_name}" (${gcalIntegration.config.connected_email})`
                  : "One-way sync: bookings auto-push to a dedicated Google Calendar"}
              </p>
              {gcalIntegration?.last_used_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last sync: {new Date(gcalIntegration.last_used_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : gcalIntegration ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="h-8 w-8 p-0"
                  title="Sync unsynced bookings"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="h-8"
                >
                  {isDisconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={isConnecting}
                className="btn-premium h-8"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Connect
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* AI Services — Active */}
      <Card className="card-premium p-6">
        <h3 className="text-lg font-semibold mb-4">AI & Intelligence</h3>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background border shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium">AI Services</h4>
                <Badge className="bg-success/10 text-success border-success/30">
                  <Check className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Powered by Lovable AI for intelligent features</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Coming Soon */}
      <Card className="card-premium p-6">
        <h3 className="text-lg font-semibold mb-4">Coming Soon</h3>
        <div className="space-y-3">
          {comingSoonIntegrations.map((integration) => (
            <div
              key={integration.name}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-muted/30 opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-background border shrink-0">
                  <integration.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-medium">{integration.name}</h4>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
