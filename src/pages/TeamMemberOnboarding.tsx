import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { RoleTips } from '@/components/onboarding/RoleTips';
import {
  User,
  Phone,
  Camera,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

type AppRole = 'admin' | 'manager' | 'operator' | 'viewer';

interface TeamMemberFormData {
  fullName: string;
  phone: string;
  avatarUrl: string | null;
}

export default function TeamMemberOnboarding() {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updateProgress, markComplete } = useOnboardingProgress();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userRole, setUserRole] = useState<AppRole>('operator');
  const [formData, setFormData] = useState<TeamMemberFormData>({
    fullName: '',
    phone: '',
    avatarUrl: null,
  });

  // Load existing data and detect role
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;

      // Get existing profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, avatar_url')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFormData({
          fullName: profile.full_name || user.user_metadata?.full_name || '',
          phone: profile.phone || '',
          avatarUrl: profile.avatar_url,
        });
      }

      // Get role from team_members
      if (currentTeam?.id) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', currentTeam.id)
          .eq('user_id', user.id)
          .single();

        if (membership?.role) {
          setUserRole(membership.role as AppRole);
        }
      }
    };

    loadData();
  }, [user?.id, currentTeam?.id]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, avatarUrl: publicUrl }));
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          phone: formData.phone,
          avatar_url: formData.avatarUrl,
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update progress
      await updateProgress({ currentStep: 2, stepsCompleted: [1] });

      setStep(2);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Mark onboarding as complete
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true, tour_completed: true })
        .eq('id', user.id);

      await markComplete();

      // Fire confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#0B3D91', '#FF6B35', '#FFD700'],
      });

      toast({
        title: `Welcome to ${currentTeam?.name || 'the team'}! 🎉`,
        description: "You're all set up and ready to go.",
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid = formData.fullName.trim().length >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-lg"
      >
        <Card className="card-premium p-6 sm:p-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-4">
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-2 rounded-full mx-1 transition-all ${
                    s <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Step {step} of 2 — Quick Setup
            </p>
          </div>

          {/* Team Welcome */}
          {currentTeam && (
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm mb-2">
                <Building2 className="h-4 w-4" />
                <span>{currentTeam.name}</span>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1: Profile Setup */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <User className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <h2 className="text-2xl font-bold mb-2">Complete Your Profile</h2>
                  <p className="text-muted-foreground">
                    Just a few quick details to get you started
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Avatar Upload */}
                  <div className="flex justify-center">
                    <label className="relative cursor-pointer group">
                      <Avatar className="h-24 w-24 border-2 border-primary/20 group-hover:border-primary/50 transition-colors">
                        {formData.avatarUrl ? (
                          <AvatarImage src={formData.avatarUrl} alt="Avatar" />
                        ) : (
                          <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                            {formData.fullName?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground">
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>

                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Your Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                      }
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Phone (optional)
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, phone: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={!isStep1Valid || loading}
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Role Tips & Tour */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <h2 className="text-2xl font-bold mb-2">You're Ready!</h2>
                  <p className="text-muted-foreground">
                    Here's what you can do in Exotiq
                  </p>
                </div>

                <RoleTips role={userRole} />

                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Get Started
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
}
