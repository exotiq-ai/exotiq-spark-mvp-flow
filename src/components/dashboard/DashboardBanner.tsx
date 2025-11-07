import { useState, useEffect } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import defaultBanner from "@/assets/dashboard-banner.jpg";

const motivationalLines = [
  "Keep optimizing. Every insight brings your fleet closer to peak performance.",
  "Momentum matters—your business is growing. Let's keep the throttle open.",
  "Steady growth ahead. You're building something incredible, one trip at a time.",
  "Precision. Performance. Progress."
];

export const DashboardBanner = () => {
  const [bannerUrl, setBannerUrl] = useState<string>(defaultBanner);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadButton, setShowUploadButton] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadUserBanner();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLineIndex((prev) => (prev + 1) % motivationalLines.length);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const loadUserBanner = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_dashboard_preferences')
        .select('banner_url')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading banner:', error);
        return;
      }

      if (data?.banner_url) {
        setBannerUrl(data.banner_url);
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

  return (
    <div 
      className="relative h-48 rounded-2xl overflow-hidden group shadow-lg"
      onMouseEnter={() => setShowUploadButton(true)}
      onMouseLeave={() => setShowUploadButton(false)}
    >
      {/* Banner Image */}
      <div className="absolute inset-0">
        <img 
          src={bannerUrl} 
          alt="Dashboard Banner" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
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
          <input
            id="banner-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          
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

      {/* Welcome Text */}
      <div className="absolute bottom-6 left-6 text-white">
        <h1 className="text-3xl font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">Welcome to Your Command Center</h1>
        <p 
          key={currentLineIndex}
          className="text-sm mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-fade-in"
        >
          {motivationalLines[currentLineIndex]}
        </p>
      </div>
    </div>
  );
};
