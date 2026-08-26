/**
 * RariSelfTestPanel
 *
 * Super-admin-only console for the Rari end-to-end tool harness.
 * Runs the `rari-selftest` edge function through the caller's session,
 * renders the case x tenant matrix, and diffs the current run against
 * the last fully green run persisted in `rari_selftest_runs`.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, Loader2, MinusCircle, PlayCircle, RefreshCw, Search, XCircle } from 'lucide-react';
import { describeFunctionError } from '@/lib/functionError';

const SUITES = [
  { id: 'contract', label: 'Contract', hint: 'Registry / executor parity' },
  { id: 'execution', label: 'Execution', hint: 'Every tool against real data' },
  { id: 'questions', label: 'Questions', hint: 'Natural-language routing' },
  { id: 'golden', label: 'Golden numbers', hint: 'Tool output vs SQL truth' },
  { id: 'isolation', label: 'Isolation', hint: 'Cross-tenant read + write refusal' },
  { id: 'surfaces', label: 'Surfaces', hint: 'Voice vs MCP payload parity' },
  { id: 'drift', label: 'Drift', hint: 'Live workspace vs registry' },
  { id: 'session', label: 'Session', hint: 'Live websocket handshake' },
];

type CaseDetail = {
  key: string;
  suite: string;
  tenant: string;
  case: string;
  tool: string | null;
  input: Record<string, unknown>;
  mapping: {
    tool: string;
    foundInRegistry: boolean;
    category: string | null;
    readOnly: boolean | null;
    aliasMap: Record<string, string>;
    params: {
      registryName: string;
      handlerName: string;
      type: string;
      required: boolean;
      supplied: boolean;
      value: unknown;
    }[];
    undeclaredArgs: string[];
    missingRequired: string[];
    normalizedArgs: Record<string, unknown>;
  } | null;
  output: string;
  failures: { assertion?: string; detail?: string }[];
};

type RunResponse = {
  ok: boolean;
  runId: string | null;
  ranAt: string;
  elapsedMs: number;
  suites: string[];
  tenants: { teamId: string; name: string; currency: string; strict: boolean; ownerEmail?: string | null }[];
  totals: { cases: number; passed: number; failed: number; skipped: number };
  failures: { suite: string; tenant: string; case: string; assertion?: string; detail?: string }[];
  matrix: Record<string, Record<string, string>>;
  comparedTo: { runId: string; ranAt: string } | null;
  regressions: { case: string; tenant: string }[];
  fixed: { case: string; tenant: string }[];
  newCases: { case: string; tenant: string; status: string }[];
  details: CaseDetail[];
};

type StoredRun = {
  id: string;
  ran_at: string;
  ran_by_email: string | null;
  suites: string[];
  totals: RunResponse['totals'];
  is_green: boolean;
};

const StatusCell = ({ status, onInspect }: { status?: string; onInspect?: () => void }) => {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" aria-label="pass" />;
  if (status === 'FAIL')
    return onInspect ? (
      <button
        type="button"
        onClick={onInspect}
        className="mx-auto block rounded p-0.5 hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-destructive"
        aria-label="Inspect failing case"
      >
        <XCircle className="h-4 w-4 text-destructive" />
      </button>
    ) : (
      <XCircle className="h-4 w-4 text-destructive mx-auto" aria-label="fail" />
    );
  if (status === 'skip') return <MinusCircle className="h-4 w-4 text-muted-foreground mx-auto" aria-label="skipped" />;
  return <span className="text-muted-foreground text-xs">—</span>;
};

type TenantOption = {
  teamId: string;
  name: string;
  currency: string;
  ownerEmail: string | null;
  isDemo: boolean;
  isTestWorkspace: boolean;
};

const TENANT_STORAGE_KEY = 'rari_selftest_tenants';
/** Accounts the operator asked to cover by default. */
const DEFAULT_TENANT_EMAILS = ['hello@exotiq.ai', 'info@exoticsbythebay.co'];
const DEFAULT_TENANT_NAMES = ['exotiq', 'exotics by the bay'];

export const RariSelfTestPanel = () => {
  const [selected, setSelected] = useState<string[]>(SUITES.map((s) => s.id));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [history, setHistory] = useState<StoredRun[]>([]);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [tenantQuery, setTenantQuery] = useState('');
  const [loadingTenants, setLoadingTenants] = useState(false);

  const loadTenants = async () => {
    setLoadingTenants(true);
    try {
      const { data, error } = await supabase.functions.invoke('rari-selftest', {
        body: { action: 'tenants' },
      });
      if (error) throw error;
      const options = ((data?.tenants ?? []) as TenantOption[]).filter((t) => !t.isTestWorkspace);
      setTenantOptions(options);

      const stored = localStorage.getItem(TENANT_STORAGE_KEY);
      const restored = stored ? (JSON.parse(stored) as string[]) : null;
      const valid = (restored || []).filter((id) => options.some((o) => o.teamId === id));
      if (valid.length) {
        setTenantIds(valid);
      } else {
        const defaults = options
          .filter(
            (o) =>
              DEFAULT_TENANT_NAMES.includes(o.name.trim().toLowerCase()) &&
              (!o.ownerEmail || DEFAULT_TENANT_EMAILS.includes(o.ownerEmail.toLowerCase())),
          )
          .map((o) => o.teamId);
        setTenantIds(defaults);
      }
    } catch (e) {
      toast.error(await describeFunctionError(e, 'Could not load the workspace list'));
    } finally {
      setLoadingTenants(false);
    }
  };

  const setTenants = (ids: string[]) => {
    setTenantIds(ids);
    localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(ids));
  };

  const toggleTenant = (id: string) =>
    setTenants(tenantIds.includes(id) ? tenantIds.filter((t) => t !== id) : [...tenantIds, id]);

  const quickPick = (n: number) => setTenants(tenantOptions.slice(0, n).map((t) => t.teamId));

  const visibleTenants = useMemo(() => {
    const q = tenantQuery.trim().toLowerCase();
    if (!q) return tenantOptions;
    return tenantOptions.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.ownerEmail || '').toLowerCase().includes(q),
    );
  }, [tenantOptions, tenantQuery]);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from('rari_selftest_runs')
      .select('id, ran_at, ran_by_email, suites, totals, is_green')
      .order('ran_at', { ascending: false })
      .limit(10);
    if (error) return;
    setHistory((data || []) as unknown as StoredRun[]);
  };

  useEffect(() => { loadHistory(); loadTenants(); }, []);

  const toggleSuite = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const run = async () => {
    if (!selected.length) {
      toast.error('Pick at least one suite');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('rari-selftest', {
        body: {
          action: 'run',
          suites: selected,
          ...(tenantIds.length ? { teams: tenantIds } : { tenantSampleSize: 3 }),
          verbose: false,
        },
      });
      if (error) throw error;
      const payload = data as RunResponse;
      setResult(payload);
      await loadHistory();
      if (payload.ok) toast.success(`All ${payload.totals.cases} cases passed`);
      else toast.error(`${payload.totals.failed} case(s) failed`);
    } catch (e) {
      toast.error(await describeFunctionError(e, 'Self-test run failed'));
    } finally {
      setRunning(false);
    }
  };

  const tenantCols = result?.tenants ?? [];
  const caseRows = useMemo(() => Object.keys(result?.matrix ?? {}).sort(), [result]);
  const lastGreen = history.find((h) => h.is_green);
  const details = result?.details ?? [];
  const findDetail = (caseName: string, tenant: string) =>
    details.find((d) => d.case === caseName && d.tenant === tenant) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Rari self-test
            {result && (
              <Badge variant={result.ok ? 'default' : 'destructive'}>
                {result.ok ? 'Green' : `${result.totals.failed} failing`}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Exercises every Rari tool end to end against the dedicated test workspace plus a sample of live tenants.
            Results are stored so each run can be compared with the last fully green run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SUITES.map((s) => (
              <label key={s.id} className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={selected.includes(s.id)} onCheckedChange={() => toggleSuite(s.id)} />
                <span className="leading-tight">
                  <span className="text-sm font-medium block">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Live tenants sampled</span>
              {[1, 3, 5].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={tenantSampleSize === n ? 'default' : 'outline'}
                  onClick={() => setTenantSampleSize(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={running}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh history
            </Button>
            <Button onClick={run} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              {running ? 'Running…' : 'Run self-test'}
            </Button>
          </div>

          {lastGreen && (
            <p className="text-xs text-muted-foreground">
              Last green run: {new Date(lastGreen.ran_at).toLocaleString()} ({lastGreen.totals?.cases ?? 0} cases)
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          {(result.regressions.length > 0 || result.fixed.length > 0 || result.newCases.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Change since last green run</CardTitle>
                <CardDescription>
                  {result.comparedTo
                    ? `Compared with the run from ${new Date(result.comparedTo.ranAt).toLocaleString()}`
                    : 'No previous green run to compare against'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result.regressions.map((r) => (
                  <div key={`reg-${r.case}-${r.tenant}`} className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Regression: {r.case} on {r.tenant}
                  </div>
                ))}
                {result.fixed.map((r) => (
                  <div key={`fix-${r.case}-${r.tenant}`} className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Fixed: {r.case} on {r.tenant}
                  </div>
                ))}
                {result.newCases.map((r) => (
                  <div key={`new-${r.case}-${r.tenant}`} className="text-muted-foreground">
                    New case: {r.case} on {r.tenant} ({r.status})
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Matrix</CardTitle>
              <CardDescription>
                {result.totals.passed} passed · {result.totals.failed} failed · {result.totals.skipped} skipped ·{' '}
                {(result.elapsedMs / 1000).toFixed(1)}s
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Case</th>
                      {tenantCols.map((t) => (
                        <th key={t.teamId} className="py-2 px-2 font-medium text-center whitespace-nowrap">
                          {t.name}
                          {t.strict && <Badge variant="outline" className="ml-1">test</Badge>}
                        </th>
                      ))}
                      <th className="py-2 px-2 font-medium text-center">workspace</th>
                      <th className="py-2 px-2 font-medium text-center">caller</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseRows.map((c) => (
                      <tr key={c} className="border-b last:border-0">
                        <td className="py-1.5 pr-4 whitespace-nowrap">{c}</td>
                        {tenantCols.map((t) => (
                          <td key={t.teamId} className="py-1.5 px-2">
                            <StatusCell
                              status={result.matrix[c]?.[t.name] ?? result.matrix[c]?.[t.teamId]}
                              onInspect={() => setDetail(findDetail(c, t.name) ?? findDetail(c, t.teamId))}
                            />
                          </td>
                        ))}
                        <td className="py-1.5 px-2">
                          <StatusCell status={result.matrix[c]?.workspace} onInspect={() => setDetail(findDetail(c, 'workspace'))} />
                        </td>
                        <td className="py-1.5 px-2">
                          <StatusCell status={result.matrix[c]?.caller} onInspect={() => setDetail(findDetail(c, 'caller'))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {result.failures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Failures</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {result.failures.map((f, i) => (
                      <div key={i}>
                        <div className="text-sm font-medium">
                          {f.case} <span className="text-muted-foreground">· {f.tenant} · {f.suite}</span>
                        </div>
                        <div className="text-xs text-muted-foreground break-words">
                          {f.assertion}: {f.detail}
                        </div>
                        {findDetail(f.case, f.tenant) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-7 px-2 text-xs"
                            onClick={() => setDetail(findDetail(f.case, f.tenant))}
                          >
                            <Search className="h-3 w-3 mr-1" /> Inspect input / output
                          </Button>
                        )}
                        {i < result.failures.length - 1 && <Separator className="mt-3" />}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-words">{detail?.case}</DialogTitle>
            <DialogDescription>
              {detail?.tenant} · {detail?.suite} · tool: {detail?.tool ?? 'n/a'}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4 text-sm">
              <section>
                <h4 className="font-medium mb-1">Failed assertions</h4>
                <ul className="space-y-1">
                  {detail.failures.map((f, i) => (
                    <li key={i} className="text-xs text-destructive break-words">
                      {f.assertion}: {f.detail}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h4 className="font-medium mb-1">Tool input</h4>
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(detail.input, null, 2)}
                </pre>
              </section>

              {detail.mapping && (
                <section>
                  <h4 className="font-medium mb-1">Registry mapping</h4>
                  {!detail.mapping.foundInRegistry ? (
                    <p className="text-xs text-destructive">No registry entry for this tool name.</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        {detail.mapping.category} · {detail.mapping.readOnly ? 'read-only' : 'mutating'}
                        {detail.mapping.missingRequired.length > 0 && (
                          <span className="text-destructive">
                            {' '}· missing required: {detail.mapping.missingRequired.join(', ')}
                          </span>
                        )}
                        {detail.mapping.undeclaredArgs.length > 0 && (
                          <span className="text-amber-600">
                            {' '}· undeclared args: {detail.mapping.undeclaredArgs.join(', ')}
                          </span>
                        )}
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-1 pr-3">Registry param</th>
                            <th className="text-left py-1 pr-3">Handler arg</th>
                            <th className="text-left py-1 pr-3">Type</th>
                            <th className="text-left py-1 pr-3">Value sent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.mapping.params.map((prm) => (
                            <tr key={prm.registryName} className="border-b last:border-0">
                              <td className="py-1 pr-3">
                                {prm.registryName}
                                {prm.required && <span className="text-destructive"> *</span>}
                              </td>
                              <td className="py-1 pr-3 text-muted-foreground">{prm.handlerName}</td>
                              <td className="py-1 pr-3 text-muted-foreground">{prm.type}</td>
                              <td className="py-1 pr-3 break-all">
                                {prm.supplied ? JSON.stringify(prm.value) : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <h5 className="font-medium mt-3 mb-1">Normalized args passed to the handler</h5>
                      <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(detail.mapping.normalizedArgs, null, 2)}
                      </pre>
                    </>
                  )}
                </section>
              )}

              <section>
                <h4 className="font-medium mb-1">Tool output</h4>
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap">{detail.output}</pre>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <span>{new Date(h.ran_at).toLocaleString()}</span>
                  <span className="text-muted-foreground text-xs">{h.ran_by_email}</span>
                  <Badge variant={h.is_green ? 'default' : 'destructive'}>
                    {h.is_green ? 'green' : `${h.totals?.failed ?? '?'} failed`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RariSelfTestPanel;
