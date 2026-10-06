import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';

interface Row {
  vehicle_id: string;
  label: string;
  attempts: number;
  last_status: string;
  last_at: string;
}

const MAX = 3;

export const StudioHeroSupportSection = ({ teamId }: { teamId: string }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('super_admin_studio_hero_status', { _team_id: teamId });
    if (!error) setRows((data ?? []) as Row[]);
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const reset = async (row: Row) => {
    setBusy(row.vehicle_id);
    const { error } = await supabase.rpc('super_admin_reset_studio_hero', { _vehicle_id: row.vehicle_id });
    setBusy(null);
    if (error) {
      toast.error('Could not reset render counter', { description: error.message });
      return;
    }
    toast.success(`${row.label}: 3 fresh studio renders available`);
    load();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Studio hero photos</h3>
          <p className="text-xs text-muted-foreground">
            Reset a vehicle's render counter to give the operator 3 new attempts. Past renders stay saved.
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No studio renders for this account yet.</p>
        ) : (
          <ul className="divide-y divide-border" data-testid="studio-hero-support-list">
            {rows.map((r) => (
              <li key={r.vehicle_id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm truncate">{r.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{r.attempts} of {MAX} used</span>
                    <Badge variant={r.last_status === 'passed' ? 'secondary' : r.last_status === 'escalated' ? 'destructive' : 'outline'} className="text-[10px]">
                      {r.last_status}
                    </Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  disabled={busy === r.vehicle_id}
                  onClick={() => reset(r)}
                  data-testid="studio-hero-reset"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset counter
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
