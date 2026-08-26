// @ts-nocheck
// Assertions applied to every fleet-tool result the harness executes.

export interface Failure {
  assertion: string;
  detail: string;
}

const BAD_STRING_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bundefined\b/, label: 'literal "undefined" in text' },
  { re: /\bNaN\b/, label: 'literal "NaN" in text' },
  { re: /(^|\s)null\s+\S/, label: 'literal "null" leaking into a name/phrase' },
  { re: /\$\s*NaN|\$undefined/, label: 'broken currency value' },
  { re: /\[object Object\]/, label: 'stringified object' },
];

/** Walk every string value in a result payload. */
function walkStrings(value: unknown, path: string, out: { path: string; text: string }[]) {
  if (typeof value === 'string') {
    out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walkStrings(v, path ? `${path}.${k}` : k, out);
    }
  }
}

/** Collect every `team_id` found anywhere in the payload. */
function collectTeamIds(value: unknown, out: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((v) => collectTeamIds(v, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'team_id' && typeof v === 'string') out.add(v);
      else collectTeamIds(v, out);
    }
  }
}

/** Collect record ids so two tenants can be checked for overlap. */
export function collectRecordIds(value: unknown, out: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((v) => collectRecordIds(v, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if ((k === 'id' || k.endsWith('_id')) && typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v)) {
        out.add(v);
      } else {
        collectRecordIds(v, out);
      }
    }
  }
}

function arrayFields(result: any): { key: string; length: number }[] {
  if (!result || typeof result !== 'object') return [];
  return Object.entries(result)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => ({ key: k, length: (v as unknown[]).length }));
}

export interface AssertOptions {
  teamId: string;
  args: Record<string, unknown>;
  /** Errors are expected (miss / refusal cases). */
  expectError?: boolean;
  /** Substring the summary must contain (case-insensitive). */
  expectSummaryContains?: string;
  /** Deterministic tenant only: enforce limit/timeframe correctness. */
  strict?: boolean;
}

export function assertResult(result: any, opts: AssertOptions): Failure[] {
  const failures: Failure[] = [];

  if (result == null || typeof result !== 'object') {
    return [{ assertion: 'shape', detail: `handler returned ${typeof result}, expected an object` }];
  }

  // 1. Error state
  if (opts.expectError) {
    if (!result.error && !/couldn'?t|could not|no |not find|don'?t see|unable/i.test(String(result.summary || ''))) {
      failures.push({
        assertion: 'expected-miss',
        detail: `expected a graceful miss, got: ${JSON.stringify(result).slice(0, 200)}`,
      });
    }
  } else if (result.error) {
    failures.push({ assertion: 'no-error', detail: String(result.error) });
  }

  // 2. Every tool must speak — an empty summary is a silent voice turn.
  if (typeof result.summary !== 'string' || result.summary.trim().length < 3) {
    failures.push({ assertion: 'summary', detail: `summary missing or too short: ${JSON.stringify(result.summary)}` });
  }

  // 3. No null/undefined/NaN leaking into human-readable text
  const strings: { path: string; text: string }[] = [];
  walkStrings(result, '', strings);
  for (const { path, text } of strings) {
    for (const { re, label } of BAD_STRING_PATTERNS) {
      if (re.test(text)) {
        failures.push({ assertion: 'clean-text', detail: `${label} at ${path}: "${text.slice(0, 140)}"` });
        break;
      }
    }
  }

  // 4. Tenant isolation — nothing from another team may appear
  const teamIds = new Set<string>();
  collectTeamIds(result, teamIds);
  for (const id of teamIds) {
    if (id !== opts.teamId) {
      failures.push({ assertion: 'tenant-isolation', detail: `foreign team_id ${id} in payload` });
    }
  }

  // 5. Filter correctness (deterministic tenant only)
  if (opts.strict) {
    const limit = Number(opts.args.limit);
    if (Number.isFinite(limit) && limit > 0) {
      for (const { key, length } of arrayFields(result)) {
        if (length > limit) {
          failures.push({ assertion: 'limit', detail: `${key} returned ${length} rows for limit=${limit}` });
        }
      }
    }
  }

  if (opts.expectSummaryContains) {
    const needle = opts.expectSummaryContains.toLowerCase();
    if (!String(result.summary || '').toLowerCase().includes(needle)) {
      failures.push({
        assertion: 'summary-contains',
        detail: `summary missing "${opts.expectSummaryContains}": ${String(result.summary).slice(0, 200)}`,
      });
    }
  }

  return failures;
}

/** Currency formatting check for non-USD tenants. */
export function assertCurrency(result: any, symbol: string): Failure[] {
  const strings: { path: string; text: string }[] = [];
  walkStrings(result, '', strings);
  const wrong = strings.filter(
    ({ text }) => symbol !== '$' && /\$\s?\d/.test(text),
  );
  if (wrong.length) {
    return [{
      assertion: 'currency',
      detail: `expected ${symbol} but found $ amounts: ${wrong.slice(0, 2).map((w) => w.text.slice(0, 100)).join(' | ')}`,
    }];
  }
  return [];
}
