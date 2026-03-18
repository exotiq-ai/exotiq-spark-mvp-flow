import { useState, useEffect } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import defaultBanner from "@/assets/dashboard-banner.jpg";

// Static tagline for all users
const tagline = "Precision. Performance. Progress.";

interface BannerPreferences {
  banner_url: string | null;
  company_name: string | null;
  company_tagline: string | null;
  show_company_branding: boolean;
  banner_height: 'compact' | 'standard' | 'showcase';
  banner_text_position: 'left' | 'center';
  show_carbon_fiber: boolean;
}

export const DashboardBanner = () => {
  const [bannerUrl, setBannerUrl] = useState<string>(defaultBanner);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadButton, setShowUploadButton] = useState(false);
  const [preferences, setPreferences] = useState<BannerPreferences>({
    banner_url: null,
    company_name: null,
    company_tagline: null,
    show_company_branding: true,
    banner_height: 'standard',
    banner_text_position: 'left',
    show_carbon_fiber: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadUserBanner();
  }, []);

  const loadUserBanner = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_dashboard_preferences')
        .select('banner_url, logo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading banner:', error);
        return;
      }

      if (data) {
        if (data.banner_url) {
          setBannerUrl(data.banner_url);
        }
        setPreferences({
          banner_url: data.banner_url,
          company_name: null,
          company_tagline: null,
          show_company_branding: true,
          banner_height: 'standard',
          banner_text_position: 'left',
          show_carbon_fiber: false,
        });
      }
    } catch (error) {
      console.error('Error loading banner:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/banner-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('dashboard-banners')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('dashboard-banners')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from('user_dashboard_preferences')
        .upsert({
          user_id: user.id,
          banner_url: publicUrl
        }, {
          onConflict: 'user_id'
        });

      if (dbError) throw dbError;

      setBannerUrl(publicUrl);
      toast({
        title: "Banner updated",
        description: "Your dashboard banner has been updated successfully"
      });
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload banner. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetBanner = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_dashboard_preferences')
        .update({ banner_url: null })
        .eq('user_id', user.id);

      if (error) throw error;

      setBannerUrl(defaultBanner);
      toast({
        title: "Banner reset",
        description: "Your dashboard banner has been reset to default"
      });
    } catch (error) {
      console.error('Error resetting banner:', error);
      toast({
        title: "Reset failed",
        description: "Failed to reset banner. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Height mapping
  const heightClasses = {
    compact: 'h-32',      // 128px
    standard: 'h-48 md:h-56',  // 192px-224px
    showcase: 'h-64 md:h-72',  // 256px-288px
  };

  return (
    <div 
      className={`relative ${heightClasses[preferences.banner_height]} rounded-2xl overflow-hidden group shadow-lg transition-all duration-300`}
      onMouseEnter={() => setShowUploadButton(true)}
      onMouseLeave={() => { if (!isUploading) setShowUploadButton(false); }}
    >
      {/* Banner Image */}
      <div className="absolute inset-0">
        <img 
          src={bannerUrl} 
          alt="Dashboard Banner" 
          className="w-full h-full object-cover"
        />
        {/* Carbon Fiber Texture Overlay */}
        {preferences.show_carbon_fiber && (
          <div className="absolute inset-0 carbon-fiber opacity-5" />
        )}
        {/* Enhanced Gradient Overlay - Softer for Glass Effect */}
        <div className={`absolute inset-0 ${
          preferences.banner_text_position === 'center' 
            ? 'bg-gradient-to-t from-black/70 via-black/30 to-transparent'
            : 'bg-gradient-to-r from-black/70 via-black/35 to-transparent'
        }`} />
        {/* Subtle vignette for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/20" />
      </div>

      {/* Upload Controls */}
      {showUploadButton && (
        <div className="absolute top-4 right-4 flex gap-2 animate-fade-in">
          <label htmlFor="banner-upload">
            <Button
              variant="secondary"
              size="sm"
              className="cursor-pointer"
              disabled={isUploading}
              asChild
            >
              <span>
                {isUploading ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Change Banner
                  </>
                )}
              </span>
            </Button>
          </label>
          
          {bannerUrl !== defaultBanner && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetBanner}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* Hidden file input — always in DOM so it survives mouseLeave during file dialog */}
      <input
        id="banner-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
        disabled={isUploading}
      />

      {/* Welcome Text / Company Branding - Premium Glass Effect */}
      <div className={`absolute bottom-6 ${
        preferences.banner_text_position === 'center' 
          ? 'left-1/2 -translate-x-1/2 text-center' 
          : 'left-8'
      } max-w-2xl`}>
        {/* Glass Container with Frosted Effect */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl px-6 py-5 shadow-2xl">
          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          
          {/* Content */}
          <div className="relative">
            {preferences.show_company_branding && preferences.company_name ? (
              <>
                <h1 className="text-3xl md:text-4xl font-dfaalt font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] mb-2">
                  {preferences.company_name}
                </h1>
                <p className="text-lg md:text-xl font-montserrat text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
                  {preferences.company_tagline || "Your Fleet Command Center"}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl md:text-3xl font-dfaalt font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                  Welcome to Your Command Center
                </h1>
                <p className="text-sm md:text-base font-montserrat text-white mt-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
                  {tagline}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Speed Divider at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gulf-blue to-transparent opacity-60" />
    </div>
  );
};
