import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AvatarUpload } from "./AvatarUpload";
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Save,
  Lock,
  LogOut,
  Shield,
  RotateCcw,
  Building2,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CompanyLogoUpload } from "@/components/shared/CompanyLogoUpload";

interface Profile {
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  handle: string | null;
  handle_changed_at: string | null;
}

export const MyAccountSection = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: user?.email || "",
    phone: "",
    companyName: "",
    handle: ""
  });
  const [handleAvailable, setHandleAvailable] = useState<null | boolean>(null);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone, company_name, avatar_url, handle, handle_changed_at')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data as Profile);
        setFormData({
          fullName: data.full_name || "",
          email: user.email || "",
          phone: data.phone || "",
          companyName: data.company_name || "",
          handle: data.handle || ""
        });
      }
    };

    fetchProfile();
  }, [user]);

  // Live handle availability check (debounced)
  useEffect(() => {
    const h = formData.handle.trim().toLowerCase();
    setHandleError(null);
    setHandleAvailable(null);
    if (!h || h === (profile?.handle || "")) return;
    if (!/^[a-z0-9][a-z0-9_.]{1,23}$/.test(h)) {
      setHandleError("2–24 chars, letters/numbers/underscore/dot, starts with letter or number");
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('handle', h)
        .maybeSingle();
      setHandleAvailable(!data || data.id === user?.id);
    }, 350);
    return () => clearTimeout(t);
  }, [formData.handle, profile?.handle, user?.id]);

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const newHandle = formData.handle.trim().toLowerCase();
      const updates: Record<string, unknown> = {
        full_name: formData.fullName,
        phone: formData.phone,
        company_name: formData.companyName,
        updated_at: new Date().toISOString(),
      };
      // Only attempt handle update if changed AND valid
      if (newHandle && newHandle !== (profile?.handle || "")) {
        if (handleError || handleAvailable === false) {
          toast({
            title: "Handle unavailable",
            description: handleError || "That handle is already taken.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        updates.handle = newHandle;
      }
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your account information has been saved."
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New passwords do not match.",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully."
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const initials = formData.fullName
    ? formData.fullName.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'U';

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <User className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Profile Information</h3>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <AvatarUpload
              currentAvatarUrl={profile?.avatar_url || null}
              displayName={formData.fullName || 'User'}
              onAvatarChange={(url) => setProfile(prev => prev ? { ...prev, avatar_url: url } : null)}
            />
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            </div>
          </div>

          {/* Form Section */}
          <div className="flex-1 grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Full Name
                </Label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  value={formData.email}
                  disabled
                  className="bg-muted/50"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Phone Number
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  Company Name
                </Label>
                <Input
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Your Company"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={isLoading} className="btn-premium">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Company Branding */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Building className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Company Branding</h3>
        </div>
        <CompanyLogoUpload />
      </Card>

      {/* Password Section */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Lock className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Change Password</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <Input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button 
            onClick={handlePasswordChange} 
            disabled={isLoading || !passwordData.newPassword}
            variant="outline"
          >
            <Lock className="w-4 h-4 mr-2" />
            Update Password
          </Button>
        </div>
      </Card>

      {/* Setup & Tour Section */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Setup & Tour</h3>
        </div>

        <div className="space-y-4">
          {/* Edit Company Setup */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h4 className="font-medium">Company Setup</h4>
              <p className="text-sm text-muted-foreground">
                Update business info, locations, and fleet details
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/onboarding?edit=true')}
            >
              <Building2 className="w-4 h-4 mr-2" />
              Edit Setup
            </Button>
          </div>

          <Separator />

          {/* Restart Tour */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h4 className="font-medium">Dashboard Tour</h4>
              <p className="text-sm text-muted-foreground">
                Take a 2-minute tour of all key features
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={async () => {
                // Reset tour_completed in database
                if (user?.id) {
                  await supabase
                    .from('profiles')
                    .update({ tour_completed: false })
                    .eq('id', user.id);
                }
                toast({
                  title: "Tour Restarting",
                  description: "Starting the demo tour now...",
                });
                navigate('/dashboard');
                setTimeout(() => window.dispatchEvent(new Event('start-demo-tour')), 500);
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart Tour
            </Button>
          </div>
        </div>
      </Card>

      {/* Sign Out */}
      <Card className="card-premium p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold">Sign Out</h3>
            <p className="text-sm text-muted-foreground">
              Sign out of your account on this device
            </p>
          </div>
          <Button variant="destructive" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
};
