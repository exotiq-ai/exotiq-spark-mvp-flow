import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/contexts/TeamContext";
import { Upload, X, Building2, Loader2 } from "lucide-react";

interface CompanyLogoUploadProps {
  /** Optional label override */
  label?: string;
  /** Optional description override */
  description?: string;
  /** Compact mode for onboarding */
  compact?: boolean;
}

export const CompanyLogoUpload = ({
  label = "Company Logo",
  description = "Your logo appears in the header and sidebar. Square or transparent background recommended.",
  compact = false,
}: CompanyLogoUploadProps) => {
  const { currentTeam, refreshTeam } = useTeam();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(currentTeam?.logo_url ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from team context when it changes
  const effectiveLogoUrl = logoUrl ?? currentTeam?.logo_url ?? null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTeam) return;

    const validTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload PNG, JPG, SVG, or WebP.", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("dashboard-banners")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("dashboard-banners")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("teams")
        .update({ logo_url: publicUrl })
        .eq("id", currentTeam.id);

      if (dbError) throw dbError;

      setLogoUrl(publicUrl);
      await refreshTeam();

      toast({ title: "Logo uploaded", description: "Your company logo has been updated." });
    } catch (error) {
      console.error("Logo upload error:", error);
      toast({ title: "Upload failed", description: "Could not upload logo. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!currentTeam) return;
    try {
      const { error } = await supabase
        .from("teams")
        .update({ logo_url: null })
        .eq("id", currentTeam.id);

      if (error) throw error;

      setLogoUrl(null);
      await refreshTeam();
      toast({ title: "Logo removed" });
    } catch (error) {
      console.error("Remove logo error:", error);
      toast({ title: "Failed to remove logo", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      {!compact && <Label>{label}</Label>}
      {!compact && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {compact && (
        <Label className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          {label} <span className="text-muted-foreground font-normal">(Optional)</span>
        </Label>
      )}
      <div className="flex items-center gap-4">
        <Avatar className={`${compact ? "h-12 w-12" : "h-16 w-16"} rounded-xl border-2 border-dashed border-muted-foreground/30`}>
          <AvatarImage src={effectiveLogoUrl || undefined} className="object-contain p-1" />
          <AvatarFallback className="rounded-xl bg-muted">
            <Building2 className={`${compact ? "h-4 w-4" : "h-6 w-6"} text-muted-foreground`} />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1.5">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading || !currentTeam}
          >
            {isUploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />{effectiveLogoUrl ? "Change Logo" : "Upload Logo"}</>
            )}
          </Button>
          {effectiveLogoUrl && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleRemove}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </div>
  );
};
