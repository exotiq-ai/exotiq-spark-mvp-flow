import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/ui/logo';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle, Mail, Lock, Sparkles, KeyRound, UserPlus, Building2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { validators } from '@/lib/validation';
import { supabase } from '@/integrations/supabase/client';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';

type AuthMode = 'signin' | 'signup' | 'magiclink' | 'reset' | 'update-password';

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  inviterName: string;
  companyName: string;
  expiresAt: string;
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const modeParam = searchParams.get('mode');
  
  // Detect if this is a password recovery link from URL hash or query params
  const isRecoveryFromUrl = (() => {
    const hash = window.location.hash;
    // Check for recovery indicators in URL
    return modeParam === 'update-password' || 
           hash.includes('type=recovery') || 
           hash.includes('access_token') ||
           searchParams.get('type') === 'recovery';
  })();
  
  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (isRecoveryFromUrl) return 'update-password';
    return modeParam === 'update-password' ? 'update-password' : 
      inviteToken ? 'signup' : 'signin';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Track recovery email for display
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  
  // Invitation state
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [inviteError, setInviteError] = useState<string | null>(null);
  
  const { 
    user, 
    loading: authLoading, 
    isPasswordRecovery,
    signUp, 
    signIn, 
    signInWithMagicLink, 
    resetPassword, 
    updatePassword,
    signInAsDemo, 
    signUpWithInvite,
    clearPasswordRecovery
  } = useAuth();
  const navigate = useNavigate();

  // Update mode when URL param changes
  useEffect(() => {
    if (modeParam === 'update-password') {
      setAuthMode('update-password');
    }
  }, [modeParam]);

  // Validate invitation token on mount
  useEffect(() => {
    if (inviteToken) {
      validateInvitation(inviteToken);
    }
  }, [inviteToken]);

  const validateInvitation = async (token: string) => {
    setInviteLoading(true);
    setInviteError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('accept-invite', {
        body: { token },
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Invalid invitation');
      }

      if (data.valid && data.invitation) {
        setInvitation(data.invitation);
        setEmail(data.invitation.email);
      } else {
        throw new Error('Invalid invitation');
      }
    } catch (err: any) {
      console.error('Invitation validation error:', err);
      setInviteError(err.message || 'This invitation is invalid or has expired');
    } finally {
      setInviteLoading(false);
    }
  };

  // Handle recovery mode detection and capture email
  useEffect(() => {
    if (isRecoveryFromUrl || isPasswordRecovery) {
      setAuthMode('update-password');
      // Extract email from current user session if available
      if (user?.email) {
        setRecoveryEmail(user.email);
      }
    }
  }, [isRecoveryFromUrl, isPasswordRecovery, user?.email]);

  // Redirect authenticated users to dashboard (unless in password update mode)
  useEffect(() => {
    // Block redirect if in recovery mode or updating password
    if (isRecoveryFromUrl || isPasswordRecovery || authMode === 'update-password') {
      return;
    }
    if (!authLoading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate, authMode, isPasswordRecovery, isRecoveryFromUrl]);

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Client-side validation
    const emailValidation = validators.email(email);
    if (!emailValidation.isValid) {
      setError(emailValidation.error!);
      return;
    }

    const passwordValidation = validators.password(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error!);
      return;
    }

    if (authMode === 'signup' && !fullName.trim()) {
      setError("Full name is required");
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'signup') {
        // Check if this is an invited user signup
        if (invitation && inviteToken) {
          const { error: signUpError } = await signUpWithInvite(email, password, fullName, inviteToken);
          if (signUpError) {
            setError(signUpError.message || "Failed to create account. Please try again.");
          }
        } else {
          const { error: signUpError } = await signUp(email, password, fullName);
          if (signUpError) {
            setError(signUpError.message || "Failed to create account. Please try again.");
          }
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message || "Invalid email or password. Please try again.");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate password
    const passwordValidation = validators.password(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error!);
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError.message || "Failed to update password. Please try again.");
      } else {
        // Clear recovery state
        setRecoveryEmail(null);
        // Clear URL hash to prevent re-triggering on refresh
        window.history.replaceState(null, '', window.location.pathname);
      }
      // Success navigation is handled in AuthContext
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Password update error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    const emailValidation = validators.email(email);
    if (!emailValidation.isValid) {
      setError(emailValidation.error!);
      return;
    }

    setLoading(true);

    try {
      const { error: magicLinkError } = await signInWithMagicLink(email);
      if (!magicLinkError) {
        setSuccess("Check your email! We've sent you a magic link to sign in.");
        setEmail('');
      }
    } catch (err) {
      setError("Failed to send magic link. Please try again.");
      console.error("Magic link error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    const emailValidation = validators.email(email);
    if (!emailValidation.isValid) {
      setError(emailValidation.error!);
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await resetPassword(email);
      if (!resetError) {
        setSuccess("Password reset email sent! Check your inbox.");
        setEmail('');
      }
    } catch (err) {
      setError("Failed to send reset email. Please try again.");
      console.error("Password reset error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPasswordUpdate = () => {
    clearPasswordRecovery();
    setAuthMode('signin');
    navigate('/auth', { replace: true });
  };

  // Show loading state while validating invitation
  if (inviteLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
        <Card className="card-premium p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Validating your invitation...</p>
        </Card>
      </div>
    );
  }

  // Show error if invitation is invalid
  if (inviteToken && inviteError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
        <Card className="card-premium p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Invalid Invitation</h2>
          <p className="text-muted-foreground mb-6">{inviteError}</p>
          <Button onClick={() => navigate('/auth')} variant="outline">
            Go to Sign In
          </Button>
        </Card>
      </div>
    );
  }

  // Password Update Form (shown when user clicks reset link)
  if (authMode === 'update-password' || isPasswordRecovery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="card-premium p-6 sm:p-8">
            <div className="text-center mb-6">
              <Logo className="mx-auto mb-4" />
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-3">
                <ShieldCheck className="w-4 h-4" />
                Secure Password Update
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                Set New Password
              </h1>
              {(recoveryEmail || user?.email) && (
                <p className="text-sm text-muted-foreground mb-2">
                  Resetting password for: <span className="font-medium text-foreground">{recoveryEmail || user?.email}</span>
                </p>
              )}
              <p className="text-sm sm:text-base text-muted-foreground">
                Please enter your new password below
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  required
                  minLength={6}
                  aria-required="true"
                  autoFocus
                />
                <PasswordStrengthMeter password={password} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  required
                  minLength={6}
                  aria-required="true"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full btn-premium"
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Update Password
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleCancelPasswordUpdate}
              >
                Cancel
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="card-premium p-6 sm:p-8">
          <div className="text-center mb-6">
            <Logo className="mx-auto mb-4" />
            
            {invitation ? (
              // Invitation-specific header
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-3">
                  <UserPlus className="w-4 h-4" />
                  You've been invited!
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  Join {invitation.companyName}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  <span className="font-medium">{invitation.inviterName}</span> invited you as a <span className="font-medium capitalize">{invitation.role}</span>
                </p>
              </>
            ) : (
              // Default header
              <>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  Welcome to Exotiq
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Premium fleet management made simple
                </p>
              </>
            )}
          </div>

          {/* Contact for Demo Button - Only show if not an invitation */}
          {!invitation && (
            <>
              <Button 
                asChild
                className="w-full mb-6 btn-premium bg-gradient-to-r from-accent to-primary hover:opacity-90 transition-opacity"
                size="lg"
              >
                <a href="mailto:Hello@exotiq.com?subject=Exotiq Demo Request">
                  <Mail className="w-5 h-5 mr-2" />
                  Contact for Demo
                </a>
              </Button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
            </>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-500/50 bg-green-500/10">
              <Mail className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-500">{success}</AlertDescription>
            </Alert>
          )}

          {invitation ? (
            // Invitation signup form (simplified, no tabs)
            <form onSubmit={handlePasswordAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Full Name</Label>
                <Input
                  id="invite-name"
                  type="text"
                  placeholder="John Smith"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setError(null);
                  }}
                  required
                  aria-required="true"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <div className="relative">
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    readOnly
                    className="bg-muted pr-10"
                  />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  This email is linked to your invitation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-password">Create Password</Label>
                <Input
                  id="invite-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  required
                  minLength={6}
                  aria-required="true"
                />
                <PasswordStrengthMeter password={password} />
              </div>

              <Button 
                type="submit" 
                className="w-full btn-premium"
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4 mr-2" />
                    Join {invitation.companyName}
                  </>
                )}
              </Button>
            </form>
          ) : (
            // Standard auth tabs
            <Tabs defaultValue="signin" className="w-full" onValueChange={(value) => setAuthMode(value as AuthMode)}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="signin" className="text-xs sm:text-sm">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="magiclink" className="text-xs sm:text-sm">
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Magic Link
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-xs sm:text-sm">
                  <UserPlus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handlePasswordAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      required
                      aria-required="true"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      required
                      minLength={6}
                      aria-required="true"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full btn-premium"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setAuthMode('reset')}
                    className="w-full text-xs sm:text-sm text-primary hover:underline text-center"
                  >
                    Forgot password?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="magiclink">
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="magic-email">Email</Label>
                    <Input
                      id="magic-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      required
                      aria-required="true"
                    />
                    <p className="text-xs text-muted-foreground">
                      We'll email you a secure link to sign in
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full btn-premium"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Magic Link
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handlePasswordAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Smith"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      required
                      aria-required="true"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      required
                      aria-required="true"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      required
                      minLength={6}
                      aria-required="true"
                    />
                    <PasswordStrengthMeter password={password} />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full btn-premium"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          {authMode === 'reset' && !invitation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 border rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Reset Password</h3>
              </div>
              <form onSubmit={handlePasswordReset} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-xs">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                      setSuccess(null);
                    }}
                    required
                    aria-required="true"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={loading}
                    size="sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAuthMode('signin');
                      setError(null);
                      setSuccess(null);
                    }}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </Card>

        {!invitation && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            Demo mode includes pre-populated fleet data for testing
          </p>
        )}
      </motion.div>
    </div>
  );
}
