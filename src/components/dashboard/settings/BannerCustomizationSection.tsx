import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Sparkles } from "lucide-react";

interface BannerSettings {
  company_name: string;
  company_tagline: string;
  show_company_branding: boolean;
  banner_height: 'compact' | 'standard' | 'showcase';
  banner_text_position: 'left' | 'center';
  show_carbon_fiber: boolean;
}

export const BannerCustomizationSection = () => {
  const [settings, setSettings] = useState<BannerSettings>({
    company_name: '',
    company_tagline: '',
    show_company_branding: true,
    banner_height: 'standard',
    banner_text_position: 'left',
    show_carbon_fiber: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_dashboard_preferences')
        .select('banner_url, logo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading settings:', error);
        return;
      }

      if (data) {
        // Use default values since these columns don't exist yet
        setSettings({
          company_name: '',
          company_tagline: '',
          show_company_branding: true,
          banner_height: 'standard',
          banner_text_position: 'left',
          show_carbon_fiber: false,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_dashboard_preferences')
        .upsert({
          user_id: user.id,
          ...settings,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your banner customization has been updated. Refresh to see changes.",
      });

      // Reload the page to show changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Save failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gulf-blue" />
          Banner Customization
        </CardTitle>
        <CardDescription>
          White-label your dashboard with your company branding
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Company Branding Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="show-branding">Show Company Branding</Label>
            <p className="text-sm text-muted-foreground">
              Display your company name instead of generic welcome message
            </p>
          </div>
          <Switch
            id="show-branding"
            checked={settings.show_company_branding}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, show_company_branding: checked })
            }
          />
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company-name">Company Name</Label>
          <Input
            id="company-name"
            placeholder="e.g., Miami Exotic Rentals"
            value={settings.company_name}
            onChange={(e) =>
              setSettings({ ...settings, company_name: e.target.value })
            }
            disabled={!settings.show_company_branding}
          />
          <p className="text-xs text-muted-foreground">
            Your company name displayed prominently on the banner
          </p>
        </div>

        {/* Company Tagline */}
        <div className="space-y-2">
          <Label htmlFor="company-tagline">Company Tagline (Optional)</Label>
          <Input
            id="company-tagline"
            placeholder="e.g., Luxury Redefined"
            value={settings.company_tagline}
            onChange={(e) =>
              setSettings({ ...settings, company_tagline: e.target.value })
            }
            disabled={!settings.show_company_branding}
          />
          <p className="text-xs text-muted-foreground">
            A subtitle or tagline to complement your company name
          </p>
        </div>

        {/* Banner Height */}
        <div className="space-y-3">
          <Label>Banner Height</Label>
          <RadioGroup
            value={settings.banner_height}
            onValueChange={(value: 'compact' | 'standard' | 'showcase') =>
              setSettings({ ...settings, banner_height: value })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="compact" id="compact" />
              <Label htmlFor="compact" className="font-normal cursor-pointer">
                Compact (128px) - Minimal, data-focused
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="standard" id="standard" />
              <Label htmlFor="standard" className="font-normal cursor-pointer">
                Standard (192px) - Recommended, balanced
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="showcase" id="showcase" />
              <Label htmlFor="showcase" className="font-normal cursor-pointer">
                Showcase (256px) - Premium, fleet-proud
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Text Position */}
        <div className="space-y-3">
          <Label>Text Position</Label>
          <RadioGroup
            value={settings.banner_text_position}
            onValueChange={(value: 'left' | 'center') =>
              setSettings({ ...settings, banner_text_position: value })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="left" id="left" />
              <Label htmlFor="left" className="font-normal cursor-pointer">
                Left - Classic, professional
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="center" id="center" />
              <Label htmlFor="center" className="font-normal cursor-pointer">
                Center - Bold, impactful
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Carbon Fiber Effect */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="carbon-fiber">Carbon Fiber Texture</Label>
            <p className="text-sm text-muted-foreground">
              Add subtle automotive texture overlay
            </p>
          </div>
          <Switch
            id="carbon-fiber"
            checked={settings.show_carbon_fiber}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, show_carbon_fiber: checked })
            }
          />
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Banner Settings'}
          </Button>
        </div>

        {/* Preview Note */}
        <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
          <strong>💡 Tip:</strong> Upload a custom banner image by hovering over the dashboard banner and clicking "Change Banner". 
          For best results, use a panoramic photo (16:3 ratio) of your fleet in a showroom or lifestyle setting.
        </div>
      </CardContent>
    </Card>
  );
};
