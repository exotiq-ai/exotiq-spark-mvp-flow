import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Loader2, Power, Wrench } from 'lucide-react';

interface MaintenanceWindowRow {
  id: string;
  scope: 'global' | 'tenant';
  team_id: string | null;
  team_name?: string | null;
  is_active: boolean;
  message: string | null;
  eta: string | null;
  started_at: string;
  subscriber_count?: number;
}

interface TeamOption {
  id: string;
  name: string;
}

export const MaintenanceModeSection = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [windows, setWindows] = useState<MaintenanceWindowRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);

  const [globalDialogOpen, setGlobalDialogOpen] = useState(false);
  const [globalMessage, setGlobalMessage] = useState('');
  const [globalEta, setGlobalEta] = useState('');
  const [globalSubmitting, setGlobalSubmitting] = useState(false);

  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [tenantTeamId, setTenantTeamId] = useState('');
  const [tenantMessage, setTenantMessage] = useState('');
  const [tenantEta, setTenantEta] = useState('');
  const [tenantSubmitting, setTenantSubmitting] = useState(false);

  const loadWindows = useCallback(async () => {
    const { data, error } = await supabase
      .from('maintenance_windows')
      .select('id, scope, team_id, is_active, message, eta, started_at')
      .eq('is_active', true)
      .order('started_at', { ascending: false });

    if (error) {
      toast.error('Failed to load maintenance windows', { description: error.message });
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as MaintenanceWindowRow[];

    // Decorate with team names + subscriber counts
    const teamIds = Array.from(new Set(rows.map((r) => r.team_id).filter(Boolean) as string[]));
    let teamLookup: Record<string, string> = {};
    if (teamIds.length > 0) {
      const { data: teamRows } = await supabase.from('teams').select('id, name').in('id', teamIds);
      teamLookup = Object.fromEntries((teamRows ?? []).map((t) => [t.id, t.name]));
    }

    const decorated = await Promise.all(
      rows.map(async (r) => {
        const { count } = await supabase
          .from('maintenance_notify_subscribers')
          .select('id', { count: 'exact', head: true })
          .eq('window_id', r.id);
        return {
          ...r,
          team_name: r.team_id ? teamLookup[r.team_id] ?? '—' : null,
          subscriber_count: count ?? 0,
        };
      })
    );

    setWindows(decorated);
    setLoading(false);
  }, [toast]);

  const loadTeams = useCallback(async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name')
      .eq('is_deleted', false)
      .order('name', { ascending: true });
    setTeams((data ?? []) as TeamOption[]);
  }, []);

  useEffect(() => {
    loadWindows();
    loadTeams();

    const channel = supabase
      .channel('maintenance-windows-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_windows' },
        () => loadWindows()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadWindows, loadTeams]);

  const globalActive = windows.find((w) => w.scope === 'global');
  const tenantWindows = windows.filter((w) => w.scope === 'tenant');

  const activateGlobal = async () => {
    setGlobalSubmitting(true);
    const { error } = await supabase.from('maintenance_windows').insert({
      scope: 'global',
      is_active: true,
      message: globalMessage.trim() || null,
      eta: globalEta.trim() || null,
      created_by: user?.id ?? null,
    });
    setGlobalSubmitting(false);
    if (error) {
      toast.error('Failed to activate', { description: error.message });
      return;
    }
    toast('Global maintenance activated');
    setGlobalDialogOpen(false);
    setGlobalMessage('');
    setGlobalEta('');
  };

  const endWindow = async (w: MaintenanceWindowRow) => {
    const { error } = await supabase
      .from('maintenance_windows')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', w.id);
    if (error) {
      toast.error('Failed to end window', { description: error.message });
      return;
    }
    toast('Maintenance ended');

    // Best-effort: notify subscribers. Function is service-role only; errors are logged.
    try {
      await supabase.functions.invoke('maintenance-notify-restored', {
        body: { window_id: w.id },
      });
    } catch {
      // Non-blocking
    }
  };

  const activateTenant = async () => {
    if (!tenantTeamId) {
      toast.error('Select a team first');
      return;
    }
    setTenantSubmitting(true);
    const { error } = await supabase.from('maintenance_windows').insert({
      scope: 'tenant',
      team_id: tenantTeamId,
      is_active: true,
      message: tenantMessage.trim() || null,
      eta: tenantEta.trim() || null,
      created_by: user?.id ?? null,
    });
    setTenantSubmitting(false);
    if (error) {
      toast.error('Failed to activate', { description: error.message });
      return;
    }
    toast('Tenant maintenance activated');
    setTenantDialogOpen(false);
    setTenantTeamId('');
    setTenantMessage('');
    setTenantEta('');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Global */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Global maintenance mode
              </CardTitle>
              <CardDescription>
                Locks every tenant out of the authenticated app and shows them a "we'll be back" page.
                Public marketing and legal routes stay live.
              </CardDescription>
            </div>
            <Switch
              checked={!!globalActive}
              onCheckedChange={(checked) => {
                if (checked) setGlobalDialogOpen(true);
                else if (globalActive) endWindow(globalActive);
              }}
            />
          </div>
        </CardHeader>
        {globalActive && (
          <CardContent>
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Global maintenance is active
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Started: {new Date(globalActive.started_at).toLocaleString()}</div>
                {globalActive.message && <div>Message: {globalActive.message}</div>}
                {globalActive.eta && <div>ETA: {globalActive.eta}</div>}
                <div>Notify queue: {globalActive.subscriber_count} subscriber(s)</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => endWindow(globalActive)}>
                <Power className="h-3.5 w-3.5 mr-2" />
                End maintenance
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Per-tenant */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Per-tenant maintenance</CardTitle>
              <CardDescription>
                Lock out a single tenant while leaving the rest of the platform running.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setTenantDialogOpen(true)}>
              Add tenant window
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tenantWindows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              No active tenant maintenance windows.
            </div>
          ) : (
            <div className="space-y-2">
              {tenantWindows.map((w) => (
                <div
                  key={w.id}
                  className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{w.team_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {w.subscriber_count} notify
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Started {new Date(w.started_at).toLocaleString()}
                      {w.eta ? ` · ETA ${w.eta}` : ''}
                    </div>
                    {w.message && (
                      <div className="text-xs text-muted-foreground truncate">"{w.message}"</div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => endWindow(w)}>
                    End
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global dialog */}
      <Dialog open={globalDialogOpen} onOpenChange={setGlobalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate global maintenance</DialogTitle>
            <DialogDescription>
              This will lock <strong>every tenant</strong> out of the app immediately. Super admins keep access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="g-message">Custom message (optional)</Label>
              <Input
                id="g-message"
                placeholder="We're rolling out improvements…"
                value={globalMessage}
                onChange={(e) => setGlobalMessage(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-eta">Estimated return (optional)</Label>
              <Input
                id="g-eta"
                placeholder="approx. 30 minutes"
                value={globalEta}
                onChange={(e) => setGlobalEta(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGlobalDialogOpen(false)} disabled={globalSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={activateGlobal} disabled={globalSubmitting}>
              {globalSubmitting ? 'Activating…' : 'Lock all tenants out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tenant dialog */}
      <Dialog open={tenantDialogOpen} onOpenChange={setTenantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add tenant maintenance window</DialogTitle>
            <DialogDescription>
              Only users in the selected team will see the maintenance page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={tenantTeamId} onValueChange={setTenantTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-message">Custom message (optional)</Label>
              <Input
                id="t-message"
                value={tenantMessage}
                onChange={(e) => setTenantMessage(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-eta">Estimated return (optional)</Label>
              <Input
                id="t-eta"
                placeholder="approx. 30 minutes"
                value={tenantEta}
                onChange={(e) => setTenantEta(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTenantDialogOpen(false)} disabled={tenantSubmitting}>
              Cancel
            </Button>
            <Button onClick={activateTenant} disabled={tenantSubmitting || !tenantTeamId}>
              {tenantSubmitting ? 'Activating…' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
