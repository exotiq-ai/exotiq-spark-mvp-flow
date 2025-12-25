import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Calendar, 
  DollarSign, 
  Slack,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface NotificationPreferences {
  id?: string;
  user_id: string;
  email_mentions: boolean;
  email_direct_messages: boolean;
  email_team_updates: boolean;
  push_enabled: boolean;
  slack_webhook_url: string | null;
  slack_enabled: boolean;
  slack_mentions: boolean;
  slack_bookings: boolean;
  slack_payments: boolean;
}

export const NotificationSettingsSection = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    user_id: user?.id || "",
    email_mentions: true,
    email_direct_messages: true,
    email_team_updates: false,
    push_enabled: true,
    slack_webhook_url: null,
    slack_enabled: false,
    slack_mentions: true,
    slack_bookings: true,
    slack_payments: false,
  });

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data as NotificationPreferences);
      } else {
        // Create default preferences
        setPreferences(prev => ({ ...prev, user_id: user.id }));
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          ...preferences,
          user_id: user.id,
        }, { onConflict: "user_id" });

      if (error) throw error;

      toast.success("Notification preferences saved");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const testSlackWebhook = async () => {
    if (!preferences.slack_webhook_url) {
      toast.error("Please enter a Slack webhook URL first");
      return;
    }

    setTestingSlack(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-notify", {
        body: {
          webhookUrl: preferences.slack_webhook_url,
          message: "🎉 ExotIQ Slack integration test successful!",
          test: true,
        },
      });

      if (error) throw error;

      toast.success("Test message sent to Slack!");
    } catch (error) {
      console.error("Slack test failed:", error);
      toast.error("Failed to send test message. Please check your webhook URL.");
    } finally {
      setTestingSlack(false);
    }
  };

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <CardTitle>Email Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure when you receive email notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-mentions" className="text-base">@Mentions</Label>
              <p className="text-sm text-muted-foreground">
                Receive an email when someone mentions you in a message
              </p>
            </div>
            <Switch
              id="email-mentions"
              checked={preferences.email_mentions}
              onCheckedChange={(checked) => updatePreference("email_mentions", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-dm" className="text-base">Direct Messages</Label>
              <p className="text-sm text-muted-foreground">
                Receive an email for new direct messages when offline
              </p>
            </div>
            <Switch
              id="email-dm"
              checked={preferences.email_direct_messages}
              onCheckedChange={(checked) => updatePreference("email_direct_messages", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-updates" className="text-base">Team Updates</Label>
              <p className="text-sm text-muted-foreground">
                Weekly digest of team activity and updates
              </p>
            </div>
            <Switch
              id="email-updates"
              checked={preferences.email_team_updates}
              onCheckedChange={(checked) => updatePreference("email_team_updates", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Slack Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Slack className="w-5 h-5 text-[#4A154B]" />
              <CardTitle>Slack Integration</CardTitle>
            </div>
            <Badge variant={preferences.slack_enabled ? "default" : "secondary"}>
              {preferences.slack_enabled ? "Connected" : "Disabled"}
            </Badge>
          </div>
          <CardDescription>
            Send notifications to your Slack workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="slack-enabled" className="text-base">Enable Slack Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send notifications to your connected Slack channel
              </p>
            </div>
            <Switch
              id="slack-enabled"
              checked={preferences.slack_enabled}
              onCheckedChange={(checked) => updatePreference("slack_enabled", checked)}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="slack-webhook">Webhook URL</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="slack-webhook"
                  type={showWebhook ? "text" : "password"}
                  placeholder="https://hooks.slack.com/services/..."
                  value={preferences.slack_webhook_url || ""}
                  onChange={(e) => updatePreference("slack_webhook_url", e.target.value || null)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowWebhook(!showWebhook)}
                >
                  {showWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={testSlackWebhook}
                disabled={testingSlack || !preferences.slack_webhook_url}
              >
                {testingSlack ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Create an incoming webhook in your Slack workspace settings.{" "}
              <a 
                href="https://api.slack.com/messaging/webhooks" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Learn how →
              </a>
            </p>
          </div>

          {preferences.slack_enabled && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <Label className="text-base">Notification Types</Label>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">@Mentions</span>
                  </div>
                  <Switch
                    checked={preferences.slack_mentions}
                    onCheckedChange={(checked) => updatePreference("slack_mentions", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">New Bookings</span>
                  </div>
                  <Switch
                    checked={preferences.slack_bookings}
                    onCheckedChange={(checked) => updatePreference("slack_bookings", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Payments Received</span>
                  </div>
                  <Switch
                    checked={preferences.slack_payments}
                    onCheckedChange={(checked) => updatePreference("slack_payments", checked)}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <CardTitle>In-App Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure browser and in-app notification settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-enabled" className="text-base">Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show real-time notifications in the app
              </p>
            </div>
            <Switch
              id="push-enabled"
              checked={preferences.push_enabled}
              onCheckedChange={(checked) => updatePreference("push_enabled", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={savePreferences} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
