import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSupportSession } from '@/hooks/useSupportSession';
import { LifeBuoy, Loader2, Search } from 'lucide-react';

interface TenantRow {
  id: string;
  name: string;
}

interface GrantRow {
  id: string;
  team_id: string;
  admin_email: string | null;
  reason: string;
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
  ended_reason: string | null;
}

export const SupportAccessTab = () => {
  const { toast } = useToast();
  const { session, refresh, endSession } = useSupportSession();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<TenantRow | null>(null);
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('8');
  const [starting, setStarting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [teamsRes, grantsRes] = await Promise.all([
      supabase.from('teams').select('id, name').order('name'),
      (supabase as any)
        .from('support_access_grants')
        .select('id, team_id, admin_email, reason, granted_at, expires_at, revoked_at, ended_reason')
        .order('granted_at', { ascending: false })
        .limit(50),
    ]);
    setTenants((teamsRes.data as TenantRow[]) || []);
    setGrants((grantsRes.data as GrantRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const tenantName = useMemo(() => {
    const map = new Map(tenants.map((t) => [t.id, t.name]));
    return (id: string) => map.get(id) || id.slice(0, 8);
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? tenants.filter((t) => t.name?.toLowerCase().includes(q)) : tenants;
  }, [tenants, search]);

  const handleStart = async () => {
    if (!target) return;
    setStarting(true);
    try {
      const { error } = await (supabase as any).rpc('start_support_session', {
        _team_id: target.id,
        _reason: reason,
        _hours: Number(hours),
      });
      if (error) throw error;
      toast({
        title: 'Support session started',
        description: `You are now working inside ${target.name}.`,
      });
      setTarget(null);
      setReason('');
      window.location.href = '/dashboard';
    } catch (err) {
      toast({
        title: 'Could not start session',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
      setStarting(false);
    }
  };

  const handleEnd = async () => {
    try {
      await endSession();
      await loadData();
      toast({ title: 'Support session ended' });
    } catch (err) {
      toast({
        title: 'Could not end session',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {session && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <LifeBuoy className="h-4 w-4 text-amber-600" />
              <span>
                Active session inside <strong>{session.team_name}</strong> — expires{' '}
                {new Date(session.expires_at).toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => (window.location.href = '/dashboard')}>
                Go to account
              </Button>
              <Button size="sm" variant="destructive" onClick={handleEnd}>
                End session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Support Access</CardTitle>
          <CardDescription>
            Start a time-boxed session to work inside a customer account as yourself. Everything you do is
            stamped with your own user and recorded below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {filtered.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
                >
                  <span className="truncate text-sm font-medium">{tenant.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!session}
                    onClick={() => {
                      setTarget(tenant);
                      setStarting(false);
                    }}
                  >
                    Start support session
                  </Button>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No tenants match that search.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session history</CardTitle>
          <CardDescription>Last 50 support sessions across all tenants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[360px] space-y-2 overflow-y-auto">
            {grants.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No support sessions yet</p>
            ) : (
              grants.map((g) => (
                <div key={g.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{tenantName(g.team_id)}</span>
                    <Badge variant={g.revoked_at ? 'secondary' : 'default'} className="text-xs">
                      {g.revoked_at ? g.ended_reason || 'ended' : 'active'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{g.admin_email}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{g.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(g.granted_at).toLocaleString()} → {new Date(g.expires_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="w-[95vw] max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start support session</DialogTitle>
            <DialogDescription>
              You will be moved into {target?.name} with admin access until the session expires. Your own
              account stays intact and you can return at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="support-reason">Reason</Label>
              <Textarea
                id="support-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Uploading new vehicle photos and auditing fleet inventory at customer request"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  <SelectItem value="2">2 hours</SelectItem>
                  <SelectItem value="8">8 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleStart} disabled={starting || reason.trim().length < 3}>
              {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Start session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportAccessTab;
