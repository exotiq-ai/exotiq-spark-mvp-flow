/**
 * MarketplaceVisibilityTab
 *
 * Super-admin controls to toggle `teams.marketplace_visible` and
 * `vehicles.marketplace_visible` without writing SQL. All mutations
 * are audited via `log_admin_action`.
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronRight, Search, AlertTriangle, Loader2 } from 'lucide-react';
import { MarketplaceReadinessPanel } from './MarketplaceReadinessPanel';

interface TeamRow {
  id: string;
  name: string;
  slug: string | null;
  marketplace_visible: boolean;
  marketplace_test_mode: boolean;
  is_demo_account: boolean;
  owner_id: string | null;
  owner_email: string | null;
  owner_company_name: string | null;
}


interface VehicleRow {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  status: string | null;
  marketplace_visible: boolean;
  archived_at: string | null;
  trashed_at: string | null;
}

const logAdminAction = async (action: string, details: Record<string, unknown>) => {
  try {
    await supabase.rpc('log_admin_action', {
      p_action: action,
      p_details: details as unknown as never,
    });
  } catch (e) {
    console.error('[MarketplaceAdmin] audit log failed:', e);
  }
};

const useTeams = () =>
  useQuery({
    queryKey: ['sa-marketplace-teams'],
    queryFn: async (): Promise<TeamRow[]> => {
      const { data: teams, error } = await supabase
        .from('teams')
        .select('id, name, slug, marketplace_visible, marketplace_test_mode, is_demo_account, owner_id')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      if (error) throw error;

      const ownerIds = (teams ?? []).map((t) => t.owner_id).filter((v): v is string => !!v);
      let profileMap: Record<string, { email: string | null; company_name: string | null }> = {};
      if (ownerIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, company_name')
          .in('id', ownerIds);
        profileMap = Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, { email: p.email ?? null, company_name: p.company_name ?? null }])
        );
      }

      return (teams ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        slug: (t as any).slug ?? null,
        marketplace_visible: !!t.marketplace_visible,
        marketplace_test_mode: !!(t as any).marketplace_test_mode,
        is_demo_account: !!t.is_demo_account,
        owner_id: t.owner_id,
        owner_email: t.owner_id ? profileMap[t.owner_id]?.email ?? null : null,
        owner_company_name: t.owner_id ? profileMap[t.owner_id]?.company_name ?? null : null,
      }));
    },
  });


const useVehicles = (teamId: string | null) =>
  useQuery({
    queryKey: ['sa-marketplace-vehicles', teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<VehicleRow[]> => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, year, make, model, status, marketplace_visible, archived_at, trashed_at')
        .eq('team_id', teamId!)
        .order('make', { ascending: true });
      if (error) throw error;
      return (data ?? []) as VehicleRow[];
    },
  });

export const MarketplaceVisibilityTab = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [onlyVisible, setOnlyVisible] = useState(false);

  const { data: teams = [], isLoading, error } = useTeams();

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.owner_email && t.owner_email.toLowerCase().includes(q))
    );
  }, [teams, search]);

  const toggleTeam = useMutation({
    mutationFn: async ({ team, value }: { team: TeamRow; value: boolean }) => {
      const { error } = await supabase
        .from('teams')
        .update({ marketplace_visible: value })
        .eq('id', team.id);
      if (error) throw error;
      await logAdminAction('toggle_marketplace_team', {
        team_id: team.id,
        team_name: team.name,
        value,
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['sa-marketplace-teams'] });
      toast({
        title: vars.value ? 'Team on marketplace' : 'Team hidden',
        description: vars.team.name,
      });
    },
    onError: (e: any) =>
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  const markProduction = useMutation({
    mutationFn: async (team: TeamRow) => {
      const { error } = await supabase
        .from('teams')
        .update({ is_demo_account: false })
        .eq('id', team.id);
      if (error) throw error;
      await logAdminAction('mark_team_production', { team_id: team.id, team_name: team.name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-marketplace-teams'] });
      toast({ title: 'Team marked as production' });
    },
    onError: (e: any) =>
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  const syncNameFromProfile = useMutation({
    mutationFn: async (team: TeamRow) => {
      const target = (team.owner_company_name ?? '').trim();
      if (!target) throw new Error('Owner has no business name in profile');
      const { data, error } = await supabase.rpc('rename_team', {
        _team_id: team.id,
        _new_name: target,
      });
      if (error) throw error;
      await logAdminAction('sync_team_name_from_profile', {
        team_id: team.id,
        from: team.name,
        to: target,
        slug_changed: Array.isArray(data) ? (data[0] as any)?.slug_changed ?? false : false,
      });
      return data;
    },
    onSuccess: (_d, team) => {
      qc.invalidateQueries({ queryKey: ['sa-marketplace-teams'] });
      toast({
        title: 'Team renamed',
        description: `${team.name} → ${(team.owner_company_name ?? '').trim()}`,
      });
    },
    onError: (e: any) =>
      toast({ title: 'Rename failed', description: e.message, variant: 'destructive' }),
  });


  const toggleVehicle = useMutation({
    mutationFn: async ({
      vehicle,
      teamId,
      value,
    }: {
      vehicle: VehicleRow;
      teamId: string;
      value: boolean;
    }) => {
      const { error } = await supabase
        .from('vehicles')
        .update({ marketplace_visible: value })
        .eq('id', vehicle.id);
      if (error) throw error;
      await logAdminAction('toggle_marketplace_vehicle', {
        team_id: teamId,
        vehicle_id: vehicle.id,
        value,
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['sa-marketplace-vehicles', vars.teamId] });
    },
    onError: (e: any) =>
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  const bulkVehicles = useMutation({
    mutationFn: async ({
      ids,
      teamId,
      value,
    }: {
      ids: string[];
      teamId: string;
      value: boolean;
    }) => {
      if (!ids.length) return;
      const { error } = await supabase
        .from('vehicles')
        .update({ marketplace_visible: value })
        .in('id', ids);
      if (error) throw error;
      await logAdminAction('bulk_toggle_marketplace_vehicles', {
        team_id: teamId,
        count: ids.length,
        value,
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['sa-marketplace-vehicles', vars.teamId] });
      toast({
        title: vars.value ? 'Vehicles enabled' : 'Vehicles hidden',
        description: `${vars.ids.length} vehicle${vars.ids.length === 1 ? '' : 's'}`,
      });
    },
    onError: (e: any) =>
      toast({ title: 'Bulk update failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Marketplace Visibility</CardTitle>
          <CardDescription>
            Toggle which teams and vehicles appear on the public marketplace. All changes are
            audited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by team name or owner email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading teams…
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive">
              Failed to load teams: {(error as Error).message}
            </div>
          )}

          <div className="rounded-lg border divide-y">
            {filteredTeams.map((team) => {
              const isOpen = expanded === team.id;
              return (
                <div key={team.id}>
                  <div className="flex items-center gap-3 p-3">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : team.id)}
                      className="p-1 hover:bg-muted rounded"
                      aria-label={isOpen ? 'Collapse' : 'Expand'}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{team.name}</p>
                        {team.is_demo_account && (
                          <Badge variant="secondary" className="text-xs">
                            Demo
                          </Badge>
                        )}
                        {team.marketplace_visible && (
                          <Badge className="text-xs">On marketplace</Badge>
                        )}
                        {(() => {
                          const target = (team.owner_company_name ?? '').trim();
                          if (!target || target === team.name.trim()) return null;
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs border-amber-500/60 text-amber-700 dark:text-amber-300">
                                  Drift
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                Owner's business name is "{target}" but team is named "{team.name}".
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {team.owner_email ?? '—'}
                        {team.slug ? <> · <span className="font-mono">/{team.slug}</span></> : null}
                      </p>
                    </div>
                    {(() => {
                      const target = (team.owner_company_name ?? '').trim();
                      if (!target || target === team.name.trim()) return null;
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => syncNameFromProfile.mutate(team)}
                              disabled={syncNameFromProfile.isPending}
                            >
                              Sync name
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Rename team to "{target}" (owner's saved business name)
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}

                    <Switch
                      checked={team.marketplace_visible}
                      onCheckedChange={(value) => toggleTeam.mutate({ team, value })}
                      disabled={toggleTeam.isPending}
                      aria-label="Team marketplace visibility"
                    />
                  </div>

                  {isOpen && (
                    <div className="bg-muted/30 border-t px-3 py-3 space-y-3">
                      <MarketplaceReadinessPanel teamId={team.id} />

                      {team.is_demo_account && (
                        <div className="flex items-start gap-2 p-3 rounded-md border border-amber-500/40 bg-amber-500/5 text-sm">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-amber-800 dark:text-amber-300">
                              This team is marked as demo and will not appear on the public
                              marketplace even when visibility is on.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markProduction.mutate(team)}
                            disabled={markProduction.isPending}
                          >
                            Mark as production
                          </Button>
                        </div>
                      )}

                      <VehicleList
                        teamId={team.id}
                        teamVisible={team.marketplace_visible && !team.is_demo_account}
                        onlyVisible={onlyVisible}
                        setOnlyVisible={setOnlyVisible}
                        onToggleVehicle={(vehicle, value) =>
                          toggleVehicle.mutate({ vehicle, teamId: team.id, value })
                        }
                        onBulk={(ids, value) =>
                          bulkVehicles.mutate({ ids, teamId: team.id, value })
                        }
                        bulkPending={bulkVehicles.isPending}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {!isLoading && !filteredTeams.length && (
              <div className="text-center py-8 text-sm text-muted-foreground">No teams found</div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

interface VehicleListProps {
  teamId: string;
  teamVisible: boolean;
  onlyVisible: boolean;
  setOnlyVisible: (v: boolean) => void;
  onToggleVehicle: (v: VehicleRow, value: boolean) => void;
  onBulk: (ids: string[], value: boolean) => void;
  bulkPending: boolean;
}

const VehicleList = ({
  teamId,
  teamVisible,
  onlyVisible,
  setOnlyVisible,
  onToggleVehicle,
  onBulk,
  bulkPending,
}: VehicleListProps) => {
  const { data: vehicles = [], isLoading } = useVehicles(teamId);

  const filtered = useMemo(
    () => (onlyVisible ? vehicles.filter((v) => v.marketplace_visible) : vehicles),
    [vehicles, onlyVisible]
  );

  const filteredIds = filtered.map((v) => v.id);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Fleet ({vehicles.length}) · {vehicles.filter((v) => v.marketplace_visible).length}{' '}
            visible
          </span>
          <Button
            size="sm"
            variant={onlyVisible ? 'default' : 'outline'}
            className="h-7"
            onClick={() => setOnlyVisible(!onlyVisible)}
          >
            {onlyVisible ? 'Show all' : 'Only visible'}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={bulkPending || !teamVisible || !filteredIds.length}
            onClick={() => onBulk(filteredIds, true)}
          >
            Enable all
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={bulkPending || !filteredIds.length}
            onClick={() => onBulk(filteredIds, false)}
          >
            Disable all
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground py-3">Loading vehicles…</div>
      ) : !filtered.length ? (
        <div className="text-xs text-muted-foreground py-3">No vehicles</div>
      ) : (
        <div className="rounded-md border bg-background divide-y">
          {filtered.map((v) => {
            const archived = !!v.archived_at || !!v.trashed_at;
            const disabled = archived || !teamVisible;
            const disabledReason = archived
              ? 'Vehicle is archived or trashed'
              : !teamVisible
              ? 'Team is not marketplace-visible or is marked as demo'
              : '';
            const label = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Untitled';
            return (
              <div key={v.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="truncate">{label}</p>
                  <p className="text-xs text-muted-foreground">{v.status ?? '—'}</p>
                </div>
                {disabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Switch checked={v.marketplace_visible} disabled aria-label="Vehicle marketplace visibility" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{disabledReason}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Switch
                    checked={v.marketplace_visible}
                    onCheckedChange={(value) => onToggleVehicle(v, value)}
                    aria-label="Vehicle marketplace visibility"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MarketplaceVisibilityTab;
