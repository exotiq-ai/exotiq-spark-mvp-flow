// @ts-nocheck — dynamic tool arg handling; matches the original elevenlabs-tools behaviour.
// Shared FleetCopilot tool executor — the single implementation of every
// Rari capability. Voice (elevenlabs-tools) and MCP (rari-mcp-server) are
// thin adapters over this module.
//
// Every handler is team-scoped through the `teamId` argument. Handlers must
// never accept a team id from tool input.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { loadFleetTruth, recommendationFor, recommendAll, sharePct, rankByUtilization, methodNote, type FleetTruth } from '../motoriq/serverFacts.ts';
import { matchDemandCity } from '../demandCities.ts';
import { addDays, dayKey, endOfLocalDay, safeTimeZone } from '../motoriq/facts.ts';
import { calendarEvents, applyCalendarChecks, sliceEvents } from '../eventEngine.ts';

// Type definitions for database records
export interface Vehicle {
  id: string;
  name?: string;
  make: string;
  model: string;
  year: number;
  status?: string;
  location?: string;
  daily_rate?: number;
  current_rate?: number;
  utilization?: number;
  revenue?: number;
  license_plate?: string;
  vin?: string;
  suggested_rate?: number;
}

export interface Booking {
  id: string;
  start_date: string;
  end_date: string;
  status?: string;
  total_amount?: number;
  total_value?: number;
  daily_rate?: number;
  payment_status?: string;
  payment_method?: string;
  customer_name?: string;
  created_at?: string;
  vehicle_id?: string;
  customer_id?: string;
  vehicles?: Vehicle & { vehicle_name?: string };
  customers?: { full_name?: string; email?: string };
}

export interface Customer {
  id: string;
  full_name?: string;

  email?: string;
  phone?: string;
  customer_tier?: string;
  customer_status?: string;
  company_name?: string;
  total_bookings?: number;
  lifetime_value?: number;
}

export interface DamageReport {
  id: string;
  severity?: string;
  claim_status?: string;
  estimated_cost?: number;
  reported_date?: string;
  vehicles?: Vehicle;
}

export interface MaintenanceRecord {
  id: string;
  maintenance_type?: string;
  scheduled_date?: string;
  estimated_cost?: number;
  status?: string;
  vehicles?: Vehicle;
}

export interface ToolResult {
  [key: string]: unknown;
  summary?: string;
  error?: string;
}

// Generate a unique request ID for tracing
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// VOICE-FRIENDLY FORMATTING HELPERS
// ============================================================

/**
 * Formats a number using words (thousand, million, billion) for natural speech
 * Examples: 1500 -> "1.5 thousand", 2000000 -> "2 million"
 */
export function formatNumberWords(n: number): string {
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  
  if (absN >= 1_000_000_000) {
    const val = absN / 1_000_000_000;
    const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1).replace(/\.0$/, '');
    return `${sign}${formatted} billion`;
  }
  if (absN >= 1_000_000) {
    const val = absN / 1_000_000;
    const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1).replace(/\.0$/, '');
    return `${sign}${formatted} million`;
  }
  if (absN >= 1_000) {
    const val = absN / 1_000;
    // For values under 10k, use one decimal; above, round to whole
    const formatted = absN < 10_000 
      ? (val % 1 === 0 ? val.toString() : val.toFixed(1).replace(/\.0$/, ''))
      : Math.round(val).toString();
    return `${sign}${formatted} thousand`;
  }
  return `${sign}${Math.round(absN)}`;
}

/**
 * Formats a USD amount using words for natural speech
 * Examples: 1500 -> "$1.5 thousand", 2000000 -> "$2 million", 950 -> "$950"
 */
/**
 * Resolves a spoken timeframe into a rental window.
 *
 * IMPORTANT: rental activity must be measured against the rental window
 * (start_date / end_date), never created_at. A booking created six months ago
 * for a rental happening this week belongs to "this week", and a booking
 * created today for next month does not.
 *
 * Returns ISO bounds; `start` is null for all-time.
 */
export function resolveTimeframeWindow(timeframe?: string, tz = 'UTC'): { start: string | null; end: string; label: string } {
  // Days are the tenant's calendar days: "today" starts at local midnight, not at UTC midnight.
  const zone = safeTimeZone(tz);
  const todayKey = dayKey(Date.now(), zone);
  const startOf = (key: string) => new Date(endOfLocalDay(addDays(key, -1), zone) + 1).toISOString();
  const end = new Date(endOfLocalDay(todayKey, zone)).toISOString();
  switch (timeframe) {
    case 'today':
      return { start: startOf(todayKey), end, label: 'today' };
    case 'week':
      return { start: startOf(addDays(todayKey, -7)), end, label: 'the last 7 days' };
    case 'month':
      return { start: startOf(addDays(todayKey, -30)), end, label: 'the last 30 days' };
    case 'year':
      return { start: startOf(addDays(todayKey, -365)), end, label: 'the last 12 months' };
    default:
      return { start: null, end, label: 'all time' };
  }
}

/** The start and end (ms) of one local calendar day, yyyy-MM-dd, in a time zone. */
export function localDayBounds(key: string, tz = 'UTC'): { start: number; end: number } {
  const zone = safeTimeZone(tz);
  return { start: endOfLocalDay(addDays(key, -1), zone) + 1, end: endOfLocalDay(key, zone) };
}

/** A date or timestamp as a local calendar day: date-only strings stay as they are, timestamps are read in `tz`. */
function ymdOf(value: string, tz = 'UTC'): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : dayKey(Date.parse(value), safeTimeZone(tz));
}

/** "10/10/2026"-style short date in the tenant's zone (replaces server-local toLocaleDateString()). */
export function fmtDay(value: string | number | Date, tz = 'UTC'): string {
  return new Date(value).toLocaleDateString('en-US', { timeZone: safeTimeZone(tz) });
}

/** "2:30 PM" in the tenant's zone, for times Rari says out loud. */
export function fmtTime(value: string | number | Date, tz = 'UTC'): string {
  return new Date(value).toLocaleTimeString('en-US', { timeZone: safeTimeZone(tz), hour: 'numeric', minute: '2-digit' });
}

/** The tenant's IANA time zone (teams.timezone), else UTC. */
async function tenantTimeZone(supabase: SupabaseClient, teamId: string | null): Promise<string> {
  if (!teamId) return 'UTC';
  try {
    const { data } = await supabase.from('teams').select('timezone').eq('id', teamId).maybeSingle();
    return safeTimeZone((data as any)?.timezone);
  } catch {
    return 'UTC';
  }
}

/**
 * Applies a rental-window overlap filter to a bookings query.
 * A booking counts when its rental period intersects [start, end].
 */
export function applyRentalWindow<T>(query: T, window: { start: string | null; end: string }): T {
  if (!window.start) return query;
  // overlap: booking.start_date <= window.end AND booking.end_date >= window.start
  return (query as any).lte('start_date', window.end).gte('end_date', window.start) as T;
}

export function formatUsdWords(amount: number): string {

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  
  if (absAmount >= 1_000_000_000) {
    const val = absAmount / 1_000_000_000;
    const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1).replace(/\.0$/, '');
    return `${sign}$${formatted} billion`;
  }
  if (absAmount >= 1_000_000) {
    const val = absAmount / 1_000_000;
    const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1).replace(/\.0$/, '');
    return `${sign}$${formatted} million`;
  }
  if (absAmount >= 1_000) {
    const val = absAmount / 1_000;
    const formatted = absAmount < 10_000 
      ? (val % 1 === 0 ? val.toString() : val.toFixed(1).replace(/\.0$/, ''))
      : Math.round(val).toString();
    return `${sign}$${formatted} thousand`;
  }
  return `${sign}$${Math.round(absAmount)}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Formats an ISO date string to natural speech format
 * Example: "2026-02-10" -> "February 10, 2026"
 */
export function formatDateLong(isoDate: string, tz = 'UTC'): string {
  try {
    const [y, m, d] = ymdOf(isoDate, tz).split('-').map(Number);
    if (!y || !m || !d) return isoDate;
    return `${MONTHS[m - 1]} ${d}, ${y}`;
  } catch {
    return isoDate;
  }
}

/**
 * Formats a date range for natural speech
 * Example: ("2026-02-10", "2026-02-14") -> "February 10 to 14, 2026" or "February 10 to March 2, 2026"
 */
export function formatDateRange(startIso: string, endIso: string, tz = 'UTC'): string {
  try {
    const [startYear, sm, startDay] = ymdOf(startIso, tz).split('-').map(Number);
    const [endYear, em, endDay] = ymdOf(endIso, tz).split('-').map(Number);
    if (!startYear || !sm || !startDay || !endYear || !em || !endDay) return `${startIso} to ${endIso}`;
    const startMonth = MONTHS[sm - 1];
    const endMonth = MONTHS[em - 1];

    // One day
    if (startYear === endYear && sm === em && startDay === endDay) {
      return `${startMonth} ${startDay}, ${startYear}`;
    }

    // Same month and year
    if (startMonth === endMonth && startYear === endYear) {
      return `${startMonth} ${startDay} to ${endDay}, ${startYear}`;
    }
    // Same year, different months
    if (startYear === endYear) {
      return `${startMonth} ${startDay} to ${endMonth} ${endDay}, ${startYear}`;
    }
    // Different years
    return `${startMonth} ${startDay}, ${startYear} to ${endMonth} ${endDay}, ${endYear}`;
  } catch {
    return `${startIso} to ${endIso}`;
  }
}

export function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

// ---------------------------------------------------------------------------
// Tenant locations — always derived from the tenant's own data. Hardcoded
// city lists (the old PEAK_SEASONS calendar) were removed 2026-08-26: they
// fabricated surge pricing for tenants in markets we know nothing about.
// ---------------------------------------------------------------------------

/**
 * Returns the tenant's location names from the `locations` table, falling
 * back to distinct vehicle locations when no location records exist.
 */
export async function getTenantLocations(
  supabase: SupabaseClient,
  teamId: string | null,
): Promise<string[]> {
  if (!teamId) return [];

  const { data: locationRows } = await supabase
    .from('locations')
    .select('name, city')
    .eq('team_id', teamId);

  const names = (locationRows || [])
    .map((r: any) => String(r.name || r.city || '').trim())
    .filter(Boolean);
  if (names.length > 0) return [...new Set(names)];

  const { data: vehicleRows } = await supabase
    .from('vehicles')
    .select('location')
    .eq('team_id', teamId)
    .not('location', 'is', null);

  return [...new Set((vehicleRows || []).map((r: any) => String(r.location).trim()).filter(Boolean))];
}

/**
 * The tenant's primary location (first configured), or undefined when the
 * tenant has none — callers must then operate fleet-wide rather than
 * defaulting to an arbitrary city.
 */
export async function getTenantDefaultLocation(
  supabase: SupabaseClient,
  teamId: string | null,
): Promise<string | undefined> {
  const locations = await getTenantLocations(supabase, teamId);
  return locations[0];
}

// Helper function to build team filter for multi-tenant queries
export function buildTeamFilter(teamId: string | null): { field: string; value: string } | null {
  if (!teamId) return null;
  return { field: 'team_id', value: teamId };
}

// ---------------------------------------------------------------------------
// ask_fleet — natural language router (folded in from the retired
// `rari-universal-query` function). It owns NO queries of its own: it maps a
// free-form question onto the existing, team-scoped executor cases below.
// ---------------------------------------------------------------------------

const ASK_FLEET_INTENTS: Array<{ tool: string; keywords: string[] }> = [
  { tool: 'getFleetProfitLoss', keywords: ['profit', 'loss', 'p&l', 'p & l', 'margin', 'expense', 'roi', 'net'] },
  { tool: 'getRevenueAnalysis', keywords: ['revenue', 'income', 'earnings', 'sales', 'money made', 'gross'] },
  { tool: 'getIdleVehicles', keywords: ['idle', 'unused', 'sitting', 'not rented', 'underperforming', 'underused'] },
  { tool: 'getOutstandingBalances', keywords: ['outstanding', 'balance', 'unpaid', 'owe', 'overdue payment', 'past due'] },
  { tool: 'getPaymentSummary', keywords: ['payment', 'paid', 'deposit', 'invoice'] },
  { tool: 'getUpcomingMaintenance', keywords: ['maintenance', 'service due', 'repair', 'work order', 'out of service'] },
  { tool: 'getCustomerSegments', keywords: ['segment', 'vip', 'retention', 'loyal', 'repeat customer'] },
  { tool: 'getCustomerLifetimeValue', keywords: ['lifetime value', 'ltv', 'best customer', 'top customer'] },
  { tool: 'getTopPerformers', keywords: ['top performer', 'best vehicle', 'highest earning', 'most booked'] },
  { tool: 'getDemandForecast', keywords: ['forecast', 'predict', 'demand', 'projection', 'upcoming demand'] },
  { tool: 'getPricingRecommendation', keywords: ['price', 'pricing', 'rate', 'surge', 'optimize rate'] },
  { tool: 'compareLocations', keywords: ['compare', ' vs ', 'versus', 'comparison', 'which market', 'which location'] },
  { tool: 'get_bookings', keywords: ['booking', 'reservation', 'rental', 'who is renting'] },
  { tool: 'getRariInsights', keywords: ['insight', 'recommendation', 'suggest', 'opportunity', 'what should i'] },
  { tool: 'get_fleet_vehicles', keywords: ['vehicle', 'car', 'fleet list', 'available', 'inventory'] },
  { tool: 'getLocationMetrics', keywords: ['location', 'market', 'city', 'by region'] },
];

const ASK_FLEET_TIMEFRAMES: Array<{ value: string; keywords: string[] }> = [
  { value: 'today', keywords: ['today', 'tonight', 'right now'] },
  { value: 'week', keywords: ['this week', 'last week', 'past week', '7 days'] },
  { value: 'month', keywords: ['this month', 'last month', 'past month', '30 days'] },
  { value: 'year', keywords: ['this year', 'last year', 'past year', 'ytd', '12 months'] },
  { value: 'all', keywords: ['all time', 'ever', 'overall', 'lifetime'] },
];

function detectAskFleetTool(question: string): string {
  const q = ` ${question.toLowerCase()} `;
  for (const intent of ASK_FLEET_INTENTS) {
    if (intent.keywords.some((k) => q.includes(k))) return intent.tool;
  }
  return 'getFleetMetrics';
}

function detectAskFleetTimeframe(question: string): string | undefined {
  const q = question.toLowerCase();
  for (const tf of ASK_FLEET_TIMEFRAMES) {
    if (tf.keywords.some((k) => q.includes(k))) return tf.value;
  }
  return undefined;
}

/**
 * Resolves a location mentioned in the question against the TEAM'S OWN
 * locations. No hardcoded city list — every tenant works out of the box.
 */
async function detectAskFleetLocation(
  supabase: SupabaseClient,
  teamId: string | null,
  question: string,
): Promise<string | undefined> {
  if (!teamId) return undefined;
  const { data } = await supabase
    .from('vehicles')
    .select('location')
    .eq('team_id', teamId)
    .not('location', 'is', null);

  const locations = [...new Set((data || []).map((r: any) => String(r.location).trim()).filter(Boolean))];
  const q = question.toLowerCase();
  // Longest match wins so "north miami" beats "miami".
  return locations
    .filter((loc) => q.includes(loc.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
}

/** Words that look like names but never are, so they can't match a customer. */
const CUSTOMER_STOPWORDS = new Set([
  'what', 'whats', 'who', 'how', 'when', 'where', 'why', 'the', 'a', 'an', 'is', 'are', 'was',
  'has', 'have', 'had', 'do', 'does', 'did', 'my', 'me', 'our', 'us', 'with', 'for', 'from',
  'booked', 'booking', 'bookings', 'rental', 'rentals', 'fleet', 'car', 'cars', 'vehicle',
  'this', 'that', 'today', 'week', 'month', 'year', 'and', 'about', 'tell', 'show', 'list',
]);

/**
 * A question that names one of the team's own customers is about that
 * customer, not the fleet average. Returns the customer's full name.
 */
async function detectAskFleetCustomer(
  supabase: SupabaseClient,
  teamId: string | null,
  question: string,
): Promise<string | undefined> {
  if (!teamId) return undefined;
  const words = searchTokens(question)
    .map((w) => w.replace(/[^a-z'-]/g, ''))
    .filter((w) => w.length > 2 && !CUSTOMER_STOPWORDS.has(w));
  if (words.length === 0) return undefined;

  const { data } = await supabase
    .from('customers')
    .select('full_name')
    .eq('team_id', teamId)
    .limit(1000);

  const names = (data || []).map((c: any) => String(c.full_name || '').trim()).filter(Boolean);
  const q = ` ${question.toLowerCase()} `;

  // Full name mentioned outright wins.
  const full = names
    .filter((n) => q.includes(` ${n.toLowerCase()} `) || q.includes(n.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  if (full) return full;

  // Otherwise a distinctive first or last name token.
  for (const word of words) {
    const hits = names.filter((n) =>
      n.toLowerCase().split(/\s+/).some((part) => part === word),
    );
    if (hits.length >= 1) return hits[0];
  }
  return undefined;
}



/**
 * Registry param name -> handler param name.
 *
 * `registry.ts` is synced to ElevenLabs, so its schemas are frozen. Handlers
 * historically used different spellings, which meant every single-entity
 * lookup received `undefined`. This map bridges the two; both spellings work.
 *
 * Keep this in sync with the parity test (src/test/fleet-tools.parity.test.ts).
 */
export const TOOL_PARAM_ALIASES: Record<string, Record<string, string>> = {
  get_vehicle_status: { vehicle: 'vehicle_name' },
  getVehicleDetails: { vehicle: 'vehicleName' },
  getVehicleSpecs: { vehicle: 'vehicleName' },
  checkAvailability: { vehicle: 'vehicleName' },
  getVehicleProfitLoss: { vehicle: 'vehicleName' },
  getPricingRecommendation: { vehicle: 'vehicleName' },
  getCustomerProfile: { customer: 'customerName' },
  getCustomerLifetimeValue: { customer: 'customerName' },
  getIdleVehicles: { days: 'daysIdle' },
  create_booking_hold: {
    customer: 'customer_name',
    startDate: 'start_date',
    endDate: 'end_date',
    // `vehicle` (free text) is resolved to `vehicle_id` inside the handler,
    // scoped to the caller's team.
  },
};

/** Copy registry-named args onto the handler names the executor reads. */
export function normalizeToolArgs(
  functionName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const aliases = TOOL_PARAM_ALIASES[functionName];
  if (!aliases) return { ...(args || {}) };
  const out: Record<string, unknown> = { ...(args || {}) };
  for (const [from, to] of Object.entries(aliases)) {
    if (out[to] === undefined && out[from] !== undefined) out[to] = out[from];
  }
  return out;
}

/** Human vehicle name that never renders a leading "null"/"undefined" year. */
export function vehicleDisplayName(v: {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  name?: string | null;
} | null | undefined): string {
  if (!v) return 'Unknown vehicle';
  const year = v.year === null || v.year === undefined || v.year === '' ? '' : String(v.year);
  const parts = [year, v.make || '', v.model || ''].map((s) => String(s).trim()).filter(Boolean);
  const composed = parts.join(' ').trim();
  return composed || (v.name ? String(v.name) : 'Unknown vehicle');
}

/** Clamp a caller-supplied limit into a sane range. */
function toLimit(value: unknown, fallback: number, max = 100): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/** Resolve a free-text vehicle reference to one vehicle inside the team. */
async function resolveTeamVehicle(
  supabase: SupabaseClient,
  teamId: string | null,
  text: string,
): Promise<{ vehicle?: any; matches?: any[]; error?: string }> {
  const term = String(text || '').trim();
  if (!term) return { error: 'no_vehicle_reference' };
  let q = supabase
    .from('vehicles')
    .select('id, name, year, make, model, current_rate, location, status');
  if (teamId) q = q.eq('team_id', teamId);
  const { data } = await q
    .or(`name.ilike.%${term}%,make.ilike.%${term}%,model.ilike.%${term}%`)
    .limit(5);
  const matches = data || [];
  if (matches.length === 0) return { error: 'not_found' };
  if (matches.length > 1) return { matches };
  return { vehicle: matches[0] };
}

/** Split free text into lowercase search tokens. */
export function searchTokens(text: unknown): string[] {
  return String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** True when every token appears in at least one of the haystack fields. */
export function matchesAllTokens(tokens: string[], fields: Array<unknown>): boolean {
  if (tokens.length === 0) return true;
  const hay = fields
    .map((f) => (f === null || f === undefined ? '' : String(f).toLowerCase()))
    .filter(Boolean);
  return tokens.every((tok) => hay.some((h) => h.includes(tok)));
}

/**
 * Resolve a free-text vehicle phrase inside the caller's team by matching every
 * token against name / make / model / year. Handles "Ferrari 488 Spider", which
 * a single whole-phrase ILIKE can never match (make and model are split).
 */
async function findTeamVehicleByTokens(
  supabase: SupabaseClient,
  teamId: string | null,
  text: string,
): Promise<any | null> {
  const tokens = searchTokens(text);
  if (tokens.length === 0) return null;

  let q = supabase.from('vehicles').select('*');
  if (teamId) q = q.eq('team_id', teamId);
  const { data } = await q.limit(500);
  const vehicles = data || [];

  const matches = vehicles.filter((v: any) =>
    matchesAllTokens(tokens, [v.name, v.make, v.model, v.year, v.license_plate]),
  );
  if (matches.length > 0) return matches[0];

  // Fall back to the loosest useful signal: any single token hitting make/model/name.
  const loose = vehicles.filter((v: any) =>
    tokens.some((tok) => matchesAllTokens([tok], [v.name, v.make, v.model, v.year, v.license_plate])),
  );
  return loose[0] || null;
}

/**
 * Does the question name a vehicle in this team? Returns the matched vehicle so
 * ask_fleet can route to the vehicle record instead of fleet-wide metrics.
 * Ignores generic words so "how is the fleet doing" stays fleet-wide.
 */
const ASK_FLEET_VEHICLE_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'my', 'our', 'on', 'in', 'of', 'for', 'with', 'and', 'or',
  'what', "what's", 'whats', 'how', 'how\'s', 'hows', 'who', 'when', 'where', 'why', 'going', 'doing',
  'status', 'about', 'tell', 'me', 'show', 'give', 'do', 'does', 'did', 'it', 'this', 'that', 'to',
  'car', 'cars', 'vehicle', 'vehicles', 'fleet', 'now', 'today', 'up', 'any', 'all', 'right',
]);

async function detectAskFleetVehicle(
  supabase: SupabaseClient,
  teamId: string | null,
  question: string,
): Promise<any | null> {
  const tokens = searchTokens(question)
    .map((t) => t.replace(/[^\w-]/g, ''))
    .filter((t) => t.length >= 2 && !ASK_FLEET_VEHICLE_STOPWORDS.has(t));
  if (tokens.length === 0) return null;

  let q = supabase.from('vehicles').select('*');
  if (teamId) q = q.eq('team_id', teamId);
  const { data } = await q.limit(500);
  const vehicles = data || [];

  // Score each vehicle by how many of its identifying words the question names.
  let best: { vehicle: any; score: number } | null = null;
  for (const v of vehicles) {
    const identifiers = [v.make, v.model, v.name, v.year, v.license_plate]
      .filter(Boolean)
      .flatMap((f: any) => String(f).toLowerCase().split(/\s+/))
      .map((s) => s.replace(/[^\w-]/g, ''))
      .filter((s) => s.length >= 2);
    const score = tokens.filter((tok) => identifiers.includes(tok)).length;
    if (score > 0 && (!best || score > best.score)) best = { vehicle: v, score };
  }
  return best?.vehicle || null;
}

/**
 * Current + upcoming bookings for a vehicle, plus the last 2 completed ones.
 * Upcoming are sorted soonest-first and take priority; max 5 entries total.
 */
async function getVehicleBookingWindow(
  supabase: SupabaseClient,
  vehicleId: string,
  teamId: string | null,
  tz = 'UTC',
): Promise<Array<Record<string, unknown>>> {
  let q = supabase
    .from('bookings')
    .select('*, customers(full_name)')
    .eq('vehicle_id', vehicleId);
  if (teamId) q = q.eq('team_id', teamId);
  const { data } = await q.order('start_date', { ascending: false }).limit(100);
  const rows = data || [];

  const todayStart = new Date(localDayBounds(dayKey(Date.now(), safeTimeZone(tz)), tz).start);
  const dead = new Set(['cancelled', 'canceled', 'declined', 'expired', 'rejected']);

  const live = rows.filter(
    (b: any) => !dead.has(String(b.status || '').toLowerCase()) && new Date(b.end_date) >= todayStart,
  );
  live.sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const past = rows
    .filter(
      (b: any) => !dead.has(String(b.status || '').toLowerCase()) && new Date(b.end_date) < todayStart,
    )
    .sort((a: any, b: any) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())
    .slice(0, 2);

  const chosen = [...live, ...past].slice(0, 5);

  return chosen.map((b: any) => {
    const start = new Date(b.start_date);
    const end = new Date(b.end_date);
    const isCurrent = start <= new Date() && end >= new Date();
    return {
      reference: b.booking_ref,
      customer: b.customers?.full_name || b.customer_name || 'Unknown',
      dates: `${fmtDay(start, tz)} to ${fmtDay(end, tz)}`,
      status: b.status,
      timing: end < todayStart ? 'past' : isCurrent ? 'current' : 'upcoming',
      amount: `$${Number(b.total_value || b.total_amount || 0).toFixed(0)}`,
    };
  });
}


// ---------------------------------------------------------------------------
// Facts, not stored columns. `vehicles.utilization`, `vehicles.suggested_rate` and `vehicles.revenue` are not
// maintained by anything (stored utilization correlated 0.06 with real bookings), so no tool may read them.
// Everything Rari says about utilization, revenue per car and rate advice comes from the tenant's own bookings,
// computed by the same code the MotorIQ screens use (see ../motoriq), in the tenant's time zone.
// ---------------------------------------------------------------------------

const COUNTED_STATUSES = ['active', 'confirmed', 'completed'];

/** The tenant's computed fleet facts, or null when there is no team or the read fails (callers then say so). */
async function fleetTruth(supabase: SupabaseClient, teamId: string | null, location?: unknown): Promise<FleetTruth | null> {
  if (!teamId) return null;
  try {
    const loc = typeof location === 'string' && location.trim() && location !== 'all' ? location : null;
    return await loadFleetTruth(supabase as any, teamId, { location: loc });
  } catch (e) {
    console.error('[fleetTruth] could not compute facts:', e);
    return null;
  }
}

/** "37%" or "not enough data" */
const pctLabel = (p: number | null | undefined): string => (p == null ? 'not enough data' : `${p}%`);
/** "37% utilization" or "utilization not measurable yet" (for sentences) */
const utilPhrase = (label: string): string => (label.endsWith('%') ? `${label} utilization` : 'utilization not measurable yet');
const carsWord = (n: number): string => `${n} ${n === 1 ? 'vehicle' : 'vehicles'}`;
const dollars0 = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/** One car's utilization in words, or an honest "not measurable". */
function utilizationWords(truth: FleetTruth | null, vehicleId: string): string {
  const p = sharePct(truth?.byId.get(vehicleId)?.trailing30);
  return p == null ? 'utilization not measurable yet' : `${p}% of days booked in the last 30 days`;
}

/** What one car brought in over the last 30 days, in words. */
function earnedWords(truth: FleetTruth | null, vehicleId: string): string {
  const e = truth?.byId.get(vehicleId)?.earnedLast30;
  return e != null ? `${formatUsdWords(e)} from bookings in the last 30 days` : 'no booked days in the last 30 days';
}

/**
 * Booked revenue per car from the tenant's bookings (counted statuses only), optionally inside a rental window.
 * `bookings.total_value` is the only amount column.
 */
async function bookedRevenueByVehicle(
  supabase: SupabaseClient,
  teamId: string | null,
  window?: { start: string | null; end: string },
): Promise<{ byVehicle: Map<string, { revenue: number; bookings: number }>; truncated: boolean }> {
  const byVehicle = new Map<string, { revenue: number; bookings: number }>();
  if (!teamId) return { byVehicle, truncated: false };
  const PAGE = 1000;
  const MAX_PAGES = 10;
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = supabase
      .from('bookings')
      .select('vehicle_id, total_value')
      .eq('team_id', teamId)
      .in('status', COUNTED_STATUSES)
      .order('start_date', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (window?.start) q = (q as any).lte('start_date', window.end).gte('end_date', window.start);
    const { data, error } = await q;
    if (error) { console.error('[bookedRevenueByVehicle]', error.message); break; }
    for (const b of (data || []) as any[]) {
      if (!b.vehicle_id) continue;
      const e = byVehicle.get(b.vehicle_id) || { revenue: 0, bookings: 0 };
      e.revenue += Number(b.total_value || 0);
      e.bookings += 1;
      byVehicle.set(b.vehicle_id, e);
    }
    if (!data || data.length < PAGE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }
  return { byVehicle, truncated };
}

export async function executeFunction(functionName: string, rawArgs: Record<string, unknown>, supabase: SupabaseClient, userId: string, teamId: string | null): Promise<ToolResult> {
  const args = normalizeToolArgs(functionName, rawArgs || {});
  // Every date and "today" a tool uses is in the tenant's own time zone (selected location's, else the team's), not UTC.
  const tz = await tenantTimeZone(supabase, teamId);
  console.log(`[TOOL] Executing: ${functionName} | User: ${userId} | Team: ${teamId} | Args:`, JSON.stringify(args));

  try {
    switch (functionName) {

      case "ask_fleet": {
        const { question, timeframe, location } = args as {
          question?: string;
          timeframe?: string;
          location?: string;
        };

        if (!question || !String(question).trim()) {
          return {
            error: 'A question is required.',
            summary: 'What would you like to know about the fleet?',
          };
        }

        const asked = String(question).trim();

        // A question that names one of the team's own vehicles is about that
        // vehicle, not the fleet average.
        const namedVehicle = await detectAskFleetVehicle(supabase, teamId, asked);
        if (namedVehicle) {
          const vehicleRef = namedVehicle.name || vehicleDisplayName(namedVehicle);
          console.log(`[ask_fleet] "${asked}" -> getVehicleDetails (${vehicleRef})`);
          const detail = await executeFunction(
            'getVehicleDetails',
            { vehicleName: vehicleRef, vehicleId: namedVehicle.id },
            supabase,
            userId,
            teamId,
          );
          return {
            ...(detail as Record<string, unknown>),
            question: asked,
            routed_to: 'getVehicleDetails',
          } as ToolResult;
        }

        // A question that names one of the team's own customers is about that
        // customer.
        const namedCustomer = await detectAskFleetCustomer(supabase, teamId, asked);
        if (namedCustomer) {
          console.log(`[ask_fleet] "${asked}" -> getCustomerProfile (${namedCustomer})`);
          const profile = await executeFunction(
            'getCustomerProfile',
            { customerName: namedCustomer },
            supabase,
            userId,
            teamId,
          );
          return {
            ...(profile as Record<string, unknown>),
            question: asked,
            routed_to: 'getCustomerProfile',
          } as ToolResult;
        }



        const routedTool = detectAskFleetTool(asked);
        const routedTimeframe = timeframe || detectAskFleetTimeframe(asked);
        const routedLocation = location || (await detectAskFleetLocation(supabase, teamId, asked));

        const routedArgs: Record<string, unknown> = {};
        if (routedTimeframe && routedTimeframe !== 'all') routedArgs.timeframe = routedTimeframe;
        if (routedTimeframe === 'all') routedArgs.timeframe = 'all';
        if (routedLocation) routedArgs.location = routedLocation;

        console.log(`[ask_fleet] "${asked}" -> ${routedTool}`, routedArgs);

        const result = await executeFunction(routedTool, routedArgs, supabase, userId, teamId);
        return {
          ...(result as Record<string, unknown>),
          question: asked,
          routed_to: routedTool,
        } as ToolResult;
      }

      case "get_fleet_vehicles": {
        const { status, location, limit } = args as { status?: string; location?: string; limit?: number };
        const maxVehicles = toLimit(limit, 100);
        console.log(`[get_fleet_vehicles] Querying vehicles for team ${teamId}, status: ${status || 'all'}, location: ${location || 'all'}`);
        
        let query = supabase
          .from('vehicles')
          .select('*');
        
        // Filter by team_id
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        
        if (location && location !== 'all') {
          query = query.ilike('location', `%${location}%`);
        }

        const { data: vehicles, error } = await query.order('created_at', { ascending: false }).limit(maxVehicles);
        
        if (error) {
          console.error('[get_fleet_vehicles] Database error:', error);
          return {
            error: 'Failed to fetch vehicles',
            summary: 'I encountered an error retrieving your vehicle data. Please try again.'
          };
        }
        
        console.log(`[get_fleet_vehicles] Found ${vehicles?.length || 0} vehicles`);
        
        const vehicleData = (vehicles || []) as Vehicle[];
        
        if (vehicleData.length === 0) {
          return {
            count: 0,
            vehicles: [],
            summary: `You don't have any vehicles${location ? ` in ${location}` : ''}${status && status !== 'all' ? ` that are ${status}` : ''}.`
          };
        }
        
        const truth = await fleetTruth(supabase, teamId, location);
        const vehicleList = vehicleData.map((v: Vehicle) => ({
          name: vehicleDisplayName(v),
          status: v.status,
          location: v.location || 'Unassigned',
          rate: `$${v.daily_rate || v.current_rate} per day`,
          utilization: utilizationWords(truth, v.id),
          revenue: earnedWords(truth, v.id),
        }));

        // Group by location for summary
        const locationGroups = vehicleData.reduce((acc: Record<string, number>, v: Vehicle) => {
          const loc = v.location || 'Unassigned';
          acc[loc] = (acc[loc] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const locationSummary = Object.entries(locationGroups)
          .map(([loc, count]) => `${count} in ${loc}`)
          .join(', ');

        return {
          count: vehicles.length,
          vehicles: vehicleList,
          byLocation: locationGroups,
          summary: `You have ${vehicles.length} vehicles${location ? ` in ${location}` : ` (${locationSummary})`}${status && status !== 'all' ? ` that are ${status}` : ''}. Top vehicles: ${vehicleList.slice(0, 3).map(v => v.name).join(', ')}.`
        };
      }

      case "get_bookings": {
        const { status, start_date, end_date, location, date, timeframe, limit } = args;
        const maxBookings = toLimit(limit, 30);
        console.log(`[get_bookings] Team: ${teamId}, Status: ${status || 'all'}, Date: ${date || 'n/a'}, Range: ${start_date || '-'}..${end_date || '-'}, Location: ${location || 'all'}`);

        // --- Status synonyms ---------------------------------------------------
        // The app uses canonical statuses: confirmed, pending, completed, cancelled.
        // Rari (and humans) commonly say "active", "current", "rented", "out", "upcoming".
        // Translate those to a set of canonical statuses + an implicit time window.
        const STATUS_SYNONYMS: Record<string, { statuses: string[]; window?: 'today' | 'future' }> = {
          active:       { statuses: ['confirmed', 'pending'], window: 'today' },
          current:      { statuses: ['confirmed', 'pending'], window: 'today' },
          rented:       { statuses: ['confirmed'],            window: 'today' },
          out:          { statuses: ['confirmed'],            window: 'today' },
          in_progress:  { statuses: ['confirmed'],            window: 'today' },
          upcoming:     { statuses: ['confirmed', 'pending'], window: 'future' },
        };

        const rawStatus = typeof status === 'string' ? status.toLowerCase().trim() : '';
        const synonym = STATUS_SYNONYMS[rawStatus];
        const resolvedStatuses: string[] | null = synonym
          ? synonym.statuses
          : (rawStatus && rawStatus !== 'all' ? [rawStatus] : null);

        // --- Date window resolution -------------------------------------------
        // `date` keyword takes precedence over explicit start/end; both produce
        // an OVERLAP filter (start <= window_end AND end >= window_start).
        const todayKey = dayKey(Date.now(), tz);
        const tomorrowKey = addDays(todayKey, 1);
        const todayB = localDayBounds(todayKey, tz);
        const todayStart = new Date(todayB.start);
        const todayEnd = new Date(todayB.end);
        let windowStart: Date | null = null;
        let windowEnd: Date | null = null;
        let windowLabel: string | null = null;

        const keyword = (typeof date === 'string' ? date.toLowerCase().trim() : '')
          || (synonym?.window === 'today' ? 'today' : '')
          || (synonym?.window === 'future' ? 'upcoming' : '');

        if (keyword === 'today') {
          windowStart = todayStart; windowEnd = todayEnd;
          windowLabel = `today (${todayKey})`;
        } else if (keyword === 'tomorrow') {
          const tb = localDayBounds(tomorrowKey, tz);
          windowStart = new Date(tb.start);
          windowEnd   = new Date(tb.end);
          windowLabel = `tomorrow (${tomorrowKey})`;
        } else if (keyword === 'this_week' || keyword === 'week') {
          windowStart = todayStart;
          windowEnd   = new Date(localDayBounds(addDays(todayKey, 6), tz).end);
          windowLabel = `this week (${todayKey} → ${addDays(todayKey, 6)})`;
        } else if (keyword === 'upcoming' || keyword === 'future') {
          windowStart = todayStart; windowEnd = null;
          windowLabel = `upcoming (from ${todayKey})`;
        } else if (start_date || end_date) {
          windowStart = start_date ? new Date(start_date) : null;
          windowEnd   = end_date   ? new Date(end_date)   : null;
          windowLabel = `${start_date || '…'} → ${end_date || '…'}`;
        } else if (timeframe && timeframe !== 'all') {
          // Registry param: today | week | month | year. Same overlap semantics.
          const tf = resolveTimeframeWindow(String(timeframe), tz);
          windowStart = tf.start ? new Date(tf.start) : null;
          windowEnd   = new Date(tf.end);
          windowLabel = tf.label;
        }

        // --- Build query -------------------------------------------------------
        let query = supabase
          .from('bookings')
          .select('*, vehicles(name, make, model, year, location), customers(full_name, email)');

        if (teamId) query = query.eq('team_id', teamId);

        if (resolvedStatuses && resolvedStatuses.length === 1) {
          query = query.eq('status', resolvedStatuses[0]);
        } else if (resolvedStatuses && resolvedStatuses.length > 1) {
          query = query.in('status', resolvedStatuses);
        }

        // OVERLAP semantics: booking is in-window if start <= window_end AND end >= window_start
        if (windowEnd)   query = query.lte('start_date', windowEnd.toISOString());
        if (windowStart) query = query.gte('end_date',   windowStart.toISOString());

        const { data: bookings, error } = await query
          .order('start_date', { ascending: false })
          .limit(maxBookings);

        if (error) {
          console.error('[get_bookings] Database error:', error);
          return {
            error: 'Failed to fetch bookings',
            summary: 'I encountered an error retrieving your booking data.'
          };
        }

        let filteredBookings = bookings || [];
        if (location && location !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) =>
            b.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }

        const interpretation = [
          windowLabel ? `window=${windowLabel}` : 'no time filter',
          resolvedStatuses ? `status∈[${resolvedStatuses.join(',')}]` : 'any status',
          location && location !== 'all' ? `location~${location}` : null,
        ].filter(Boolean).join(' · ');

        console.log(`[get_bookings] Found ${filteredBookings.length} bookings (${interpretation})`);

        const baseMeta = {
          queried_status: status ?? null,
          resolved_statuses: resolvedStatuses,
          date_window: windowLabel,
          today_iso: todayStart.toISOString().slice(0, 10),
          interpretation,
        };

        if (filteredBookings.length === 0) {
          return {
            ...baseMeta,
            count: 0,
            bookings: [],
            totalRevenue: '$0',
            summary: `No bookings match ${interpretation}. (Canonical statuses in this system are confirmed, pending, completed, cancelled — there is no live "active" status; use date='today' for what's out right now.)`
          };
        }

        const bookingList = filteredBookings.map(b => {
          const vehicleName = b.vehicles ? vehicleDisplayName(b.vehicles) : 'Unknown vehicle';
          const customerName = b.customers?.full_name || b.customer_name || 'Unknown';
          const totalAmount = Number(b.total_value || b.total_amount || 0);
          return {
            customer: customerName,
            vehicle: vehicleName,
            location: b.vehicles?.location || 'Unassigned',
            dates: formatDateRange(b.start_date, b.end_date, tz),
            status: b.status,
            total: formatUsdWords(totalAmount),
            totalRaw: totalAmount,
            payment: b.payment_status
          };
        });

        const totalRevenue = filteredBookings.reduce((sum, b) => sum + Number(b.total_value || b.total_amount || 0), 0);

        return {
          ...baseMeta,
          count: filteredBookings.length,
          bookings: bookingList,
          totalRevenue: formatUsdWords(totalRevenue),
          totalRevenueRaw: totalRevenue,
          summary: `You have ${filteredBookings.length} bookings (${interpretation}). Total value: ${formatUsdWords(totalRevenue)}.`
        };
      }

      case "get_recent_activity": {
        const { limit = 10, activity_type } = args;
        
        let query = supabase
          .from('bookings')
          .select('*, vehicles(name, make, model, year, location), customers(full_name)');
        
        // Filter by team_id
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        const { data: recentBookings } = await query
          .order('created_at', { ascending: false })
          .limit(limit);

        const activities = recentBookings?.map((b: any) => {
          const timeAgo = getTimeAgo(new Date(b.created_at));
          const vehicleName = b.vehicles ? vehicleDisplayName(b.vehicles) : 'a vehicle';
          const customerName = b.customers?.full_name || b.customer_name || 'A customer';
          const amountVal = Number(b.total_value || b.total_amount || 0);
          
          return {
            description: `${customerName} booked ${vehicleName} for ${formatUsdWords(amountVal)}`,
            location: b.vehicles?.location || 'Unassigned',
            timeAgo,
            status: b.status,
            amount: formatUsdWords(amountVal),
            amountRaw: amountVal
          };
        }) || [];

        return {
          count: activities.length,
          activities,
          summary: `Recent activity: ${activities.slice(0, 3).map(a => a.description).join('. ')}`
        };
      }

      case "getFleetMetrics": {
        const { timeframe, location } = args;
        console.log(`[getFleetMetrics] Team: ${teamId}, Timeframe: ${timeframe}, Location: ${location || 'all'}`);
        
        const window = resolveTimeframeWindow(timeframe, tz);

        // Get vehicles with optional location filter
        let vehicleQuery = supabase.from('vehicles').select('*');
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        if (location && location !== 'all') {
          vehicleQuery = vehicleQuery.ilike('location', `%${location}%`);
        }
        
        // Get bookings with team filter
        let bookingsQuery = supabase.from('bookings').select('*, vehicles(location)');
        if (teamId) {
          bookingsQuery = bookingsQuery.eq('team_id', teamId);
        }
        bookingsQuery = applyRentalWindow(bookingsQuery, window);
        
        // Get revenue bookings with team filter
        let revenueQuery = supabase.from('bookings').select('total_value, vehicles(location)');
        if (teamId) {
          revenueQuery = revenueQuery.eq('team_id', teamId);
        }
        revenueQuery = applyRentalWindow(revenueQuery.eq('status', 'completed'), window);
        
        const [vehiclesResult, bookingsResult, revenueResult] = await Promise.all([
          vehicleQuery,
          bookingsQuery,
          revenueQuery
        ]);

        const vehicles = vehiclesResult.data || [];
        let bookings = bookingsResult.data || [];
        let revenue = revenueResult.data || [];
        
        // Filter bookings by location if specified
        if (location && location !== 'all') {
          bookings = bookings.filter((b: any) => b.vehicles?.location?.toLowerCase().includes(location.toLowerCase()));
          revenue = revenue.filter((b: any) => b.vehicles?.location?.toLowerCase().includes(location.toLowerCase()));
        }

        const totalRevenue = revenue.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
        const activeBookings = bookings.filter((b: any) => b.status === 'active' || b.status === 'confirmed').length;
        const truth = await fleetTruth(supabase, teamId, location);
        const utilPct = truth ? sharePct(truth.facts.fleet.trailing30) : null;

        console.log(`[getFleetMetrics] Results - Vehicles: ${vehicles.length}, Active Bookings: ${activeBookings}, Revenue: $${totalRevenue}`);

        return {
          totalVehicles: vehicles.length,
          activeBookings,
          totalBookings: bookings.length,
          revenue: formatUsdWords(totalRevenue),
          revenueRaw: totalRevenue,
          averageUtilization: pctLabel(utilPct),
          utilizationPeriod: 'last 30 days',
          howUtilizationIsMeasured: truth ? methodNote(truth) : null,
          location: location || 'all',
          timeframe,
          summary: `${location ? `${location} fleet` : 'Your fleet'} has ${vehicles.length} vehicles with ${activeBookings} active bookings and ${formatUsdWords(totalRevenue)} in revenue for the ${timeframe || 'period'}.${utilPct != null ? ` Utilization over the last 30 days is ${utilPct}%.` : ''}`
        };
      }

      case "getLocationMetrics": {
        const { location, timeframe } = args;
        const locWindow = resolveTimeframeWindow(typeof timeframe === 'string' ? timeframe : undefined, tz);
        console.log(`[getLocationMetrics] Team: ${teamId}, Location: ${location || 'all'}, Timeframe: ${locWindow.label}`);
        
        // Get all vehicles
        let vehicleQuery = supabase
          .from('vehicles')
          .select('*');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: allVehicles } = await vehicleQuery;
        
        if (!allVehicles || allVehicles.length === 0) {
          return {
            summary: "You don't have any vehicles in your fleet yet."
          };
        }
        
        // Group by location. Utilization is measured from bookings (booked days / available days, last 30 days).
        const truth = await fleetTruth(supabase, teamId, null);
        const locationStats: Record<string, any> = {};

        for (const vehicle of allVehicles) {
          const loc = vehicle.location || 'Unassigned';
          if (!locationStats[loc]) {
            locationStats[loc] = {
              location: loc,
              vehicleCount: 0,
              totalRevenue: 0,
              booked: 0,
              available: 0,
              avgRate: 0,
              vehicles: []
            };
          }
          const f = truth?.byId.get(vehicle.id);
          locationStats[loc].vehicleCount++;
          locationStats[loc].avgRate += Number(vehicle.current_rate || vehicle.daily_rate || 0);
          if (f && !f.outOfService) {
            locationStats[loc].booked += f.trailing30.booked;
            locationStats[loc].available += f.trailing30.available;
          }
          locationStats[loc].vehicles.push({
            name: vehicleDisplayName(vehicle),
            status: vehicle.status,
            utilization: pctLabel(sharePct(f?.trailing30)),
            rate: vehicle.current_rate || vehicle.daily_rate
          });
        }

        // Calculate averages
        for (const loc of Object.keys(locationStats)) {
          const stats = locationStats[loc];
          stats.avgUtilization = stats.available > 0 ? Math.round((stats.booked / stats.available) * 100) : null;
          stats.avgRate = stats.avgRate / stats.vehicleCount;
        }
        
        // Get bookings by location
        let bookingsQuery = supabase
          .from('bookings')
          .select('*, vehicles(location)');
        
        if (teamId) {
          bookingsQuery = bookingsQuery.eq('team_id', teamId);
        }
        
        const { data: bookings } = await bookingsQuery.in('status', ['active', 'confirmed', 'pending']);
        
        for (const booking of (bookings || [])) {
          const loc = booking.vehicles?.location || 'Unassigned';
          if (locationStats[loc]) {
            locationStats[loc].activeBookings = (locationStats[loc].activeBookings || 0) + 1;
          }
        }

        // Revenue per location from the tenant's bookings (counted statuses) inside the asked window; the stored
        // `vehicles.revenue` column is not maintained, so it is never used.
        const locRevenue = await bookedRevenueByVehicle(supabase, teamId, locWindow);
        for (const vehicle of allVehicles) {
          const r = locRevenue.byVehicle.get(vehicle.id);
          if (r) locationStats[vehicle.location || 'Unassigned'].totalRevenue += r.revenue;
        }

        // If specific location requested
        if (location && location !== 'all') {
          const matchingLoc = Object.keys(locationStats).find(l => l.toLowerCase().includes(location.toLowerCase()));
          if (matchingLoc && locationStats[matchingLoc]) {
            const stats = locationStats[matchingLoc];
            return {
              location: stats.location,
              vehicleCount: stats.vehicleCount,
              totalRevenue: formatUsdWords(stats.totalRevenue),
              totalRevenueRaw: stats.totalRevenue,
              avgUtilization: pctLabel(stats.avgUtilization),
              utilizationPeriod: 'last 30 days',
              avgRate: `$${stats.avgRate.toFixed(0)}`,
              activeBookings: stats.activeBookings || 0,
              topVehicles: stats.vehicles.slice(0, 5),
              timeframe: locWindow.label,
              summary: `${stats.location} has ${carsWord(stats.vehicleCount)} with ${formatUsdWords(stats.totalRevenue)} revenue for ${locWindow.label}, ${stats.avgUtilization == null ? 'not enough data to measure utilization' : `${stats.avgUtilization}% utilization over the last 30 days`}, and ${stats.activeBookings || 0} active bookings.`
            };
          }
        }
        
        // Return all locations
        const locations = Object.values(locationStats);
        return {
          timeframe: locWindow.label,
          locationCount: locations.length,
          locations: locations.map((l: any) => ({
            location: l.location,
            vehicleCount: l.vehicleCount,
            totalRevenue: formatUsdWords(l.totalRevenue),
            totalRevenueRaw: l.totalRevenue,
            avgUtilization: pctLabel(l.avgUtilization),
            avgRate: `$${l.avgRate.toFixed(0)}`,
            activeBookings: l.activeBookings || 0
          })),
          summary: `Your fleet spans ${locations.length} location${locations.length > 1 ? 's' : ''}: ${locations.map((l: any) => `${l.location} (${carsWord(l.vehicleCount)}, ${formatUsdWords(l.totalRevenue)} revenue)`).join('; ')}.`
        };
      }

      case "getPaymentSummary": {
        const { status, timeframe, location } = args;
        console.log(`[getPaymentSummary] Team: ${teamId}, Status: ${status || 'all'}, Timeframe: ${timeframe || 'all'}, Location: ${location || 'all'}`);
        
        // Payments are events, not rentals: created_at IS the correct axis here.
        const window = resolveTimeframeWindow(timeframe, tz);
        
        // Get payments with team filter
        let paymentsQuery = supabase
          .from('payments')
          .select('*, bookings(vehicles(location))');
        
        if (teamId) {
          paymentsQuery = paymentsQuery.eq('team_id', teamId);
        }
        
        if (window.start) paymentsQuery = paymentsQuery.gte('created_at', window.start);
        const { data: payments, error } = await paymentsQuery
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('[getPaymentSummary] Database error:', error);
          return { error: 'Failed to fetch payments', summary: 'I encountered an error retrieving payment data.' };
        }
        
        let filteredPayments = payments || [];
        
        // Filter by location if specified
        if (location && location !== 'all') {
          filteredPayments = filteredPayments.filter((p: any) => 
            p.bookings?.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        // Filter by status
        if (status && status !== 'all') {
          filteredPayments = filteredPayments.filter((p: any) => p.payment_status === status);
        }
        
        // Calculate summaries
        const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const completedPayments = filteredPayments.filter(p => p.payment_status === 'completed');
        const pendingPayments = filteredPayments.filter(p => p.payment_status === 'pending');
        
        const completedAmount = completedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const pendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        
        const byMethod = filteredPayments.reduce((acc, p) => {
          const m = p.payment_method || 'unknown';
          acc[m] = (acc[m] || 0) + Number(p.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        
        return {
          totalPayments: filteredPayments.length,
          totalAmount: `$${totalAmount.toFixed(0)}`,
          completedAmount: `$${completedAmount.toFixed(0)}`,
          pendingAmount: `$${pendingAmount.toFixed(0)}`,
          completedCount: completedPayments.length,
          pendingCount: pendingPayments.length,
          byMethod: Object.entries(byMethod).map(([m, a]) => ({ method: m, amount: `$${a.toFixed(0)}` })),
          timeframe: timeframe || 'all time',
          location: location || 'all',
          summary: `${timeframe ? `This ${timeframe}` : 'Total'} payments${location ? ` in ${location}` : ''}: $${totalAmount.toFixed(0)} across ${filteredPayments.length} transactions. Completed: $${completedAmount.toFixed(0)}, Pending: $${pendingAmount.toFixed(0)}.`
        };
      }

      case "getVehicleDetails": {
        const { vehicleName, vehicleId } = args as { vehicleName?: string; vehicleId?: string };

        let vehicle: any = null;
        if (vehicleId) {
          let byId = supabase.from('vehicles').select('*').eq('id', vehicleId);
          if (teamId) byId = byId.eq('team_id', teamId);
          const { data } = await byId.maybeSingle();
          vehicle = data || null;
        }
        // Token-based match so "Ferrari 488 Spider" (make + model split across
        // two columns) resolves — a single whole-phrase ILIKE never can.
        if (!vehicle) {
          vehicle = await findTeamVehicleByTokens(supabase, teamId, String(vehicleName || ''));
        }

        if (!vehicle) return { 
          error: "Vehicle not found",
          summary: `I couldn't find a vehicle matching "${vehicleName}" in your fleet.`
        };

        const fullName = vehicleDisplayName(vehicle);
        const truth = await fleetTruth(supabase, teamId, null);
        const rec = truth ? recommendationFor(truth, vehicle.id) : null;
        const utilText = utilizationWords(truth, vehicle.id);
        // Bookings are ALWAYS included: this used to hang off an `includeBookings`
        // flag the registry never sends, so Rari reported "no bookings" on
        // vehicles that were booked.
        const bookingsData = await getVehicleBookingWindow(supabase, vehicle.id, teamId, tz);
        const nextBooking = bookingsData.find((b) => b.timing === 'current')
          || bookingsData.find((b) => b.timing === 'upcoming');

        const bookingSentence = nextBooking
          ? ` ${nextBooking.timing === 'current' ? 'On rent now' : 'Next booking'}: ${nextBooking.customer}, ${nextBooking.dates} (${nextBooking.status}).`
          : ' No current or upcoming bookings.';

        return { 
          vehicle: {
            name: fullName,
            status: vehicle.status,
            location: vehicle.location || 'Unassigned',
            rate: `$${vehicle.current_rate || vehicle.daily_rate} per day`,
            suggestedRate: rec && rec.action !== 'hold' ? `$${rec.recommendedRate}` : null,
            rateAdvice: rec ? rec.speakable : null,
            utilization: utilText,
            revenue: earnedWords(truth, vehicle.id),
            licensePlate: vehicle.license_plate,
            vin: vehicle.vin,
            bookings: bookingsData,
          },
          bookings: bookingsData,
          bookingCount: bookingsData.length,
          nextBooking: nextBooking || null,
          summary: `${fullName} in ${vehicle.location || 'Unassigned'} is currently ${vehicle.status}, priced at $${vehicle.current_rate || vehicle.daily_rate} per day, ${utilText}.${bookingSentence}`
        };
      }

      case "getCustomerProfile": {
        const { customerName, includeHistory } = args;
        
        let customerQuery = supabase
          .from('customers')
          .select('*');
        
        if (teamId) {
          customerQuery = customerQuery.eq('team_id', teamId);
        }
        
        const { data: customers } = await customerQuery
          .or(`full_name.ilike.%${customerName}%,email.ilike.%${customerName}%`)
          .limit(1);
        
        const customer = customers?.[0];

        if (!customer) return { 
          error: "Customer not found",
          summary: `I couldn't find a customer matching "${customerName}".`
        };

        const fullName = customer.full_name;
        
        let bookingsData = null;
        let totalBookings = customer.total_bookings || 0;
        let lifetimeValue = customer.lifetime_value || 0;
        
        if (includeHistory) {
          const { data: bookings } = await supabase
            .from('bookings')
            .select('*, vehicles(make, model, year, location)')
            .eq('customer_id', customer.id)
            .order('start_date', { ascending: false })
            .limit(10);
          
          if (bookings) {
            totalBookings = bookings.length;
            lifetimeValue = bookings.reduce((sum, b) => sum + Number(b.total_value || b.total_amount || 0), 0);
            
            bookingsData = bookings.map(b => ({
              vehicle: b.vehicles ? vehicleDisplayName(b.vehicles) : 'Unknown',
              location: b.vehicles?.location || 'Unassigned',
              dates: `${fmtDay(b.start_date, tz)} to ${fmtDay(b.end_date, tz)}`,
              status: b.status,
              total: `$${Number(b.total_value || b.total_amount || 0).toFixed(0)}`
            }));
          }
        }

        return { 
          customer: {
            name: fullName,
            email: customer.email,
            phone: customer.phone,
            status: customer.customer_status,
            totalBookings,
            lifetimeValue: `$${lifetimeValue.toFixed(0)}`
          },
          bookings: bookingsData,
          summary: `${fullName} is a ${customer.customer_status || 'regular'} customer with ${totalBookings} bookings and $${lifetimeValue.toFixed(0)} lifetime value.`
        };
      }

      case "checkAvailability": {
        const { vehicleName, startDate, endDate, location } = args;
        
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, year, status, location, current_rate');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        if (vehicleName) {
          vehicleQuery = vehicleQuery.or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`);
        }
        if (location) {
          vehicleQuery = vehicleQuery.ilike('location', `%${location}%`);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (!vehicles || vehicles.length === 0) {
          return { 
            error: "No vehicles found",
            summary: `I couldn't find any vehicles matching your criteria.`
          };
        }
        
        const availabilityResults = [];
        for (const vehicle of vehicles) {
          const { data: conflicts } = await supabase
            .from('bookings')
            .select('id, start_date, end_date, customer_name')
            .eq('vehicle_id', vehicle.id)
            .in('status', ['active', 'confirmed', 'pending'])
            .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);
          
          availabilityResults.push({
            vehicle: vehicleDisplayName(vehicle),
            location: vehicle.location,
            rate: `$${vehicle.current_rate}`,
            available: !conflicts || conflicts.length === 0,
            conflicts: conflicts?.map(c => ({
              dates: `${fmtDay(c.start_date, tz)} to ${fmtDay(c.end_date, tz)}`,
              customer: c.customer_name
            })) || []
          });
        }
        
        const available = availabilityResults.filter(r => r.available);
        const unavailable = availabilityResults.filter(r => !r.available);
        
        return {
          requestedDates: `${startDate} to ${endDate}`,
          availableVehicles: available,
          unavailableVehicles: unavailable,
          summary: available.length > 0 
            ? `${available.length} vehicle${available.length > 1 ? 's are' : ' is'} available for ${startDate} to ${endDate}: ${available.map(v => v.vehicle).join(', ')}.`
            : `Unfortunately, no matching vehicles are available for those dates. ${unavailable.length} vehicle${unavailable.length > 1 ? 's have' : ' has'} conflicts.`
        };
      }

      case "getRevenueAnalysis": {
        const { timeframe, vehicleName, location } = args;
        const window = resolveTimeframeWindow(timeframe, tz);

        let query = supabase
          .from('bookings')
          .select('*, vehicles(make, model, year, location)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        const { data: bookings } = await applyRentalWindow(query.eq('status', 'completed'), window);
        
        let filteredBookings = bookings || [];
        
        if (location && location !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        if (vehicleName) {
          filteredBookings = filteredBookings.filter((b: any) => {
            const name = `${b.vehicles?.make} ${b.vehicles?.model}`.toLowerCase();
            return name.includes(vehicleName.toLowerCase());
          });
        }
        
        const totalRevenue = filteredBookings.reduce((sum: number, b: any) => sum + Number(b.total_value || b.total_amount || 0), 0);
        const avgDailyRate = filteredBookings.length > 0 
          ? filteredBookings.reduce((sum: number, b: any) => sum + Number(b.daily_rate || 0), 0) / filteredBookings.length 
          : 0;

        return { 
          totalRevenue: formatUsdWords(totalRevenue),
          totalRevenueRaw: totalRevenue,
          bookingCount: filteredBookings.length,
          avgDailyRate: `$${avgDailyRate.toFixed(0)}`,
          timeframe,
          location: location || 'all',
          summary: `${timeframe ? `This ${timeframe}` : 'Total'} revenue${location ? ` from ${location}` : ''}: ${formatUsdWords(totalRevenue)} across ${filteredBookings.length} completed bookings with an average daily rate of $${avgDailyRate.toFixed(0)}.`
        };
      }

      case "getTopPerformers": {
        const { metric, limit: rawLimit, location, timeframe } = args;
        const limit = toLimit(rawLimit, 5, 25);
        const topWindow = resolveTimeframeWindow(typeof timeframe === 'string' ? timeframe : undefined, tz);
        
        if (metric === 'revenue' || metric === 'utilization') {
          const topTruth = await fleetTruth(supabase, teamId, location);
          // Revenue is ranked from the tenant's bookings (the stored `vehicles.revenue` is not maintained);
          // utilization is measured over the last 30 days.
          if (metric === 'revenue' && topWindow.start) {
            let bq = supabase
              .from('bookings')
              .select('total_value, vehicle_id, vehicles(name, make, model, year, location)')
              .gte('start_date', topWindow.start)
              .lte('start_date', topWindow.end)
              .in('status', COUNTED_STATUSES);
            if (teamId) bq = bq.eq('team_id', teamId);
            const { data: windowBookings } = await bq;

            const byVehicle = new Map<string, { v: any; revenue: number; bookings: number }>();
            for (const b of (windowBookings || []) as any[]) {
              const veh = b.vehicles;
              if (!veh) continue;
              if (location && location !== 'all' && !String(veh.location || '').toLowerCase().includes(String(location).toLowerCase())) continue;
              const key = b.vehicle_id;
              const entry = byVehicle.get(key) || { v: veh, revenue: 0, bookings: 0 };
              entry.revenue += Number(b.total_value || 0);
              entry.bookings += 1;
              byVehicle.set(key, entry);
            }

            const performers = [...byVehicle.entries()]
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .slice(0, limit)
              .map(([vid, e]) => ({
                name: vehicleDisplayName(e.v),
                location: e.v.location,
                revenue: formatUsdWords(e.revenue),
                revenueRaw: e.revenue,
                bookings: e.bookings,
                utilization: pctLabel(sharePct(topTruth?.byId.get(vid)?.trailing30)),
              }));

            return {
              metric,
              timeframe: topWindow.label,
              performers,
              summary: performers.length
                ? `Top ${performers.length} vehicles by revenue for ${topWindow.label}${location ? ` in ${location}` : ''}: ${performers.map(p => `${p.name} (${p.revenue})`).join(', ')}.`
                : `No booking revenue recorded for ${topWindow.label}${location ? ` in ${location}` : ''}.`,
            };
          }

          if (!topTruth) {
            return { metric, performers: [], summary: "I can't measure vehicle performance right now." };
          }

          let performers: any[];
          if (metric === 'utilization') {
            performers = rankByUtilization(topTruth)
              .filter((f) => f.trailing30.share != null)
              .slice(0, limit)
              .map((f) => ({
                name: vehicleDisplayName(topTruth.rows.get(f.id) || f),
                location: topTruth.rows.get(f.id)?.location,
                utilization: pctLabel(sharePct(f.trailing30)),
                earnedLast30: f.earnedLast30 != null ? formatUsdWords(f.earnedLast30) : null,
              }));
          } else {
            const all = await bookedRevenueByVehicle(supabase, teamId, undefined);
            performers = [...topTruth.rows.values()]
              .map((r) => ({ r, rev: all.byVehicle.get(r.id)?.revenue ?? 0 }))
              .filter((x) => x.rev > 0)
              .sort((a, b) => b.rev - a.rev)
              .slice(0, limit)
              .map((x) => ({
                name: vehicleDisplayName(x.r),
                location: x.r.location,
                revenue: formatUsdWords(x.rev),
                revenueRaw: x.rev,
                utilization: pctLabel(sharePct(topTruth.byId.get(x.r.id)?.trailing30)),
              }));
          }

          return {
            metric,
            timeframe: metric === 'utilization' ? 'last 30 days' : 'all time',
            performers,
            summary: performers.length
              ? `Top ${performers.length} vehicles by ${metric}${location ? ` in ${location}` : ''}: ${performers.map((p: any) => `${p.name} (${metric === 'revenue' ? p.revenue : p.utilization})`).join(', ')}.`
              : `I don't have enough booking history to rank vehicles by ${metric}${location ? ` in ${location}` : ''}.`
          };
        } else {

          // Top customers
          let query = supabase
            .from('customers')
            .select('full_name, total_bookings, lifetime_value');
          
          if (teamId) {
            query = query.eq('team_id', teamId);
          }
          
          const { data: customers } = await query
            .order('lifetime_value', { ascending: false })
            .limit(limit);
          
          const performers = customers?.map(c => {
            const ltv = Number(c.lifetime_value || 0);
            return {
              name: c.full_name,
              bookings: c.total_bookings || 0,
              lifetimeValue: formatUsdWords(ltv),
              lifetimeValueRaw: ltv
            };
          }) || [];
          
          return { 
            metric: 'customers', 
            performers,
            summary: `Top ${performers.length} customers by lifetime value: ${performers.map(p => `${p.name} (${p.lifetimeValue})`).join(', ')}.`
          };
        }
      }

      case "searchBookings": {
        const { status, daysRange, location, query: searchText, limit } = args;
        const maxRows = toLimit(limit, 30);
        const term = typeof searchText === 'string' ? searchText.trim() : '';

        const tokens = searchTokens(term);

        const applyFilters = (q: any) => {
          if (teamId) q = q.eq('team_id', teamId);
          if (status) q = q.eq('status', status);
          if (daysRange) {
            const dateFilter = new Date();
            dateFilter.setDate(dateFilter.getDate() - daysRange);
            q = q.gte('start_date', dateFilter.toISOString());
          }
          return q;
        };

        const select = '*, vehicles(make, model, year, location, name), customers(full_name)';

        // Pass 1: booking-row columns. Pass 2: rows joined to a vehicle, so a
        // multi-word phrase like "Ferrari 488 Spider" (make + model split across
        // columns) can be matched token-by-token in code. Both passes ALWAYS
        // run — the join pass used to fire only when pass 1 returned nothing.
        const passes: any[] = [
          applyFilters(supabase.from('bookings').select(select))
            .order('start_date', { ascending: false })
            .limit(tokens.length ? 500 : maxRows),
        ];
        if (tokens.length) {
          passes.push(
            applyFilters(
              supabase
                .from('bookings')
                .select('*, vehicles!inner(make, model, year, location, name), customers(full_name)'),
            )
              .order('start_date', { ascending: false })
              .limit(500),
          );
        }

        const results = await Promise.all(passes);
        const byId = new Map<string, any>();
        for (const res of results) {
          for (const row of res?.data || []) {
            if (!byId.has(row.id)) byId.set(row.id, row);
          }
        }
        let filteredBookings = [...byId.values()];

        if (tokens.length) {
          filteredBookings = filteredBookings.filter((b: any) =>
            matchesAllTokens(tokens, [
              b.booking_ref,
              b.customer_name,
              b.customer_email,
              b.vehicle_name,
              b.customers?.full_name,
              b.vehicles?.make,
              b.vehicles?.model,
              b.vehicles?.year,
              b.vehicles?.name,
            ]),
          );
        }

        filteredBookings.sort(
          (a: any, b: any) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
        );

        if (location && location !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }

        filteredBookings = filteredBookings.slice(0, maxRows);

        
        const bookingList = filteredBookings.map(b => {
          const vehicleName = b.vehicles ? vehicleDisplayName(b.vehicles) : (b.vehicle_name || 'vehicle');
          const amt = Number(b.total_value || b.total_amount || 0);
          return {
            reference: b.booking_ref,
            customer: b.customers?.full_name || b.customer_name || 'Unknown',
            vehicle: vehicleName,
            location: b.vehicles?.location || 'Unassigned',
            dates: formatDateRange(b.start_date, b.end_date, tz),
            status: b.status,
            total: formatUsdWords(amt),
            totalRaw: amt
          };
        });

        const totalValue = filteredBookings.reduce((sum, b) => sum + Number(b.total_value || b.total_amount || 0), 0);

        return { 
          count: filteredBookings.length,
          bookings: bookingList,
          totalValue: formatUsdWords(totalValue),
          totalValueRaw: totalValue,
          summary: `Found ${filteredBookings.length} bookings${term ? ` matching "${term}"` : ''}${status ? ` with ${status} status` : ''}${location ? ` in ${location}` : ''}${daysRange ? ` in the last ${daysRange} days` : ''}. Total value: ${formatUsdWords(totalValue)}.`
        };
      }



      case "getDamageReports": {
        const { status, location, limit } = args;
        const maxClaims = toLimit(limit, 25);
        let query = supabase
          .from('damage_claims')
          .select('*, vehicles(make, model, year, location)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        if (status && status !== 'all') query = query.eq('claim_status', status);

        const { data: claims } = await query.order('reported_date', { ascending: false }).limit(Math.max(maxClaims, 100));
        
        let filteredClaims = claims || [];
        if (location && location !== 'all') {
          filteredClaims = filteredClaims.filter((c: any) => 
            c.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        filteredClaims = filteredClaims.slice(0, maxClaims);

        const claimList = filteredClaims.map(c => ({
          vehicle: c.vehicles ? vehicleDisplayName(c.vehicles) : 'Unknown',
          location: c.vehicles?.location || 'Unassigned',
          severity: c.severity,
          status: c.claim_status,
          estimatedCost: c.estimated_cost ? `$${c.estimated_cost}` : 'TBD',
          reportedDate: fmtDay(c.reported_date, tz)
        }));
        
        return { 
          claims: claimList, 
          count: filteredClaims.length,
          summary: `You have ${filteredClaims.length} damage report${filteredClaims.length !== 1 ? 's' : ''}${status && status !== 'all' ? ` with ${status} status` : ''}${location ? ` in ${location}` : ''}.`
        };
      }

      case "getUpcomingMaintenance": {
        const { daysAhead = 30, location, limit } = args;
        const maxMaintenance = toLimit(limit, 25);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        let query = supabase
          .from('maintenance_schedules')
          .select('*, vehicles(make, model, year, location)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        const { data: maintenance } = await query
          .lte('scheduled_date', futureDate.toISOString())
          .gte('scheduled_date', new Date().toISOString())
          .order('scheduled_date', { ascending: true });

        let filteredMaintenance = maintenance || [];
        if (location && location !== 'all') {
          filteredMaintenance = filteredMaintenance.filter((m: any) => 
            m.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        filteredMaintenance = filteredMaintenance.slice(0, maxMaintenance);

        const maintenanceList = filteredMaintenance.map(m => ({
          vehicle: m.vehicles ? vehicleDisplayName(m.vehicles) : 'Unknown',
          location: m.vehicles?.location || 'Unassigned',
          type: m.maintenance_type,
          scheduledDate: fmtDay(m.scheduled_date, tz),
          estimatedCost: m.estimated_cost ? `$${m.estimated_cost}` : 'TBD',
          status: m.status
        }));

        return { 
          maintenance: maintenanceList, 
          count: filteredMaintenance.length,
          summary: `You have ${filteredMaintenance.length} maintenance task${filteredMaintenance.length !== 1 ? 's' : ''} scheduled in the next ${daysAhead} days${location ? ` in ${location}` : ''}.`
        };
      }

      case "getCustomerLifetimeValue": {
        const { customerName } = args as { customerName?: string };
        const asked = String(customerName || '').trim();
        if (!asked) {
          return { error: 'no_customer_reference', summary: 'Which customer would you like the lifetime value for?' };
        }

        let query = supabase
          .from('customers')
          .select('id, full_name, email, lifetime_value, total_bookings, customer_status');
        if (teamId) query = query.eq('team_id', teamId);

        const tokens = searchTokens(asked);
        const { data: rows } = await query
          .or(`full_name.ilike.%${asked}%,email.ilike.%${asked}%`)
          .order('lifetime_value', { ascending: false, nullsFirst: false })
          .limit(25);

        let candidates = (rows || []).filter((c: any) => matchesAllTokens(tokens, [c.full_name, c.email]));
        if (candidates.length === 0) candidates = rows || [];

        if (candidates.length === 0) {
          return {
            error: 'not_found',
            searched: asked,
            summary: `I couldn't find a customer matching "${asked}".`,
          };
        }

        // Prefer an exact full-name match, otherwise the highest-value match.
        const exact = candidates.find(
          (c: any) => String(c.full_name || '').toLowerCase() === asked.toLowerCase(),
        );
        const customer = exact || candidates[0];
        const others = candidates.filter((c: any) => c.id !== customer.id);

        const ltv = Number(customer.lifetime_value || 0);
        let summary = `${customer.full_name} is a ${customer.customer_status || 'regular'} customer with ${customer.total_bookings || 0} bookings and ${formatUsdWords(ltv)} lifetime value.`;
        if (!exact && others.length) {
          summary += ` ${others.length} other customer${others.length === 1 ? '' : 's'} also match "${asked}" (${others.slice(0, 3).map((c: any) => c.full_name).join(', ')}) — say the full name if you meant one of those.`;
        }

        return {
          customer: {
            name: customer.full_name,
            email: customer.email,
            status: customer.customer_status,
            totalBookings: customer.total_bookings || 0,
            lifetimeValue: formatUsdWords(ltv),
            lifetimeValueRaw: ltv,
          },
          otherMatches: others.map((c: any) => c.full_name),
          summary,
        };
      }


      case "getVaultDocuments": {
        const { category, status, vehicle, limit } = args;

        // Optional vehicle filter, resolved inside the caller's team only.
        let vehicleFilterId: string | null = null;
        let vehicleFilterName: string | null = null;
        if (vehicle && String(vehicle).trim()) {
          const resolved = await resolveTeamVehicle(supabase, teamId, String(vehicle));
          if (resolved.error === 'not_found') {
            return {
              error: 'vehicle_not_found',
              summary: `I couldn't find a vehicle matching "${vehicle}" in your fleet, so I didn't pull any documents.`,
            };
          }
          if (resolved.matches) {
            return {
              error: 'ambiguous_vehicle',
              matches: resolved.matches.map((v: any) => vehicleDisplayName(v)),
              summary: `Several vehicles match "${vehicle}": ${resolved.matches.map((v: any) => vehicleDisplayName(v)).join(', ')}. Which one?`,
            };
          }
          vehicleFilterId = resolved.vehicle.id;
          vehicleFilterName = vehicleDisplayName(resolved.vehicle);
        }

        let docsQuery = supabase
          .from('documents')
          .select('id, name, type, status, expires_at, verification_status, vehicles(make, model, year)')
          .eq('team_id', teamId)
          .order('expires_at', { ascending: true, nullsFirst: false })
          .limit(toLimit(limit, 50));

        if (category) docsQuery = docsQuery.eq('type', category);
        if (status) docsQuery = docsQuery.eq('status', status);
        if (vehicleFilterId) docsQuery = docsQuery.eq('vehicle_id', vehicleFilterId);

        const { data: docs, error: docsError } = await docsQuery;


        if (docsError) {
          console.error('[getVaultDocuments] Query failed:', docsError);
          return {
            error: 'document_lookup_failed',
            summary: `I couldn't read the document vault just now (${docsError.message}). I don't want to tell you it's empty when I simply couldn't check.`,
          };
        }

        const now = Date.now();
        const documents = (docs || []).map((d: any) => {
          const expiresAt = d.expires_at ? new Date(d.expires_at) : null;
          const daysToExpiry = expiresAt
            ? Math.round((expiresAt.getTime() - now) / 86400000)
            : null;
          const vehicle = d.vehicles
            ? vehicleDisplayName(d.vehicles)
            : null;
          return {
            name: d.name,
            category: d.type,
            status: d.status,
            verification: d.verification_status,
            vehicle,
            expires: d.expires_at ? d.expires_at.slice(0, 10) : null,
            expired: daysToExpiry !== null && daysToExpiry < 0,
            expiringSoon: daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30,
          };
        });

        const expired = documents.filter((d) => d.expired).length;
        const expiringSoon = documents.filter((d) => d.expiringSoon).length;

        let summary: string;
        if (documents.length === 0) {
          summary = category || status || vehicleFilterName
            ? `No documents match that filter${vehicleFilterName ? ` for the ${vehicleFilterName}` : ''}.`
            : `There are no documents in your vault yet.`;
        } else {
          summary = `Found ${documents.length} document${documents.length === 1 ? '' : 's'}${vehicleFilterName ? ` for the ${vehicleFilterName}` : ''}`;
          if (expired) summary += `, ${expired} expired`;
          if (expiringSoon) summary += `, ${expiringSoon} expiring within 30 days`;
          summary += '.';
        }

        console.log(`[getVaultDocuments] team ${teamId}: ${documents.length} docs (${expired} expired, ${expiringSoon} expiring)`);
        return { documents, expired, expiringSoon, vehicle: vehicleFilterName, summary };
      }


      case "getDemandForecast": {
        const { city, location, timeframe } = args;
        // Registry exposes `timeframe`; older callers pass `days`.
        const TIMEFRAME_DAYS: Record<string, number> = { today: 1, week: 7, month: 30, year: 365 };
        const days = Number(args.days) > 0
          ? Number(args.days)
          : (typeof timeframe === 'string' ? (TIMEFRAME_DAYS[timeframe] ?? 14) : 14);
        // No hardcoded default city: fall back to the tenant's own primary
        // location, and run fleet-wide when the tenant has none.
        const effectiveLocation = location || city || await getTenantDefaultLocation(supabase, teamId);
        console.log(`[getDemandForecast] Team: ${teamId}, Location: ${effectiveLocation || 'fleet-wide'}, Days: ${days}`);
        
        // Get upcoming bookings for demand context
        let bookingsQuery = supabase
          .from('bookings')
          .select('start_date, total_value, vehicles(location)');
        
        if (teamId) {
          bookingsQuery = bookingsQuery.eq('team_id', teamId);
        }
        
        const { data: bookings } = await bookingsQuery
          .gte('start_date', new Date().toISOString())
          .order('start_date', { ascending: true })
          .limit(20);
        
        let filteredBookings = bookings || [];
        if (effectiveLocation && effectiveLocation !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase().includes(effectiveLocation.toLowerCase())
          );
        }
        
        const upcomingBookings = filteredBookings.length;
        const upcomingRevenue = filteredBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
        
        return {
          location: effectiveLocation || 'all',
          forecastDays: days,
          upcomingBookings,
          upcomingRevenue: formatUsdWords(upcomingRevenue),
          upcomingRevenueRaw: upcomingRevenue,
          summary: `For ${effectiveLocation || 'your fleet'} over the next ${days} days, you have ${upcomingBookings} bookings worth ${formatUsdWords(upcomingRevenue)} coming up.`
        };
      }

      case "getPricingRecommendation": {
        const { vehicleName, location } = args;
        console.log(`[getPricingRecommendation] Team: ${teamId}, Vehicle: ${vehicleName}, Location: ${location}`);
        
        // Find the vehicle
        let vehicleQuery = supabase
          .from('vehicles')
          .select('*');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        if (vehicleName) {
          vehicleQuery = vehicleQuery.or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`);
        }
        if (location) {
          vehicleQuery = vehicleQuery.ilike('location', `%${location}%`);
        }
        
        const { data: vehicle } = await vehicleQuery.maybeSingle();

        if (!vehicle) {
          return { 
            error: "Vehicle not found",
            summary: `I couldn't find a vehicle matching "${vehicleName}"${location ? ` in ${location}` : ''}.`
          };
        }

        const currentRate = Number(vehicle.current_rate || vehicle.daily_rate);
        const vehicleLocation = vehicle.location || 'Unassigned';
        const vName = vehicleDisplayName(vehicle);

        // The same engine the MotorIQ Pricing tab runs: booking pace against normal, what guests recently paid
        // against the listed rate, and the team's minimum rate. Advice only; nothing is changed here.
        const truth = await fleetTruth(supabase, teamId, null);
        const rec = truth ? recommendationFor(truth, vehicle.id) : null;
        if (!rec) {
          return {
            vehicle: vName,
            location: vehicleLocation,
            currentRate: `$${currentRate}`,
            summary: `I can't work out a pricing recommendation for your ${vName} right now.`,
          };
        }
        const difference = rec.recommendedRate - rec.currentRate;
        return {
          vehicle: vName,
          location: vehicleLocation,
          action: rec.action,
          confidence: rec.confidence,
          currentRate: `$${rec.currentRate}`,
          suggestedRate: `$${rec.recommendedRate}`,
          difference: `${difference > 0 ? '+' : difference < 0 ? '-' : ''}$${Math.abs(difference)}`,
          percentChange: `${rec.changePct > 0 ? '+' : ''}${Math.round(rec.changePct * 100)}%`,
          reasons: rec.drivers.map((d) => d.detail),
          whyNotMore: rec.holdReasons,
          estimatedExtraRevenue: rec.estimate
            ? { amount: `$${Math.round(rec.estimate.extraRevenue)}`, openDays: rec.estimate.openDays, assumption: rec.estimate.assumption }
            : null,
          basedOn: 'your own bookings: how booked the next week is compared with normal, what guests recently paid against your listed rate, and your minimum rate',
          dateRatesInForce: (truth?.overrides ?? [])
            .filter((o: any) => o.vehicle_id === vehicle.id && !o.revoked_at && o.end_date >= truth!.today)
            .map((o: any) => `${formatDateRange(o.start_date, o.end_date, tz)} at ${dollars0(Number(o.daily_rate))} a day (${o.source === 'manual' ? 'set by hand' : 'from a MotorIQ quote'}${o.reason ? `: ${o.reason}` : ''})`),
          eventNote: 'Event-date premiums are separate quotes; ask about events for your market.',
          summary: rec.speakable,
        };
      }

      case "getFleetPricingOverview": {
        const { location } = args;
        console.log(`[getFleetPricingOverview] Team: ${teamId}, Location: ${location || 'all'}`);
        
        let query = supabase
          .from('vehicles')
          .select('*');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        if (location && location !== 'all') {
          query = query.ilike('location', `%${location}%`);
        }
        
        const { data: vehicles } = await query;
        
        if (!vehicles || vehicles.length === 0) {
          return {
            summary: `You don't have any vehicles${location ? ` in ${location}` : ''} to analyze pricing for.`
          };
        }
        
        const totalVehicles = vehicles.length;
        const avgRate = vehicles.reduce((sum: number, v: any) => sum + Number(v.current_rate || v.daily_rate || 0), 0) / totalVehicles;

        const truth = await fleetTruth(supabase, teamId, location);
        if (!truth) {
          return { totalVehicles, averageRate: `$${avgRate.toFixed(0)}`, summary: `Your fleet has ${totalVehicles} vehicles at an average listed rate of ${dollars0(avgRate)}. I can't measure utilization right now.` };
        }
        const utilPct = sharePct(truth.facts.fleet.trailing30);
        const earned = truth.facts.fleet.earnedLast30.value;
        const recs = recommendAll(truth);
        const toRaise = recs.filter((r) => r.action === 'raise');
        const toLower = recs.filter((r) => r.action === 'lower');

        // Group by location (counts and listed rates; revenue is what bookings brought in over the last 30 days)
        const byLocation: Record<string, { count: number; revenue: number; avgRate: number }> = {};
        for (const v of vehicles as any[]) {
          const loc = v.location || 'Unassigned';
          if (!byLocation[loc]) byLocation[loc] = { count: 0, revenue: 0, avgRate: 0 };
          byLocation[loc].count++;
          byLocation[loc].revenue += truth.byId.get(v.id)?.earnedLast30 ?? 0;
          byLocation[loc].avgRate += Number(v.current_rate || v.daily_rate || 0);
        }
        for (const loc of Object.keys(byLocation)) byLocation[loc].avgRate = byLocation[loc].avgRate / byLocation[loc].count;

        const busiest = rankByUtilization(truth).filter((f) => f.trailing30.share != null).slice(0, 3);

        return {
          totalVehicles,
          averageRate: dollars0(avgRate),
          averageUtilization: pctLabel(utilPct),
          utilizationPeriod: 'last 30 days',
          bookedRevenueLast30Days: earned != null ? formatUsdWords(earned) : null,
          carsToRaise: toRaise.length,
          carsToLower: toLower.length,
          location: location || 'all',
          byLocation: Object.entries(byLocation).map(([loc, stats]) => ({
            location: loc,
            vehicleCount: stats.count,
            revenueLast30Days: formatUsdWords(stats.revenue),
            revenueRaw: stats.revenue,
            avgRate: `$${stats.avgRate.toFixed(0)}`
          })),
          busiestVehicles: busiest.map((f) => ({
            name: vehicleDisplayName(truth.rows.get(f.id) || f),
            location: truth.rows.get(f.id)?.location,
            utilization: pctLabel(sharePct(f.trailing30)),
            rate: `$${f.currentRate}`
          })),
          recommendations: toRaise.length + toLower.length > 0
            ? `MotorIQ suggests a base-rate change on ${toRaise.length + toLower.length} of ${recs.length} cars (${toRaise.length} to raise, ${toLower.length} to lower); the rest hold.`
            : 'No base-rate changes are suggested right now; the booking data supports the current rates.',
          summary: `Your fleet${location ? ` in ${location}` : ''} has ${totalVehicles} vehicles at an average listed rate of ${dollars0(avgRate)}. ${utilPct == null ? 'There is not enough booking data to measure utilization.' : `Over the last 30 days ${utilPct}% of available days were booked`}${earned != null ? ` and bookings brought in ${formatUsdWords(earned)}` : ''}. ${toRaise.length + toLower.length > 0 ? `MotorIQ suggests raising ${toRaise.length} and lowering ${toLower.length}; the rest hold.` : 'No base-rate changes are suggested right now.'}`
        };
      }

      case "getEventImpact": {
        const { eventName, location } = args as { eventName?: string; location?: string };
        const named = typeof eventName === 'string' ? eventName.trim().toLowerCase() : '';
        console.log(`[getEventImpact] Team: ${teamId}, event: ${named || '(none named)'}, location: ${location || 'all'}`);

        // Events for the markets the tenant's own cars are in: the curated calendar plus the nightly search
        // snapshot (the same sources the Demand Forecast card and MotorIQ read). Never a generic statistic.
        const truth = await fleetTruth(supabase, teamId, location);
        if (!truth) return { events: [], summary: "I can't look up events for your markets right now." };
        const markets = [...new Set([...truth.rows.values()].map((r) => matchDemandCity(r.location)?.value).filter(Boolean) as string[])];
        if (markets.length === 0) {
          return { events: [], summary: "I don't have an event calendar for your locations yet, so I can't say what's coming up there." };
        }

        const start = truth.today;
        const end = addDays(start, 14);
        const { data: snaps } = await supabase
          .from('demand_event_snapshots')
          .select('city, events, calendar_checks')
          .in('city', markets);
        const snapByCity = new Map((snaps || []).map((r: any) => [r.city, r]));
        const mySegments = new Set(truth.facts.vehicles.map((v) => v.segment));

        const found: any[] = [];
        for (const city of markets) {
          const snap = snapByCity.get(city);
          const curated = applyCalendarChecks(calendarEvents(city, start, end), snap?.calendar_checks);
          const searched = snap && Array.isArray(snap.events) ? sliceEvents(snap.events, start, end) : [];
          for (const e of [...curated, ...searched]) {
            if (e.evidence === 'unconfirmed' || e.tier === 'routine') continue;
            if (named && !String(e.name).toLowerCase().includes(named)) continue;
            // the biggest modeled effect among the segments this tenant actually owns (already weighted by evidence)
            let gain = 0;
            for (const seg of mySegments) gain = Math.max(gain, (e.segmentImpact?.[seg] ?? 1) - 1);
            found.push({
              name: e.name,
              market: city,
              dates: formatDateRange(e.date, e.endDate, tz),
              date: e.date,
              expectedAttendance: e.attendance > 0 ? formatNumberWords(e.attendance) : null,
              howSure: e.evidence,
              modeledLiftForYourCars: gain > 0.005 ? `about ${Math.round(gain * 100)}%` : null,
              gain,
            });
          }
        }
        // The events that matter most for these cars first (largest modeled lift), then by date
        found.sort((a, b) => b.gain - a.gain || a.date.localeCompare(b.date));
        const top = found.slice(0, 6).map(({ gain: _gain, ...e }) => e);

        return {
          events: top,
          count: found.length,
          windowDays: 14,
          caveat: 'The lift is a modeled estimate for your type of car, not yet measured on your own results.',
          summary: top.length
            ? `In the next two weeks around your cars: ${top.slice(0, 3).map((e) => `${e.name} (${e.dates}${e.expectedAttendance ? `, about ${e.expectedAttendance} people expected` : ''}, ${e.howSure})`).join('; ')}. The lift is a modeled estimate, not yet measured on your own bookings.`
            : named
              ? `I don't have a confirmed event matching "${eventName}" near your cars in the next two weeks.`
              : `I don't have any confirmed major events near your cars in the next two weeks.`,
        };
      }


      // getWeatherInfo removed 2026-07-31: it returned Math.random() temperature,
      // conditions, humidity and wind and presented them as fact. Do not
      // reintroduce without a real weather data source.


      case "getCarJoke": {
        const jokes = [
          "Why did the exotic car break up with the sedan? It said their relationship had no spark plugs!",
          "What do you call a Lamborghini that's been in an accident? A Lamb-bore-gini!",
          "Why don't Ferraris ever get lost? Because they always follow the red line!",
          "What's a McLaren's favorite music? Heavy metal... and carbon fiber!",
          "Why did the Bugatti go to therapy? It had too many speed issues!"
        ];
        return { joke: jokes[Math.floor(Math.random() * jokes.length)] };
      }

      case "getVehicleSpecs": {
        const { vehicleName } = args as { vehicleName?: string };
        const asked = String(vehicleName || '').trim();
        if (!asked) {
          return { error: 'no_vehicle_reference', summary: 'Which vehicle would you like the specs for?' };
        }

        // Reference specs for a handful of halo cars. Only ever used to enrich
        // a vehicle that actually exists in the tenant's fleet.
        const specsDatabase: Record<string, any> = {
          "ferrari sf90": { engine: "4.0L V8 + Electric Motors", horsepower: "986 hp", torque: "590 lb-ft", acceleration: "2.5 sec (0-60 mph)", topSpeed: "211 mph", drivetrain: "AWD" },
          "lamborghini aventador": { engine: "6.5L V12", horsepower: "770 hp", torque: "531 lb-ft", acceleration: "2.8 sec (0-60 mph)", topSpeed: "217 mph", drivetrain: "AWD" },
          "mclaren 720s": { engine: "4.0L Twin-Turbo V8", horsepower: "710 hp", torque: "568 lb-ft", acceleration: "2.8 sec (0-60 mph)", topSpeed: "212 mph", drivetrain: "RWD" },
          "bugatti chiron": { engine: "8.0L Quad-Turbo W16", horsepower: "1,479 hp", torque: "1,180 lb-ft", acceleration: "2.4 sec (0-60 mph)", topSpeed: "261 mph", drivetrain: "AWD" },
          "porsche 911": { engine: "3.7L Twin-Turbo Flat-6", horsepower: "640 hp", torque: "590 lb-ft", acceleration: "2.6 sec (0-60 mph)", topSpeed: "205 mph", drivetrain: "AWD" },
          "rolls-royce phantom": { engine: "6.75L Twin-Turbo V12", horsepower: "563 hp", torque: "664 lb-ft", acceleration: "5.1 sec (0-60 mph)", topSpeed: "155 mph", drivetrain: "RWD" },
        };

        const vehicle = await findTeamVehicleByTokens(supabase, teamId, asked);
        if (!vehicle) {
          return {
            error: 'not_found',
            searched: asked,
            summary: `I couldn't find "${asked}" in your fleet, so I don't have specs for it.`,
          };
        }

        const display = vehicleDisplayName(vehicle);
        const key = `${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.name || ''}`.toLowerCase();
        const specKey = Object.keys(specsDatabase).find((k) => key.includes(k) || k.includes(key.trim()));
        const reference = specKey ? specsDatabase[specKey] : null;

        const fleetFacts: string[] = [];
        if (vehicle.color) fleetFacts.push(`finished in ${vehicle.color}`);
        if (vehicle.transmission) fleetFacts.push(`${vehicle.transmission} transmission`);
        if (vehicle.mileage != null) fleetFacts.push(`${Number(vehicle.mileage).toLocaleString()} miles`);
        if (vehicle.location) fleetFacts.push(`based at ${vehicle.location}`);

        let summary = `The ${display}`;
        if (reference) {
          summary += ` runs a ${reference.engine} making ${reference.horsepower} and ${reference.torque}, 0-60 in ${reference.acceleration}, top speed ${reference.topSpeed}.`;
        } else {
          summary += ` is in your fleet`;
          summary += fleetFacts.length ? `, ${fleetFacts.join(', ')}.` : '. I don\'t have manufacturer performance figures for it.';
        }
        if (reference && fleetFacts.length) summary += ` Yours is ${fleetFacts.join(', ')}.`;
        if (vehicle.current_rate) summary += ` It rents at ${formatUsdWords(Number(vehicle.current_rate))} a day.`;

        return {
          vehicleId: vehicle.id,
          vehicle: display,
          year: vehicle.year ?? null,
          make: vehicle.make ?? null,
          model: vehicle.model ?? null,
          color: vehicle.color ?? null,
          transmission: vehicle.transmission ?? null,
          mileage: vehicle.mileage ?? null,
          location: vehicle.location ?? null,
          status: vehicle.status ?? null,
          dailyRate: vehicle.current_rate ?? null,
          ...(reference || {}),
          summary,
        };
      }


      case "logFeedback": {
        // `feedback` is the registry param: the raw thing the user said.
        const { feedback, feedbackType, keywords, userQuery, rariResponse, context } = args;
        const feedbackText = (typeof feedback === 'string' && feedback.trim())
          ? feedback.trim()
          : (typeof userQuery === 'string' ? userQuery : '');
        if (!feedbackText) {
          return {
            success: false,
            error: 'empty_feedback',
            summary: "I didn't catch what you'd like me to pass along. Could you say it again?",
          };
        }
        let parsedContext: unknown = null;
        if (context) {
          try { parsedContext = typeof context === 'string' ? JSON.parse(context) : context; }
          catch { parsedContext = { raw: String(context) }; }
        }
        console.log(`[logFeedback] Logging feedback: ${feedbackType}`);
        
        const { error } = await supabase
          .from('rari_feedback')
          .insert({
            user_id: userId,
            feedback_type: feedbackType || 'feature_request',
            keywords: keywords ? keywords.split(',').map((k: string) => k.trim()) : [],
            user_query: feedbackText,
            rari_response: rariResponse ?? null,
            context: parsedContext
          });

        if (error) {
          console.error('[logFeedback] Error:', error);
          return { 
            success: false, 
            error: error.message,
            summary: "I apologize, I couldn't save that feedback. But I've noted your request."
          };
        }

        return { 
          success: true,
          summary: "I've logged that feedback and the team will see it. Anything else?"
        };
      }

      case "featureComingSoon": {
        const { featureName, userRequest } = args;
        console.log(`[featureComingSoon] Feature requested: ${featureName}`);
        
        // Log as feature request
        await supabase
          .from('rari_feedback')
          .insert({
            user_id: userId,
            feedback_type: 'feature_request',
            keywords: [featureName],
            user_query: userRequest,
            rari_response: `Feature coming soon: ${featureName}`,
            context: { requested_feature: featureName }
          });

        return {
          feature: featureName,
          status: 'coming_soon',
          summary: `That's a great idea! The ${featureName} feature is coming soon. I've logged your request so the team knows you need this. In the meantime, is there something else I can help you with?`
        };
      }

      // ============================================================
      // ENTERPRISE HANDLERS - Advanced Business Intelligence
      // ============================================================

      case "getFleetProfitLoss":
      case "getVehicleProfitLoss": {
        const { vehicleName, timeframe, location } = args;
        console.log(`[getVehicleProfitLoss] Team: ${teamId}, Vehicle: ${vehicleName || 'all'}, Timeframe: ${timeframe || 'all'}, Location: ${location || 'all'}`);

        // Route through fn_vehicle_pnl so Rari reports exactly the same numbers
        // as the Margin / Per-vehicle P&L tab. The previous inline maths only
        // counted maintenance_schedules as an expense and used created_at as
        // the date axis, which under-reported costs and mis-bucketed rentals.
        const window = resolveTimeframeWindow(timeframe, tz);
        const pStart = (window.start ?? '2000-01-01T00:00:00.000Z').slice(0, 10);
        const pEnd = window.end.slice(0, 10);

        const { data: pnlRows, error: pnlError } = await supabase.rpc('fn_vehicle_pnl', {
          p_team_id: teamId,
          p_start: pStart,
          p_end: pEnd,
        });

        if (pnlError) {
          console.error('[getVehicleProfitLoss] fn_vehicle_pnl failed:', pnlError);
          return {
            error: 'pnl_lookup_failed',
            summary: `I couldn't pull the profit and loss numbers just now (${pnlError.message}). I'd rather tell you that than guess.`,
          };
        }

        let rows: any[] = pnlRows || [];

        // Location filter needs the vehicles table (fn_vehicle_pnl doesn't return it).
        if (location && location !== 'all') {
          const { data: locVehicles } = await supabase
            .from('vehicles')
            .select('id')
            .eq('team_id', teamId)
            .ilike('location', `%${location}%`);
          const allowed = new Set((locVehicles || []).map((v: any) => v.id));
          rows = rows.filter((r) => allowed.has(r.vehicle_id));
        }

        if (vehicleName) {
          const needle = String(vehicleName).toLowerCase();
          rows = rows.filter((r) => String(r.vehicle_name || '').toLowerCase().includes(needle));
        }

        if (rows.length === 0) {
          return {
            vehicles: [],
            summary: vehicleName || location
              ? `I couldn't find any vehicles matching that for ${window.label}.`
              : `There's no profit and loss activity for ${window.label} yet.`,
          };
        }

        rows.sort((a, b) => Number(b.operator_net || 0) - Number(a.operator_net || 0));

        const profitLoss = rows.map((r) => ({
          vehicle: r.vehicle_name,
          grossRevenue: formatUsdWords(Number(r.gross_revenue || 0)),
          platformFees: formatUsdWords(Number(r.platform_fees || 0)),
          netRevenue: formatUsdWords(Number(r.net_revenue || 0)),
          expenses: formatUsdWords(Number(r.total_expenses || 0)),
          partnerPayouts: formatUsdWords(Number(r.partner_payouts || 0)),
          operatorNet: formatUsdWords(Number(r.operator_net || 0)),
          operatorNetRaw: Number(r.operator_net || 0),
          grossRevenueRaw: Number(r.gross_revenue || 0),

          margin: `${Number(r.margin_pct || 0).toFixed(1)}%`,
          bookings: Number(r.booking_count || 0),
        }));

        const sum = (k: string) => rows.reduce((t, r) => t + Number(r[k] || 0), 0);
        const totalGross = sum('gross_revenue');
        const totalExpenses = sum('total_expenses');
        const totalPayouts = sum('partner_payouts');
        const totalFees = sum('platform_fees');
        const totalNet = sum('operator_net');
        const overallMargin = totalGross > 0 ? (totalNet / totalGross) * 100 : 0;

        const best = profitLoss[0];
        const worst = profitLoss[profitLoss.length - 1];

        let summary = `Across ${rows.length} vehicle${rows.length === 1 ? '' : 's'} for ${window.label}`;
        if (location && location !== 'all') summary += ` in ${location}`;
        summary += `: gross revenue ${formatUsdWords(totalGross)}, expenses ${formatUsdWords(totalExpenses)}, partner payouts ${formatUsdWords(totalPayouts)}, platform fees ${formatUsdWords(totalFees)}, leaving you ${formatUsdWords(totalNet)} at a ${overallMargin.toFixed(1)} percent margin.`;
        if (rows.length > 1) {
          summary += ` Best is ${best.vehicle} at ${best.operatorNet}; weakest is ${worst.vehicle} at ${worst.operatorNet}.`;
        }

        return {
          vehicles: profitLoss,
          grossRevenueRaw: totalGross,
          operatorNetRaw: totalNet,
          totals: {
            grossRevenue: formatUsdWords(totalGross),
            grossRevenueRaw: totalGross,
            platformFees: formatUsdWords(totalFees),
            expenses: formatUsdWords(totalExpenses),
            partnerPayouts: formatUsdWords(totalPayouts),
            operatorNet: formatUsdWords(totalNet),
            operatorNetRaw: totalNet,
            margin: `${overallMargin.toFixed(1)}%`,
          },
          timeframe: window.label,
          summary,

        };
      }


      case "compareLocations": {
        const { locations: requestedLocations, timeframe } = args;
        console.log(`[compareLocations] Team: ${teamId}, Locations: ${requestedLocations || 'all'}, Timeframe: ${timeframe || 'all'}`);
        
        // Get all vehicles grouped by location
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, location, current_rate, status');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (!vehicles || vehicles.length === 0) {
          return { summary: "You don't have any vehicles to compare." };
        }
        
        // Group by location. Utilization and revenue come from the tenant's bookings over the last 30 days
        // (the stored vehicles.utilization / vehicles.revenue columns are not maintained).
        const cmpTruth = await fleetTruth(supabase, teamId, null);
        const locationData: Record<string, any> = {};
        
        for (const vehicle of vehicles) {
          const loc = vehicle.location || 'Unassigned';
          if (!locationData[loc]) {
            locationData[loc] = {
              location: loc,
              vehicleCount: 0,
              availableCount: 0,
              rentedCount: 0,
              totalRevenue: 0,
              booked: 0,
              available: 0,
              avgRate: 0
            };
          }

          const cf = cmpTruth?.byId.get(vehicle.id);
          locationData[loc].vehicleCount++;
          if (cf && !cf.outOfService) {
            locationData[loc].booked += cf.trailing30.booked;
            locationData[loc].available += cf.trailing30.available;
          }
          locationData[loc].totalRevenue += cf?.earnedLast30 ?? 0;
          locationData[loc].avgRate += Number(vehicle.current_rate || 0);
          
          if (vehicle.status === 'available') locationData[loc].availableCount++;
          if (vehicle.status === 'rented') locationData[loc].rentedCount++;
        }
        
        // Calculate averages
        const locations = Object.values(locationData).map((loc: any) => ({
          location: loc.location,
          vehicleCount: loc.vehicleCount,
          availableCount: loc.availableCount,
          rentedCount: loc.rentedCount,
          revenue: `$${loc.totalRevenue.toFixed(0)}`,
          revenuePeriod: 'last 30 days',
          avgUtilization: pctLabel(loc.available > 0 ? Math.round((loc.booked / loc.available) * 100) : null),
          utilizationPeriod: 'last 30 days',
          avgRate: `$${(loc.avgRate / loc.vehicleCount).toFixed(0)}`
        }));
        
        // Sort by revenue
        locations.sort((a, b) => parseFloat(b.revenue.replace('$', '')) - parseFloat(a.revenue.replace('$', '')));
        
        return {
          locations,
          locationCount: locations.length,
          summary: `Location comparison for the last 30 days: ${locations.map(l => `${l.location} (${carsWord(l.vehicleCount)}, ${formatUsdWords(parseFloat(l.revenue.replace('$', '')) || 0)} booked revenue, ${utilPhrase(l.avgUtilization)})`).join('; ')}.`
        };
      }

      case "getOutstandingBalances": {
        const { location, minAmount, limit } = args;
        const maxBalances = toLimit(limit, 25);
        console.log(`[getOutstandingBalances] Team: ${teamId}, Location: ${location || 'all'}, MinAmount: ${minAmount || 0}`);
        
        // Get bookings with outstanding balances
        let query = supabase
          .from('bookings')
          .select('*, vehicles(make, model, year, location), customers(full_name, email, phone)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        const { data: bookings } = await query
          .or('payment_status.eq.pending,balance_due.gt.0')
          .order('created_at', { ascending: false });
        
        let filteredBookings = bookings || [];
        
        if (location && location !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        if (minAmount && minAmount > 0) {
          filteredBookings = filteredBookings.filter((b: any) => 
            Number(b.balance_due || b.total_value || 0) >= minAmount
          );
        }
        
        // Total across everything owed stays accurate; only the returned rows
        // are capped, so a voice answer doesn't read 200 bookings aloud.
        const outstandingTotalCount = filteredBookings.length;
        filteredBookings = filteredBookings.slice(0, maxBalances);

        const outstandingList = filteredBookings.map((b: any) => {
          const endDate = new Date(b.end_date);
          const daysOverdue = Math.floor((new Date().getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            customer: b.customers?.full_name || b.customer_name || 'Unknown',
            vehicle: b.vehicles ? vehicleDisplayName(b.vehicles) : 'Unknown',
            location: b.vehicles?.location || 'Unassigned',
            balanceDue: `$${Number(b.balance_due || b.total_value || 0).toFixed(0)}`,
            daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
            urgency: daysOverdue > 30 ? 'critical' : daysOverdue > 14 ? 'high' : 'normal'
          };
        });
        
        const totalOutstanding = outstandingList.reduce((sum: number, b: any) => sum + parseFloat(b.balanceDue.replace('$', '')), 0);
        
        return {
          outstandingBookings: outstandingList,
          totalOutstanding: `$${totalOutstanding.toFixed(0)}`,
          count: outstandingList.length,
          totalCount: outstandingTotalCount,
          truncated: outstandingTotalCount > outstandingList.length,
          summary: outstandingList.length > 0
            ? `You have $${totalOutstanding.toFixed(0)} in outstanding balances across ${outstandingList.length} booking${outstandingList.length > 1 ? 's' : ''}${location ? ` in ${location}` : ''}. Top outstanding: ${outstandingList[0]?.customer} owes ${outstandingList[0]?.balanceDue}.`
            : `No outstanding balances found${location ? ` in ${location}` : ''}. All payments are up to date!`
        };
      }

      case "getIdleVehicles": {
        const { daysIdle = 7, location } = args;
        console.log(`[getIdleVehicles] Team: ${teamId}, DaysIdle: ${daysIdle}, Location: ${location || 'all'}`);
        
        // Get available vehicles
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, year, location, current_rate')
          .eq('status', 'available');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        if (location && location !== 'all') {
          vehicleQuery = vehicleQuery.ilike('location', `%${location}%`);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (!vehicles || vehicles.length === 0) {
          return { summary: `No available vehicles found${location ? ` in ${location}` : ''}.` };
        }
        
        // Get recent bookings
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysIdle);
        
        const { data: recentBookings } = await supabase
          .from('bookings')
          .select('vehicle_id, end_date')
          .in('vehicle_id', vehicles.map((v: any) => v.id))
          .gte('end_date', cutoffDate.toISOString());
        
        const recentlyBookedIds = new Set(recentBookings?.map((b: any) => b.vehicle_id) || []);
        
        const idleTruth = await fleetTruth(supabase, teamId, location);
        const idleVehicles = vehicles
          .filter((v: any) => !recentlyBookedIds.has(v.id))
          .map((v: any) => {
            const rec = idleTruth ? recommendationFor(idleTruth, v.id) : null;
            return {
              vehicle: vehicleDisplayName(v),
              location: v.location || 'Unassigned',
              currentRate: `$${v.current_rate}`,
              utilization: utilizationWords(idleTruth, v.id),
              openDaysNext14: idleTruth?.byId.get(v.id)?.openDates14.length ?? null,
              recommendation: rec ? rec.speakable : 'There is not enough booking history yet to recommend a price change.',
            };
          });
        const openDaysTotal = idleVehicles.reduce((sum: number, v: any) => sum + (v.openDaysNext14 || 0), 0);

        return {
          idleVehicles,
          count: idleVehicles.length,
          totalVehicles: vehicles.length,
          openDaysNext14: openDaysTotal,
          daysThreshold: daysIdle,
          summary: idleVehicles.length > 0
            ? `${idleVehicles.length} of ${vehicles.length} vehicles are idle (no bookings in ${daysIdle} days)${location ? ` in ${location}` : ''}, with ${openDaysTotal} open days in the next two weeks. Most idle: ${idleVehicles[0]?.vehicle}. ${idleVehicles[0]?.recommendation}`
            : `All ${vehicles.length} vehicles${location ? ` in ${location}` : ''} have been active in the last ${daysIdle} days.`
        };
      }

      case "getMultiLocationAvailability": {
        const { startDate, endDate, vehicleType, make } = args;
        console.log(`[getMultiLocationAvailability] Team: ${teamId}, Dates: ${startDate} to ${endDate}, Type: ${vehicleType || 'all'}, Make: ${make || 'all'}`);
        
        if (!startDate || !endDate) {
          return { error: 'Start and end dates are required', summary: 'Please specify the dates you need a vehicle for.' };
        }
        
        // Get all available vehicles
        let vehicleQuery = supabase
          .from('vehicles')
          .select('id, name, make, model, year, location, current_rate')
          .eq('status', 'available');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        if (make) {
          vehicleQuery = vehicleQuery.ilike('make', `%${make}%`);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (!vehicles || vehicles.length === 0) {
          return { summary: `No available vehicles found matching your criteria.` };
        }
        
        // Check for conflicts
        const { data: conflicts } = await supabase
          .from('bookings')
          .select('vehicle_id')
          .in('vehicle_id', vehicles.map((v: any) => v.id))
          .in('status', ['active', 'confirmed', 'pending'])
          .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);
        
        const conflictedIds = new Set(conflicts?.map((c: any) => c.vehicle_id) || []);
        
        // Group by location
        const byLocation: Record<string, any[]> = {};
        
        for (const vehicle of vehicles) {
          if (conflictedIds.has(vehicle.id)) continue;
          
          const loc = vehicle.location || 'Unassigned';
          if (!byLocation[loc]) byLocation[loc] = [];
          
          byLocation[loc].push({
            vehicle: vehicleDisplayName(vehicle),
            rate: `$${vehicle.current_rate}/day`
          });
        }
        
        const locations = Object.entries(byLocation).map(([loc, vehicleList]) => ({
          location: loc,
          availableCount: vehicleList.length,
          vehicles: vehicleList,
          lowestRate: vehicleList.length > 0 ? `$${Math.min(...vehicleList.map((v: any) => parseFloat(v.rate.replace('$', '').replace('/day', ''))))}/day` : 'N/A'
        }));
        
        const totalAvailable = locations.reduce((sum, loc) => sum + loc.availableCount, 0);
        
        return {
          requestedDates: `${startDate} to ${endDate}`,
          locations,
          totalAvailable,
          summary: totalAvailable > 0
            ? `${totalAvailable} vehicle${totalAvailable > 1 ? 's' : ''} available for ${startDate} to ${endDate}. ${locations.map(l => `${l.location}: ${l.availableCount} (from ${l.lowestRate})`).join(', ')}.`
            : `No vehicles available for ${startDate} to ${endDate}. All matching vehicles have booking conflicts.`
        };
      }

      case "getCustomerSegments": {
        const { segment, location, limit = 10 } = args;
        console.log(`[getCustomerSegments] Team: ${teamId}, Segment: ${segment || 'all'}, Location: ${location || 'all'}`);
        
        // Get customers with booking data
        let customerQuery = supabase
          .from('customers')
          .select('id, full_name, email, customer_status, total_bookings, lifetime_value');
        
        if (teamId) {
          customerQuery = customerQuery.eq('team_id', teamId);
        }
        
        const { data: customers } = await customerQuery
          .order('lifetime_value', { ascending: false })
          .limit(50);
        
        if (!customers) {
          return { summary: 'I encountered an error retrieving customer data.' };
        }
        
        // Get recent bookings for recency
        const { data: bookings } = await supabase
          .from('bookings')
          .select('customer_id, created_at')
          .in('customer_id', customers.map((c: any) => c.id))
          .order('created_at', { ascending: false });
        
        // Segment customers
        const segmented = customers.map((c: any) => {
          const lastBooking = bookings?.find((b: any) => b.customer_id === c.id);
          const daysSince = lastBooking 
            ? Math.floor((new Date().getTime() - new Date(lastBooking.created_at).getTime()) / (1000 * 60 * 60 * 24))
            : 999;
          
          const ltv = Number(c.lifetime_value || 0);
          const bookingCount = c.total_bookings || 0;
          
          let seg: string;
          if (ltv >= 50000 || bookingCount >= 10) seg = 'vip';
          else if (ltv >= 20000 || bookingCount >= 5) seg = 'high_value';
          else if (daysSince <= 30) seg = 'active';
          else if (daysSince <= 90) seg = 'warm';
          else if (bookingCount > 0) seg = 'at_risk';
          else seg = 'new';
          
          return {
            name: c.full_name,
            email: c.email,
            segment: seg,
            lifetimeValue: `$${ltv.toFixed(0)}`,
            totalBookings: bookingCount,
            daysSinceLastBooking: daysSince < 999 ? daysSince : 'Never'
          };
        });
        
        // Filter
        let filtered = segmented;
        if (segment && segment !== 'all') {
          filtered = segmented.filter((c: any) => c.segment === segment);
        }
        
        filtered = filtered.slice(0, limit);
        
        // Count segments
        const counts = segmented.reduce((acc: any, c: any) => {
          acc[c.segment] = (acc[c.segment] || 0) + 1;
          return acc;
        }, {});
        
        return {
          customers: filtered,
          count: filtered.length,
          segmentCounts: counts,
          summary: segment 
            ? `Found ${filtered.length} ${segment} customers. ${segment === 'at_risk' ? 'Consider re-engagement campaigns.' : segment === 'vip' ? 'These are your top customers—prioritize their experience.' : ''}`
            : `Customer segments: ${Object.entries(counts).map(([s, c]) => `${s}: ${c}`).join(', ')}. Total: ${customers.length} customers.`
        };
      }

      case "getRariInsights": {
        const { priority, limit = 5 } = args;
        console.log(`[getRariInsights] Team: ${teamId}, Priority: ${priority || 'all'}, Limit: ${limit}`);
        
        // Generate insights on-the-fly based on current data
        const insights: any[] = [];
        
        // Insights from the tenant's own bookings (the same facts and engine as MotorIQ)
        const insightTruth = await fleetTruth(supabase, teamId, null);
        if (insightTruth) {
          const slow = rankByUtilization(insightTruth)
            .filter((f) => f.trailing30.share != null && f.trailing30.share < 0.3 && f.trailing30.available >= 10)
            .reverse();
          if (slow.length > 0) {
            insights.push({
              type: 'utilization',
              priority: 'medium',
              title: `${slow.length} ${slow.length === 1 ? 'car was' : 'cars were'} booked under 30% of the last 30 days`,
              description: slow.slice(0, 3).map((f) => `${f.name} (${sharePct(f.trailing30)}%)`).join(', '),
              action: 'Look at price and availability for these cars'
            });
          }
          const changes = recommendAll(insightTruth).filter((r) => r.action !== 'hold' && r.confidence !== 'low');
          if (changes.length > 0) {
            insights.push({
              type: 'pricing',
              priority: 'medium',
              title: `${changes.length} ${changes.length === 1 ? 'car has' : 'cars have'} a base-rate change worth making`,
              description: changes.slice(0, 2).map((r) => r.speakable).join(' '),
              action: 'Review these in the MotorIQ pricing tab'
            });
          }
          const pk = insightTruth.facts.fleet.pickups;
          if (pk.last7 === 0 && pk.prev7 === 0 && insightTruth.facts.fleet.vehicles > 0) {
            insights.push({
              type: 'data',
              priority: 'medium',
              title: 'No new bookings in the last two weeks',
              description: 'Pricing advice holds when there is no fresh booking activity to read.',
              action: 'Check that new bookings are being recorded'
            });
          }
        }

        // Check for upcoming maintenance
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        let maintenanceQuery = supabase
          .from('maintenance_schedules')
          .select('*, vehicles(name, make, model)')
          .lte('scheduled_date', nextWeek.toISOString())
          .gte('scheduled_date', new Date().toISOString())
          .eq('status', 'scheduled');
        
        if (teamId) {
          maintenanceQuery = maintenanceQuery.eq('team_id', teamId);
        }
        
        const { data: maintenance } = await maintenanceQuery;
        
        if (maintenance && maintenance.length > 0) {
          insights.push({
            type: 'maintenance',
            priority: 'high',
            title: `${maintenance.length} vehicles need service this week`,
            description: `Schedule maintenance for ${maintenance.slice(0, 3).map((m: any) => m.vehicles?.name || 'vehicle').join(', ')}`,
            action: 'Review and confirm maintenance appointments'
          });
        }
        
        // Filter by priority if specified
        let filtered = insights;
        if (priority && priority !== 'all') {
          filtered = insights.filter(i => i.priority === priority);
        }
        
        return {
          insights: filtered.slice(0, limit),
          count: filtered.length,
          summary: filtered.length > 0
            ? `I have ${filtered.length} insight${filtered.length > 1 ? 's' : ''} for you: ${filtered.slice(0, 2).map(i => i.title).join('. ')}.`
            : 'No new insights at this time. Your fleet is running smoothly!'
        };
      }

      // ============================================================
      // NEW OPERATIONS TOOLS (added 2026-06-12)
      // ============================================================

      case "get_vehicle_status": {
        const { vehicle_name } = args as { vehicle_name?: string };
        const now = new Date().toISOString();
        let vQ = supabase.from('vehicles').select('id, year, make, model, status, location, current_rate');
        if (teamId) vQ = vQ.eq('team_id', teamId);
        if (vehicle_name) vQ = vQ.or(`make.ilike.%${vehicle_name}%,model.ilike.%${vehicle_name}%`);
        const { data: vehicles, error: vErr } = await vQ.limit(50);
        if (vErr) return { error: vErr.message };
        if (!vehicles?.length) return { count: 0, summary: `No vehicles found${vehicle_name ? ` matching "${vehicle_name}"` : ''}.` };

        const ids = vehicles.map((v: any) => v.id);
        const [{ data: liveBookings }, { data: maint }, { data: wos }] = await Promise.all([
          supabase.from('bookings').select('vehicle_id, customer_name, end_date, status, booking_ref').in('vehicle_id', ids).in('status', ['confirmed','pending']).lte('start_date', now).gte('end_date', now),
          supabase.from('maintenance_windows').select('vehicle_id, end_at, reason').in('vehicle_id', ids).lte('start_at', now).gte('end_at', now),
          supabase.from('work_orders').select('vehicle_id, title, status').in('vehicle_id', ids).in('status', ['open','in_progress']),
        ]);

        const results = vehicles.map((v: any) => {
          const live = liveBookings?.find((b: any) => b.vehicle_id === v.id);
          const mw   = maint?.find((m: any) => m.vehicle_id === v.id);
          const openWO = wos?.filter((w: any) => w.vehicle_id === v.id) || [];
          let liveState = 'available';
          let detail = '';
          if (live) { liveState = 'on rent'; detail = `with ${live.customer_name}${live.booking_ref ? ` (${live.booking_ref})` : ''} until ${fmtDay(live.end_date, tz)}`; }
          else if (mw) { liveState = 'in maintenance'; detail = mw.reason || ''; }
          else if (v.status === 'retired') liveState = 'retired';
          return {
            vehicle: vehicleDisplayName(v),
            location: v.location,
            db_status: v.status,
            live_status: liveState,
            detail,
            open_work_orders: openWO.length,
          };
        });
        return {
          count: results.length,
          vehicles: results,
          summary: `${results.length} vehicle${results.length === 1 ? '' : 's'}: ${results.slice(0,3).map(r => `${r.vehicle} — ${r.live_status}${r.detail ? ' ' + r.detail : ''}`).join('; ')}.`,
        };
      }

      case "get_todays_schedule": {
        const todayBounds = localDayBounds(dayKey(Date.now(), tz), tz);
        const todayStart = new Date(todayBounds.start);
        const todayEnd   = new Date(todayBounds.end);
        const nowIso = new Date().toISOString();
        const teamFilter = (q: any) => teamId ? q.eq('team_id', teamId) : q;

        const [{ data: checkOuts }, { data: checkIns }, { data: overdue }, { data: maint }] = await Promise.all([
          teamFilter(supabase.from('bookings').select('booking_ref, customer_name, customer_phone, vehicle_name, start_date, pickup_location, status').gte('start_date', todayStart.toISOString()).lte('start_date', todayEnd.toISOString()).in('status', ['confirmed','pending']).order('start_date')),
          teamFilter(supabase.from('bookings').select('booking_ref, customer_name, customer_phone, vehicle_name, end_date, dropoff_location, status').gte('end_date', todayStart.toISOString()).lte('end_date', todayEnd.toISOString()).eq('status', 'confirmed').order('end_date')),
          teamFilter(supabase.from('bookings').select('booking_ref, customer_name, customer_phone, vehicle_name, end_date').lt('end_date', nowIso).eq('status', 'confirmed').order('end_date')).limit(20),
          teamFilter(supabase.from('maintenance_windows').select('vehicle_id, start_at, end_at, reason').gte('start_at', todayStart.toISOString()).lte('start_at', todayEnd.toISOString())),
        ]);

        return {
          date: dayKey(Date.now(), tz),
          timeZone: tz,
          check_outs: (checkOuts || []).map((b: any) => ({ ref: b.booking_ref, customer: b.customer_name, phone: b.customer_phone, vehicle: b.vehicle_name, time: b.start_date, timeLocal: fmtTime(b.start_date, tz), location: b.pickup_location })),
          check_ins:  (checkIns  || []).map((b: any) => ({ ref: b.booking_ref, customer: b.customer_name, phone: b.customer_phone, vehicle: b.vehicle_name, time: b.end_date, timeLocal: fmtTime(b.end_date, tz), location: b.dropoff_location })),
          overdue:    (overdue   || []).map((b: any) => ({ ref: b.booking_ref, customer: b.customer_name, phone: b.customer_phone, vehicle: b.vehicle_name, was_due: b.end_date, wasDueLocal: `${fmtDay(b.end_date, tz)} ${fmtTime(b.end_date, tz)}` })),
          maintenance_starting: (maint || []).length,
          summary: `Today: ${(checkOuts||[]).length} check-out${(checkOuts||[]).length===1?'':'s'}, ${(checkIns||[]).length} check-in${(checkIns||[]).length===1?'':'s'}, ${(overdue||[]).length} overdue return${(overdue||[]).length===1?'':'s'}.`,
        };
      }

      case "get_booking_by_reference": {
        const { reference } = args as { reference?: string };
        if (!reference) return { error: 'reference is required (e.g. BK-01234)' };
        const ref = reference.trim().toUpperCase();
        let q = supabase.from('bookings').select('*').eq('booking_ref', ref).limit(1);
        if (teamId) q = q.eq('team_id', teamId);
        const { data, error } = await q.maybeSingle();
        if (error) return { error: error.message };
        if (!data) return { found: false, summary: `No booking found with reference ${ref}.` };
        return {
          found: true,
          booking: {
            ref: data.booking_ref, status: data.status,
            customer: data.customer_name, phone: data.customer_phone, email: data.customer_email,
            vehicle: data.vehicle_name, start_date: data.start_date, end_date: data.end_date,
            pickup: data.pickup_location, dropoff: data.dropoff_location,
            total: data.total_value, balance_due: data.balance_due, payment_status: data.payment_status,
            notes: data.notes,
          },
          summary: `${data.booking_ref}: ${data.customer_name} in the ${data.vehicle_name}, ${fmtDay(data.start_date, tz)} to ${fmtDay(data.end_date, tz)}, status ${data.status}.`,
        };
      }

      case "search_customer": {
        const { query } = args as { query?: string };
        if (!query || query.trim().length < 2) return { error: 'query must be at least 2 characters' };
        const term = query.trim();
        let q = supabase.from('customers').select('id, full_name, email, phone, total_bookings, lifetime_value').or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`).limit(10);
        if (teamId) q = q.eq('team_id', teamId);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return {
          count: data?.length || 0,
          customers: data || [],
          summary: data?.length ? `Found ${data.length} customer${data.length===1?'':'s'}: ${data.slice(0,3).map((c: any) => c.full_name).join(', ')}.` : `No customers match "${term}".`,
        };
      }

      case "get_open_work_orders": {
        const { priority, limit } = args as { priority?: string; limit?: number };
        let q = supabase.from('work_orders').select('id, title, status, priority, vehicle_id, due_at, created_at, vendor_name, vehicles(year, make, model)').in('status', ['open','in_progress']).order('created_at', { ascending: true }).limit(toLimit(limit, 50));
        if (teamId) q = q.eq('team_id', teamId);
        if (priority && priority !== 'all') q = q.eq('priority', priority);
        const { data, error } = await q;
        if (error) return { error: error.message };
        const list = (data || []).map((w: any) => ({
          title: w.title, status: w.status, priority: w.priority,
          vehicle: w.vehicles ? vehicleDisplayName(w.vehicles) : 'unassigned',
          due_at: w.due_at, vendor: w.vendor_name,
        }));
        return {
          count: list.length,
          work_orders: list,
          summary: list.length ? `${list.length} open work order${list.length===1?'':'s'}. ${list.slice(0,3).map(w => `${w.title} (${w.vehicle})`).join('; ')}.` : 'No open work orders. Fleet is in good shape.',
        };
      }

      case "create_booking_hold": {
        const { vehicle, customer_name, customer_phone, start_date, end_date, notes } = args as any;
        let { vehicle_id } = args as any;

        // The registry exposes a free-text `vehicle`; resolve it to an id that
        // belongs to the caller's team before anything is written.
        let veh: any = null;
        if (!vehicle_id && vehicle) {
          const resolved = await resolveTeamVehicle(supabase, teamId, String(vehicle));
          if (resolved.error === 'not_found') {
            return { error: 'vehicle_not_found', summary: `I couldn't find a vehicle matching "${vehicle}" in your fleet.` };
          }
          if (resolved.matches) {
            return {
              error: 'ambiguous_vehicle',
              matches: resolved.matches.map((v: any) => vehicleDisplayName(v)),
              summary: `Several vehicles match "${vehicle}": ${resolved.matches.map((v: any) => vehicleDisplayName(v)).join(', ')}. Which one should I hold?`,
            };
          }
          veh = resolved.vehicle;
          vehicle_id = veh.id;
        }

        if (!vehicle_id || !customer_name || !start_date || !end_date) {
          return { error: 'vehicle, customer_name, start_date, and end_date are required' };
        }
        let conflictQ = supabase.from('bookings').select('id, booking_ref, customer_name').eq('vehicle_id', vehicle_id).in('status', ['confirmed','pending']).lte('start_date', end_date).gte('end_date', start_date);
        if (teamId) conflictQ = conflictQ.eq('team_id', teamId);
        const { data: conflicts } = await conflictQ.limit(1);
        if (conflicts && conflicts.length) {
          return { error: 'conflict', conflict: conflicts[0], summary: `That window overlaps booking ${conflicts[0].booking_ref} for ${conflicts[0].customer_name}. Pick a different vehicle or time.` };
        }
        if (!veh) {
          let vq = supabase.from('vehicles').select('id, year, make, model, current_rate, location').eq('id', vehicle_id);
          if (teamId) vq = vq.eq('team_id', teamId);
          const { data } = await vq.maybeSingle();
          veh = data;
        }
        if (!veh) return { error: 'vehicle not found in your fleet' };


        const ms = new Date(end_date).getTime() - new Date(start_date).getTime();
        const days = Math.max(1, Math.ceil(ms / 86400000));
        const total = days * Number(veh.current_rate || 0);
        const holdNote = `[Rari hold ${new Date().toISOString()}] ${notes || ''}`.trim();

        const insert: any = {
          user_id: userId,
          team_id: teamId,
          vehicle_id,
          vehicle_name: vehicleDisplayName(veh),
          customer_name,
          customer_phone: customer_phone || null,
          start_date,
          end_date,
          pickup_location: veh.location || 'Unassigned',
          daily_rate: veh.current_rate || 0,
          total_value: total,
          status: 'pending',
          payment_status: 'unpaid',
          booking_source: 'rari_voice',
          notes: holdNote,
        };

        const { data: created, error } = await supabase.from('bookings').insert(insert).select('id, booking_ref').single();
        if (error) return { error: error.message };

        return {
          success: true,
          booking_id: created.id,
          booking_ref: created.booking_ref,
          summary: `Hold created — reference ${created.booking_ref}. ${vehicleDisplayName(veh)} for ${customer_name}, ${days} day${days===1?'':'s'}, total $${total.toLocaleString()}. It's pending until you confirm or cancel.`,
        };
      }



      default:
        // Log unknown requests as potential feature needs
        console.log(`[UNKNOWN] Function not found: ${functionName}`);
        await supabase
          .from('rari_feedback')
          .insert({
            user_id: userId,
            feedback_type: 'not_working',
            keywords: [functionName],
            user_query: JSON.stringify(args),
            rari_response: `Unknown function: ${functionName}`,
            context: { function_name: functionName, args }
          });
        
        return { 
          error: `I don't have that capability yet, but I've noted your request.`,
          summary: `That feature isn't available yet, but I've logged it for the team. Is there something else I can help you with?`
        };
    }
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    return { error: error instanceof Error ? error.message : 'Function execution failed' };
  }
}

