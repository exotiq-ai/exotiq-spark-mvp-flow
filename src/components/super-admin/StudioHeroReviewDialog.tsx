import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Check, X, ZoomIn, Save, Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { describeFunctionError } from '@/lib/functionError';
import { toast } from 'sonner';

type Vehicle = { id: string; make: string; model: string; year: number | null; image_url: string | null };
type Photo = { id: string; vehicle_id: string; url: string; enhanced_url: string | null; source: string | null; photo_type: string | null; original_filename: string | null };
type Sheet = { vehicle_id: string; sheet: Record<string, unknown>; reviewed_overrides: Record<string, unknown>; edited_at: string | null };
type Benchmark = { id: string; vehicle_id: string; render_url: string | null; recipe_version: string; model: string; qc_pass: boolean | null; fidelity_score: number | null; studio_score: number | null; qc_failures: string[]; qc_notes: string | null; error: string | null; created_at: string; review_status: string; reference_kind: string; review_details: unknown; identity_snapshot: Record<string, unknown> | null; duration_ms: number | null; cost_usd: number | null };
type Job = { id: string; vehicle_id: string; status: string; attempt_number: number; created_at: string; archived_at: string | null; error: string | null };
type Audit = { id: string; vehicle_id: string | null; action: string; created_at: string };
type Workspace = { vehicles: Vehicle[]; photos: Photo[]; sheets: Sheet[]; benchmarks: Benchmark[]; jobs: Job[]; audit: Audit[] };

export function StudioHeroReviewDialog({ teamId, open, onClose }: { teamId: string; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [vehicleId, setVehicleId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [model, setModel] = useState('google/gemini-3-pro-image');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [overrides, setOverrides] = useState('{}');
  const [correction, setCorrection] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [confirmedVehicle, setConfirmedVehicle] = useState(false);
  const [reset, setReset] = useState<'fleet' | 'vehicle' | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['studio-admin-workspace', teamId], enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('super_admin_studio_workspace', { _team_id: teamId });
      if (error) throw error;
      return data as unknown as Workspace;
    },
  });
  const vehicle = data?.vehicles.find((v) => v.id === vehicleId);
  const candidates = data?.benchmarks.filter((b) => b.vehicle_id === vehicleId) ?? [];
  const candidate = candidates.find((b) => b.id === candidateId) ?? candidates[0];
  const photos = data?.photos.filter((p) => p.vehicle_id === vehicleId && p.photo_type !== 'interior' && !['studio_render', 'ai_generated'].includes(p.source ?? '') && !/studio-hero|ai-hero|generated/i.test(p.original_filename ?? '')) ?? [];
  const sheet = data?.sheets.find((s) => s.vehicle_id === vehicleId);
  const jobs = data?.jobs.filter((j) => j.vehicle_id === vehicleId) ?? [];
  const used = jobs.filter((j) => !j.archived_at).length;
  useEffect(() => { if (!vehicleId && data?.vehicles[0]) setVehicleId(data.vehicles[0].id); }, [data, vehicleId]);
  useEffect(() => {
    setSelectedPhotos([]); setCandidateId(''); setConfirmedVehicle(false);
  }, [vehicleId]);
  useEffect(() => { setOverrides(JSON.stringify(sheet?.reviewed_overrides ?? {}, null, 2)); }, [sheet]);
  useEffect(() => { setConfirmedVehicle(false); }, [candidate?.id]);

  const refresh = async () => {
    await refetch();
    for (const key of ['studio-hero-jobs', 'vehicle-photos', 'vehicles', 'fleet', 'vehicle-hero-photos']) await queryClient.invalidateQueries({ queryKey: [key] });
  };
  const action = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try { await fn(); await refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not complete this action'); } finally { setBusy(null); }
  };
  const saveIdentity = () => action('save', async () => {
    let parsed: unknown;
    try { parsed = JSON.parse(overrides); } catch { throw new Error('Corrections must be valid JSON.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Corrections must be a JSON object.');
    const { error } = await supabase.rpc('super_admin_studio_save_identity', { _vehicle_id: vehicleId, _overrides: parsed as Record<string, string> });
    if (error) throw error;
    toast.success('Identity corrections saved');
  });
  const render = () => action('render', async () => {
    const { data: result, error } = await supabase.functions.invoke('studio-hero-benchmark', { body: { vehicleId, model, ...(selectedPhotos.length ? { sourcePhotoIds: selectedPhotos } : {}), correction, runLabel: `admin-${Date.now()}` } });
    if (error) throw new Error(await describeFunctionError(error, 'Photo test could not finish.'));
    if (result?.id) setCandidateId(result.id);
    if (result?.error) throw new Error(result.error);
    toast[result?.qc_pass ? 'success' : 'warning'](result?.qc_pass ? 'Preview passed quality review' : 'Preview needs further review');
  });
  const review = (decision: 'approved' | 'rejected') => action(decision, async () => {
    if (!candidate) return;
    const { error } = await supabase.rpc('super_admin_studio_review', { _result_id: candidate.id, _decision: decision, _same_vehicle: confirmedVehicle });
    if (error) throw error;
    toast.success(decision === 'approved' ? 'Candidate approved for benchmark comparison' : 'Candidate rejected');
  });
  const resetAttempts = () => action('reset', async () => {
    const response = reset === 'fleet'
      ? await supabase.rpc('super_admin_reset_studio_fleet', { _team_id: teamId })
      : await supabase.rpc('super_admin_reset_studio_hero', { _vehicle_id: vehicleId });
    if (response.error) throw response.error;
    setReset(null); toast.success('Render attempts reset; saved photos are unchanged');
  });
  const image = (url: string | null | undefined, label: string) => <figure className="min-w-0"><figcaption className="mb-2 text-xs text-muted-foreground">{label}</figcaption>{url ? <div className="relative"><img src={url} alt={label} className="aspect-[3/2] w-full rounded-md object-contain bg-muted" /><Button variant="secondary" size="icon" className="absolute bottom-2 right-2" aria-label={`Zoom ${label}`} onClick={() => setZoom(url)}><ZoomIn className="h-4 w-4" /></Button></div> : <div className="aspect-[3/2] flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground">No photo saved</div>}</figure>;

  return <>
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" data-testid="studio-review-dialog">
        <DialogHeader><DialogTitle>Studio photo review</DialogTitle></DialogHeader>
        {isLoading ? <div className="py-12 text-center"><Loader2 className="mx-auto animate-spin" /></div> : error ? <div role="alert" className="text-destructive">{error instanceof Error ? error.message : 'Could not load photo review'}<Button variant="outline" onClick={() => refetch()}>Try again</Button></div> : <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={vehicleId} onValueChange={setVehicleId}><SelectTrigger className="w-full sm:w-80" aria-label="Review vehicle"><SelectValue placeholder="Select vehicle" /></SelectTrigger><SelectContent>{data?.vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{[v.year, v.make, v.model].filter(Boolean).join(' ')}</SelectItem>)}</SelectContent></Select>
            <Badge variant="outline">{used} of 3 attempts used</Badge>
            <Button variant="outline" size="sm" disabled={!!busy || !vehicle} onClick={() => setReset('vehicle')}><RotateCcw className="mr-2 h-4 w-4" />Reset vehicle</Button>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => setReset('fleet')}><RotateCcw className="mr-2 h-4 w-4" />Reset fleet</Button>
          </div>
          {!!candidates.length && <Select value={candidate?.id ?? ''} onValueChange={setCandidateId}><SelectTrigger aria-label="Candidate history"><SelectValue /></SelectTrigger><SelectContent>{candidates.map((b) => <SelectItem key={b.id} value={b.id}>{new Date(b.created_at).toLocaleString()} · {b.recipe_version} · {b.model.split('/')[1]} · {b.review_status}</SelectItem>)}</SelectContent></Select>}
          <div className="grid gap-4 md:grid-cols-3">{image(photos.find((p) => p.id === selectedPhotos[0])?.url ?? photos[0]?.url, 'Original reference')}{image(vehicle?.image_url, 'Current hero')}{image(candidate?.render_url, 'Candidate preview')}</div>
          {candidate && <section className="space-y-3 border-y py-4">
            <div className="flex flex-wrap gap-2"><Badge variant={candidate.qc_pass ? 'secondary' : 'outline'}>{candidate.qc_pass ? 'Quality checks passed' : 'Quality checks not passed'}</Badge><Badge variant="outline">{candidate.recipe_version}</Badge><span className="text-sm text-muted-foreground">Fidelity {candidate.fidelity_score ?? '—'}/10 · Studio {candidate.studio_score ?? '—'}/10{candidate.duration_ms ? ` · ${Math.round(candidate.duration_ms / 1000)}s` : ''} · Cost {candidate.cost_usd == null ? 'not recorded' : `$${candidate.cost_usd.toFixed(3)}`}</span></div>
            <p className="text-sm">{candidate.error ?? candidate.qc_notes ?? 'No review notes saved'}</p>
            {!!candidate.qc_failures.length && <div className="flex flex-wrap gap-2">{candidate.qc_failures.map((f) => <Badge key={f} variant="outline">{f.replaceAll('_', ' ')}</Badge>)}</div>}
            <details><summary className="cursor-pointer text-sm">Detail checks and identity evidence</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ review: candidate.review_details, identity: candidate.identity_snapshot }, null, 2)}</pre></details>
            {candidate.reference_kind === 'example' && <Label className="flex items-center gap-2"><Checkbox checked={confirmedVehicle} onCheckedChange={(v) => setConfirmedVehicle(v === true)} />These references show this exact vehicle</Label>}
            <div className="flex flex-wrap gap-2">
              {candidate.qc_pass && candidate.review_details != null && !candidate.error && (candidate.reference_kind !== 'example' || confirmedVehicle) && <Button disabled={!!busy || candidate.review_status === 'approved'} onClick={() => review('approved')}><Check className="mr-2 h-4 w-4" />Approve candidate</Button>}
              <Button variant="outline" disabled={!!busy || candidate.review_status === 'rejected'} onClick={() => review('rejected')}><X className="mr-2 h-4 w-4" />Reject candidate</Button>
            </div>
          </section>}
          <section className="space-y-3"><h3 className="text-sm font-semibold">Reference photos</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{photos.map((p) => <label key={p.id} className="space-y-2 min-w-0"><img src={p.url} alt={p.original_filename ?? 'Vehicle reference'} className="aspect-[3/2] w-full rounded-md object-contain bg-muted" /><div className="flex items-center gap-2"><Checkbox aria-label={`Use ${p.original_filename ?? p.id}`} checked={selectedPhotos.includes(p.id)} onCheckedChange={(v) => setSelectedPhotos((ids) => v === true ? ids.length < 4 ? [...ids, p.id] : ids : ids.filter((id) => id !== p.id))} /><span className="truncate text-xs text-muted-foreground">{p.original_filename ?? 'Original'}</span></div></label>)}</div></section>
          <div className="grid gap-5 md:grid-cols-2">
            <section className="space-y-3"><h3 className="text-sm font-semibold">Identity corrections</h3><details><summary className="cursor-pointer text-sm text-muted-foreground">Saved vehicle identity</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(sheet?.sheet ?? {}, null, 2)}</pre></details><Textarea aria-label="Identity corrections" value={overrides} onChange={(e) => setOverrides(e.target.value)} className="min-h-40 font-mono text-xs" /><Button variant="outline" disabled={!!busy || !vehicle} onClick={saveIdentity}><Save className="mr-2 h-4 w-4" />Save corrections</Button></section>
            <section className="space-y-3"><h3 className="text-sm font-semibold">Test preview</h3><Select value={model} onValueChange={setModel}><SelectTrigger aria-label="Image model"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="google/gemini-3-pro-image">Nano Banana Pro</SelectItem><SelectItem value="google/gemini-2.5-flash-image">Current baseline · legacy</SelectItem></SelectContent></Select><Textarea aria-label="Render correction" value={correction} maxLength={2000} onChange={(e) => setCorrection(e.target.value)} placeholder="Vehicle-specific correction" className="min-h-28" /><Button disabled={!!busy || !vehicle || !photos.length} onClick={render}>{busy === 'render' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Render test preview</Button></section>
          </div>
          <section className="space-y-2"><h3 className="text-sm font-semibold">Render history</h3>{jobs.length ? jobs.map((j) => <div key={j.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-xs"><span>Attempt {j.attempt_number} · {j.status}{j.archived_at ? ' · reset' : ''}</span><span className="text-muted-foreground">{new Date(j.created_at).toLocaleString()}</span>{j.error && <p className="w-full text-muted-foreground">{j.error}</p>}</div>) : <p className="text-sm text-muted-foreground">No tenant renders yet.</p>}</section>
          <section className="space-y-2"><h3 className="text-sm font-semibold">Review activity</h3>{data?.audit.filter((a) => !a.vehicle_id || a.vehicle_id === vehicleId).map((a) => <div key={a.id} className="flex justify-between gap-2 text-xs"><span>{a.action.replaceAll('_', ' ')}</span><span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span></div>)}</section>
        </div>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!zoom} onOpenChange={() => setZoom(null)}><DialogContent className="max-w-6xl"><DialogHeader><DialogTitle>Photo detail</DialogTitle></DialogHeader>{zoom && <img src={zoom} alt="Enlarged vehicle detail" className="max-h-[75vh] w-full object-contain" />}</DialogContent></Dialog>
    <AlertDialog open={!!reset} onOpenChange={(v) => !v && setReset(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset {reset === 'fleet' ? 'the entire fleet’s' : 'this vehicle’s'} render attempts?</AlertDialogTitle><AlertDialogDescription>Three fresh attempts will be available per vehicle. Current heroes and past renders stay saved. No new renders will start.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={!!busy} onClick={(e) => { e.preventDefault(); resetAttempts(); }}>Reset attempts</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}