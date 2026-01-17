import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// Subscription tier types
export type SubscriptionTier = 'starter' | 'growth' | 'professional' | 'enterprise' | null;

export interface SubscriptionStatus {
  subscribed: boolean;
  tier: SubscriptionTier;
  tierName: string | null;
  interval: 'monthly' | 'annual' | null;
  subscriptionEnd: string | null;
  customerId: string | null;
  priceId: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscription: SubscriptionStatus;
  isPasswordRecovery: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signUpWithInvite: (email: string, password: string, fullName: string, inviteToken: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithMagicLink: (email: string) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  signInAsDemo: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkSubscription: () => Promise<void>;
  openCustomerPortal: () => Promise<void>;
  isFeatureAvailable: (requiredTier: SubscriptionTier) => boolean;
  clearPasswordRecovery: () => void;
}

const defaultSubscription: SubscriptionStatus = {
  subscribed: false,
  tier: null,
  tierName: null,
  interval: null,
  subscriptionEnd: null,
  customerId: null,
  priceId: null,
  loading: true,
  error: null,
};

// Tier hierarchy for feature gating
const TIER_HIERARCHY: Record<string, number> = {
  starter: 1,
  growth: 2,
  professional: 3,
  enterprise: 4,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus>(defaultSubscription);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const onboardingNavTimeoutRef = useRef<number | null>(null);

  // Check if user account is active
  const checkUserActiveStatus = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Auth] Error checking user active status:', error);
        return true; // Allow access if we can't check (fail open for UX, RLS will block)
      }

      // If profile doesn't exist or is_active is null/undefined, default to true
      return data?.is_active ?? true;
    } catch (err) {
      console.error('[Auth] Exception in checkUserActiveStatus:', err);
      return true;
    }
  }, []);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (!session?.access_token) {
      setSubscription({ ...defaultSubscription, loading: false });
      return;
    }

    try {
      setSubscription(prev => ({ ...prev, loading: true, error: null }));
      
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setSubscription({
        subscribed: data.subscribed ?? false,
        tier: data.tier ?? null,
        tierName: data.tierName ?? null,
        interval: data.interval ?? null,
        subscriptionEnd: data.subscriptionEnd ?? null,
        customerId: data.customerId ?? null,
        priceId: data.priceId ?? null,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error checking subscription:', error);
      setSubscription(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to check subscription',
      }));
    }
  }, [session?.access_token]);

  // Open Stripe customer portal
  const openCustomerPortal = useCallback(async () => {
    if (!session?.access_token) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to manage your subscription.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error: any) {
      console.error('Error opening customer portal:', error);
      toast({
        title: "Unable to Open Billing Portal",
        description: error.message || "Please try again or contact support.",
        variant: "destructive",
      });
    }
  }, [session?.access_token, toast]);

  // Check if a feature is available based on subscription tier
  const isFeatureAvailable = useCallback((requiredTier: SubscriptionTier): boolean => {
    if (!requiredTier) return true;
    if (!subscription.subscribed || !subscription.tier) return false;
    
    const userTierLevel = TIER_HIERARCHY[subscription.tier] ?? 0;
    const requiredTierLevel = TIER_HIERARCHY[requiredTier] ?? 0;
    
    return userTierLevel >= requiredTierLevel;
  }, [subscription.subscribed, subscription.tier]);

  // Check subscription on session change
  useEffect(() => {
    if (session) {
      checkSubscription();
    } else {
      setSubscription({ ...defaultSubscription, loading: false });
    }
  }, [session, checkSubscription]);

  // Set up periodic subscription check (every 60 seconds)
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      checkSubscription();
    }, 60000);

    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  // Process pending invite after user is created
  const processPendingInvite = useCallback(async (userId: string, token: string) => {
    try {
      console.log('Processing pending invite for user:', userId);
      
      const { data, error } = await supabase.functions.invoke('accept-invite?action=accept', {
        body: { token, userId },
        method: 'POST',
      });

      if (error || data?.error) {
        console.error('Error accepting invite:', error || data?.error);
        // Don't throw - user is already created, just log the error
        toast({
          title: "Warning",
          description: "Account created but there was an issue with the invitation. Please contact support.",
          variant: "destructive",
        });
      } else {
        console.log('Invite accepted successfully:', data);
        toast({
          title: `Welcome to ${data.companyName || 'the team'}!`,
          description: `You've joined as a ${data.role || 'team member'}.`,
        });
      }
    } catch (err) {
      console.error('Error processing invite:', err);
    } finally {
      setPendingInviteToken(null);
    }
  }, [toast]);

  // Clear password recovery flag
  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Cancel any queued post-login navigation (prevents "can't sign out" loops)
        if (onboardingNavTimeoutRef.current) {
          window.clearTimeout(onboardingNavTimeoutRef.current);
          onboardingNavTimeoutRef.current = null;
        }

        console.log('Auth event:', event, 'user:', session?.user?.id || 'null');
        
        // CRITICAL: Skip ALL side effects if we're on /reset or /signout
        // This prevents auth events from interfering with the reset flow
        const currentPath = window.location.pathname;
        if (currentPath === '/reset' || currentPath === '/signout') {
          console.log('On reset/signout path, skipping auth side effects');
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          return;
        }
        
        // CRITICAL: If we get INITIAL_SESSION with no user, and we're on a protected route,
        // redirect to auth. This prevents the "null user stuck state"
        if (event === 'INITIAL_SESSION' && !session?.user) {
          console.log('[Auth] No user in initial session');
          setSession(null);
          setUser(null);
          setLoading(false);
          // If on a protected route, redirect to auth
          if (currentPath === '/dashboard' || currentPath === '/onboarding') {
            console.log('[Auth] Redirecting to /auth from protected route');
            navigate('/auth', { replace: true });
          }
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        // Never let the app get stuck in an "initializing" state
        setLoading(false);

        // Handle PASSWORD_RECOVERY event - user clicked reset link
        if (event === 'PASSWORD_RECOVERY') {
          console.log('Password recovery event detected');
          setIsPasswordRecovery(true);
          // Navigate to auth page with update-password mode
          navigate('/auth?mode=update-password', { replace: true });
          return; // Don't proceed with normal sign-in flow
        }

        if (event === 'SIGNED_IN' && session?.user) {
          // Skip active check and navigation if in password recovery mode
          if (isPasswordRecovery) {
            console.log('In password recovery mode, skipping normal navigation');
            return;
          }

          // Check if user account is active
          const isActive = await checkUserActiveStatus(session.user.id);

          if (!isActive) {
            console.log('User account is deactivated, signing out');
            toast({
              title: "Account Deactivated",
              description: "Your account has been deactivated. Please contact your administrator.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
            navigate('/auth');
            return;
          }

          // Check if there's a pending invite to process
          if (pendingInviteToken) {
            await processPendingInvite(session.user.id, pendingInviteToken);
            // Invited users go directly to dashboard (onboarding_completed is set by edge function)
            navigate('/dashboard');
          } else {
            // Check if onboarding is complete
            onboardingNavTimeoutRef.current = window.setTimeout(() => {
              checkOnboardingStatus(session?.user?.id);
            }, 0);
          }
        }
      }
    );

    // Check for existing session with server validation (prevents null user stuck state)
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // CRITICAL: Verify the cached session is still valid with the server
          // This prevents "null user" and "flash of wrong account" issues
          const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser();
          
          if (verifyError || !verifiedUser) {
            console.warn('[Auth] Stale/invalid session detected, clearing...', verifyError?.message);
            await supabase.auth.signOut({ scope: 'local' });
            setSession(null);
            setUser(null);
            setLoading(false);
            // Redirect to auth if on a protected route
            const currentPath = window.location.pathname;
            if (currentPath === '/dashboard' || currentPath === '/onboarding') {
              window.location.href = '/auth';
            }
            return;
          }
          
          // Session is valid - use verified user data
          setSession(session);
          setUser(verifiedUser);
          console.log('[Auth] Session verified for user:', verifiedUser.id);
        } else {
          setSession(null);
          setUser(null);
        }
      } catch (err) {
        console.error('[Auth] Error getting/verifying session:', err);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (onboardingNavTimeoutRef.current) {
        window.clearTimeout(onboardingNavTimeoutRef.current);
        onboardingNavTimeoutRef.current = null;
      }
      authSubscription.unsubscribe();
    };
  }, [pendingInviteToken, processPendingInvite, navigate, checkUserActiveStatus, toast, isPasswordRecovery]);

  const checkOnboardingStatus = async (userId: string | undefined) => {
    if (!userId) {
      console.log('[Auth] No userId provided to checkOnboardingStatus');
      navigate('/dashboard');
      return;
    }
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Auth] Error checking onboarding status:', error);
        // On error, default to dashboard rather than getting stuck
        navigate('/dashboard');
        return;
      }

      if (profile && profile.onboarding_completed === false) {
        navigate('/onboarding');
      } else {
        // If profile doesn't exist or onboarding_completed is true/null, go to dashboard
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('[Auth] Exception in checkOnboardingStatus:', err);
      navigate('/dashboard');
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Welcome to Exotiq!",
        description: "Your account has been created successfully.",
      });
    }

    return { error };
  };

  const signUpWithInvite = async (email: string, password: string, fullName: string, inviteToken: string) => {
    // Store the invite token to process after signup
    setPendingInviteToken(inviteToken);
    
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      setPendingInviteToken(null);
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive"
      });
    }
    // Success toast and invite processing handled in onAuthStateChange

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive"
      });
    }

    return { error };
  };

  const signInWithMagicLink = async (email: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      toast({
        title: "Error Sending Magic Link",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Check Your Email!",
        description: "We've sent you a magic link to sign in.",
      });
    }

    return { error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?mode=update-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      toast({
        title: "Error Sending Reset Email",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for the password reset link.",
      });
    }

    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      toast({
        title: "Password Update Failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated.",
      });
      
      // Clear recovery mode and check if user is active before redirecting
      setIsPasswordRecovery(false);
      
      if (user) {
        const isActive = await checkUserActiveStatus(user.id);
        if (!isActive) {
          toast({
            title: "Account Deactivated",
            description: "Your account has been deactivated. Please contact your administrator.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          navigate('/auth');
        } else {
          navigate('/dashboard');
        }
      }
    }

    return { error };
  };

  const signInAsDemo = async () => {
    try {
      // CRITICAL: First, clear any existing session to prevent conflicts
      // This ensures a clean slate before demo login
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Ignore sign-out errors - we just want to clear local state
      }
      
      // Small delay to ensure session is fully cleared
      await new Promise(resolve => setTimeout(resolve, 100));

      // Call secure demo-login edge function
      const { data, error } = await supabase.functions.invoke('demo-login', {
        method: 'POST',
      });

      if (error) {
        console.error('Demo login edge function error:', error);
        throw error;
      }

      if (!data?.session) {
        throw new Error('No session returned from demo login');
      }

      // CRITICAL: Explicitly set the session on the client
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        console.error('Error setting demo session:', sessionError);
        throw sessionError;
      }

      // Session is now set - onAuthStateChange will fire and handle navigation
      toast({
        title: "Welcome to Demo Mode!",
        description: "Exploring Exotiq with pre-populated data.",
        duration: 3000,
      });

      return { error: null };
    } catch (error: any) {
      console.error('Demo mode error:', error);

      const message = error?.message || 'Please try again or contact support.';
      toast({
        title: "Demo Mode Unavailable",
        description: message,
        variant: "destructive",
      });

      // IMPORTANT: rethrow so callers (Demo page / Auth page) can break out of
      // loading spinners and route the user appropriately.
      throw (error instanceof Error ? error : new Error(message));
    }
  };

  const signOut = async () => {
    // Prevent any queued post-login navigation from firing after sign-out
    if (onboardingNavTimeoutRef.current) {
      window.clearTimeout(onboardingNavTimeoutRef.current);
      onboardingNavTimeoutRef.current = null;
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('Sign out error:', err);
      // Always ensure the local session is cleared even if network/global signout fails
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      setSession(null);
      setUser(null);
      setSubscription({ ...defaultSubscription, loading: false });
      setIsPasswordRecovery(false);
      navigate('/auth', { replace: true });
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully.",
      });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      subscription,
      isPasswordRecovery,
      signUp,
      signUpWithInvite,
      signIn,
      signInWithMagicLink,
      resetPassword,
      updatePassword,
      signInAsDemo,
      signOut,
      checkSubscription,
      openCustomerPortal,
      isFeatureAvailable,
      clearPasswordRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
