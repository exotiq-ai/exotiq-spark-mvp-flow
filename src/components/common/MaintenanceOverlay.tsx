import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Wrench, Mail, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMaintenanceWindow } from '@/hooks/useMaintenanceWindow';

const SUPPORT_EMAIL = 'support@exotiq.ai';

// Overlay only shows on the authenticated app surface — public/legal routes stay live.
const PROTECTED_PREFIXES = ['/dashboard', '/auth', '/onboarding', '/team-onboarding'];

function routeIsProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const MaintenanceOverlay = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { activeWindow } = useMaintenanceWindow();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Bypass for super admins — they need to be able to flip maintenance off.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsSuperAdmin(false);
      return;
    }
    supabase
      .rpc('is_super_admin', { check_user_id: user.id })
      .then(({ data }) => {
        if (!cancelled) setIsSuperAdmin(data === true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!activeWindow) return null;
  if (!routeIsProtected(location.pathname)) return null;
  if (isSuperAdmin) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('maintenance_notify_subscribers').insert({
        window_id: activeWindow.id,
        email: email.trim().toLowerCase(),
        team_id: activeWindow.team_id,
      });
      if (error && !error.message.includes('duplicate')) {
        // DB unreachable — fall back to a mailto so the user is never stuck.
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
          'Notify me when service is restored',
        )}&body=${encodeURIComponent(`Please notify me at ${email} when service is back.`)}`;
        return;
      }
      setSubmitted(true);
    } catch {
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
        'Notify me when service is restored',
      )}`;
    } finally {
      setSubmitting(false);
    }
  };

  const headline = "We're upgrading to serve your business better";
  const body =
    activeWindow.message ||
    "We apologise for the short downtime. Our team is rolling out improvements and we'll be back shortly. Leave your email and we'll let you know the moment service is restored.";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-8 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Wrench className="h-6 w-6 text-primary" />
        </div>

        <div className="mb-6 flex justify-center">
          <Logo size="md" />
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-foreground mb-3">
          {headline}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">{body}</p>

        {activeWindow.eta && (
          <p className="text-xs text-muted-foreground mb-6">
            Estimated return: <span className="font-medium text-foreground">{activeWindow.eta}</span>
          </p>
        )}

        {!activeWindow.eta && <div className="mb-6" />}

        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <p className="text-sm text-foreground">
              Thanks — we'll email <span className="font-medium">{email}</span> as soon as we're back.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={submitting}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Notify me when back'}
            </Button>
          </form>
        )}

        <p className="text-xs text-muted-foreground mt-6">
          Need urgent help?{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
};
