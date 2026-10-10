/**
 * Fact check for AI-found events: does the page the model cited actually show this event on this date?
 *
 * The model names a source URL; that proves a page exists, not that the event or its date is right. We fetch the
 * page (safely) and look for the event's distinctive words near the date, written however the site writes it.
 * Pure text logic is separate from the network call so it can be unit-tested.
 */

export type PageCheckStatus = 'confirmed' | 'no-match' | 'unreachable' | 'no-source';

export interface PageCheck {
  status: PageCheckStatus;
  url?: string;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON3 = MONTHS.map((m) => m.slice(0, 3));

/** Every common way a site writes an ISO date, lower case. */
export function dateVariants(iso: string): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return [];
  const y = m[1];
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const month = MONTHS[mo - 1];
  const mon = MON3[mo - 1];
  const dd = String(d).padStart(2, '0');
  const mm = String(mo).padStart(2, '0');
  const out = new Set<string>([
    iso,
    `${month} ${d}`, `${month} ${dd}`, `${mon} ${d}`, `${mon} ${dd}`, `${mon}. ${d}`,
    `${d} ${month}`, `${d} ${mon}`,
    `${mo}/${d}/${y}`, `${mm}/${dd}/${y}`, `${mo}/${d}`, `${mm}/${dd}`, `${mo}/${d}/${y.slice(2)}`, `${mm}/${dd}/${y.slice(2)}`,
    `${month} ${d}, ${y}`, `${mon} ${d}, ${y}`,
  ]);
  return [...out];
}

const STOP = new Set([
  'the', 'and', 'with', 'presents', 'live', 'tour', 'world', 'show', 'annual', 'festival', 'music', 'concert', 'game', 'vs',
  'conference', 'expo', 'exposition', 'meeting', 'weekend', 'night', 'day', 'series', 'championship', 'classic', 'national',
  'international', 'summit', 'forum', 'convention', 'fair', '2026', '2027', '2028',
]);

/** Distinctive words of an event name, longest first. */
export function distinctiveWords(name: string): string[] {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .sort((a, b) => b.length - a.length);
}

/** Collapse markup to searchable lower-case text. */
export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, (s) => (/application\/ld\+json/i.test(s) ? s.replace(/<[^>]+>/g, ' ') : ' '))
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const ANY_DATE = new RegExp(
  '\\b(?:' + MON3.join('|') + ')[a-z]*\\.? \\d{1,2}\\b|\\b\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2} (?:' + MON3.join('|') + ')[a-z]*\\b',
  'g',
);

/**
 * True when the page shows the event's distinctive words with the expected date as the date NEAREST to them (its first
 * day, last day, or any day of a short run). On a listing page full of neighbouring events, a nearby but different date
 * does not confirm.
 */
export function pageConfirmsEvent(text: string, name: string, date: string, endDate: string, anyDayOfWindow = false): boolean {
  const words = distinctiveWords(name);
  if (!words.length) return false;
  const days = new Set<string>([date, endDate]);
  const span = Math.round((Date.parse(endDate) - Date.parse(date)) / 86_400_000);
  // Normally the first day, the last day and the days of a short run; for a curated window, any day of it (up to 21).
  const limit = anyDayOfWindow ? 21 : 5;
  if (span > 0 && span <= limit) for (let i = 1; i < span; i++) days.add(new Date(Date.parse(date) + i * 86_400_000).toISOString().slice(0, 10));
  const needles = [...days].flatMap(dateVariants);
  const anchors = words.slice(0, 2); // the one or two most distinctive words
  const need = anchors.length >= 2 ? 2 : 1;
  const WINDOW = 350;

  let from = 0;
  const first = anchors[0];
  for (let guard = 0; guard < 200; guard++) {
    const at = text.indexOf(first, from);
    if (at < 0) return false;
    from = at + first.length;
    const lo = Math.max(0, at - WINDOW);
    const near = text.slice(lo, at + first.length + WINDOW);
    if (anchors.filter((w) => near.includes(w)).length < need) continue;

    const here = at - lo;
    // distance from the name to the closest mention of any date, and to the closest mention of an expected date
    let anyDist = Infinity;
    for (const m of near.matchAll(ANY_DATE)) anyDist = Math.min(anyDist, Math.abs((m.index ?? 0) - here));
    let wantDist = Infinity;
    for (const n of needles) {
      let i = near.indexOf(n);
      while (i >= 0) { wantDist = Math.min(wantDist, Math.abs(i - here)); i = near.indexOf(n, i + 1); }
    }
    if (wantDist !== Infinity && wantDist <= anyDist + 3) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Safe fetching
// ---------------------------------------------------------------------------

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

/** https only, no IP literals, no local or internal names. */
export function isSafeUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h === 'localhost') return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':') || /^\[/.test(h)) return false;
  if (/\.(local|internal|localhost|lan|home|corp|intranet)$/.test(h)) return false;
  return true;
}

/** Fetch one page as text; null when it cannot be read safely. */
export async function fetchPageText(url: string, timeoutMs = 8000): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeUrl(current)) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(current, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ExotiqEventCheck/1.0)', Accept: 'text/html,application/xhtml+xml' },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return null;
        current = new URL(loc, current).toString();
        continue;
      }
      if (!res.ok) return null;
      const type = res.headers.get('content-type') ?? '';
      if (!/text\/|json|xml/i.test(type)) return null;
      const reader = res.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.length;
      }
      try { await reader.cancel(); } catch { /* ignore */ }
      const merged = new Uint8Array(Math.min(total, MAX_BYTES));
      let off = 0;
      for (const c of chunks) { const room = merged.length - off; if (room <= 0) break; merged.set(c.subarray(0, room), off); off += Math.min(c.length, room); }
      return pageText(new TextDecoder().decode(merged));
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export interface VerifiableEvent {
  name: string;
  date: string;
  endDate: string;
  sourceUrls: string[];
  /** Curated windows are approximate: confirm when the page shows ANY day inside the window. */
  anyDayOfWindow?: boolean;
}

/**
 * Check events against their cited pages. Each distinct URL is fetched once (venue calendars are shared by dozens of
 * events), with a small concurrency limit. Returns one PageCheck per event, in order.
 */
export async function verifyEvents(
  events: VerifiableEvent[],
  opts: { concurrency?: number; fetchText?: (url: string) => Promise<string | null> } = {},
): Promise<PageCheck[]> {
  const fetchText = opts.fetchText ?? fetchPageText;
  const urls = [...new Set(events.flatMap((e) => e.sourceUrls.slice(0, 2)))].filter(isSafeUrl);
  const pages = new Map<string, string | null>();
  let next = 0;
  const workers = Array.from({ length: Math.min(opts.concurrency ?? 6, urls.length) }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      pages.set(url, await fetchText(url));
    }
  });
  await Promise.all(workers);

  return events.map((e): PageCheck => {
    const candidates = e.sourceUrls.slice(0, 2).filter(isSafeUrl);
    if (!candidates.length) return { status: 'no-source' };
    let reachable: string | undefined;
    for (const url of candidates) {
      const text = pages.get(url);
      if (text == null) continue;
      reachable = url;
      if (pageConfirmsEvent(text, e.name, e.date, e.endDate, e.anyDayOfWindow)) return { status: 'confirmed', url };
    }
    return reachable ? { status: 'no-match', url: reachable } : { status: 'unreachable', url: candidates[0] };
  });
}
