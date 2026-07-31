// @ts-nocheck — dynamic tool arg handling; matches the original elevenlabs-tools behaviour.
// Shared FleetCopilot tool executor — the single implementation of every
// Rari capability. Voice (elevenlabs-tools), MCP (rari-mcp-server) and the
// in-app chat (fleet-copilot-chat) are thin adapters over this module.
//
// Every handler is team-scoped through the `teamId` argument. Handlers must
// never accept a team id from tool input.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

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
export function resolveTimeframeWindow(timeframe?: string): { start: string | null; end: string; label: string } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  switch (timeframe) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: end.toISOString(), label: 'today' };
    case 'week':
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: end.toISOString(), label: 'the last 7 days' };
    case 'month':
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: end.toISOString(), label: 'the last 30 days' };
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: end.toISOString(), label: 'the last 12 months' };
    default:
      return { start: null, end: end.toISOString(), label: 'all time' };
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

/**
 * Formats an ISO date string to natural speech format
 * Example: "2026-02-10" -> "February 10, 2026"
 */
export function formatDateLong(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return isoDate;
  }
}

/**
 * Formats a date range for natural speech
 * Example: ("2026-02-10", "2026-02-14") -> "February 10 to 14, 2026" or "February 10 to March 2, 2026"
 */
export function formatDateRange(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    
    const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'long' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    
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

// Peak season calendar for pricing context — expanded with real-world events
const PEAK_SEASONS = [
  // Miami
  { name: 'Art Basel Miami', start: '12-01', end: '12-08', location: 'Miami', surge: 1.35 },
  { name: 'Miami Boat Show', start: '02-12', end: '02-16', location: 'Miami', surge: 1.30 },
  { name: 'Ultra Music Festival', start: '03-28', end: '03-30', location: 'Miami', surge: 1.35 },
  { name: 'Miami Grand Prix', start: '05-02', end: '05-04', location: 'Miami', surge: 1.40 },
  { name: 'Miami Open Tennis', start: '03-17', end: '03-30', location: 'Miami', surge: 1.25 },
  { name: 'Miami Swim Week', start: '06-01', end: '06-08', location: 'Miami', surge: 1.20 },
  { name: 'Spring Break', start: '03-10', end: '03-25', location: 'Miami', surge: 1.25 },
  // Scottsdale / Phoenix
  { name: 'Barrett-Jackson Auction', start: '01-18', end: '01-26', location: 'Scottsdale', surge: 1.35 },
  { name: 'WM Phoenix Open', start: '02-03', end: '02-09', location: 'Scottsdale', surge: 1.40 },
  { name: 'Scottsdale Arabian Horse Show', start: '02-13', end: '02-23', location: 'Scottsdale', surge: 1.20 },
  { name: 'Spring Training Baseball', start: '02-22', end: '03-25', location: 'Scottsdale', surge: 1.20 },
  { name: 'Scottsdale Arts Festival', start: '03-07', end: '03-09', location: 'Scottsdale', surge: 1.15 },
  // National holidays
  { name: 'Christmas & New Years', start: '12-20', end: '01-03', location: 'all', surge: 1.45 },
  { name: 'Super Bowl Weekend', start: '02-05', end: '02-12', location: 'all', surge: 1.50 },
  { name: 'Presidents Day Weekend', start: '02-14', end: '02-17', location: 'all', surge: 1.15 },
  { name: 'Memorial Day Weekend', start: '05-23', end: '05-26', location: 'all', surge: 1.25 },
  { name: 'Independence Day', start: '07-01', end: '07-06', location: 'all', surge: 1.30 },
  { name: 'Labor Day Weekend', start: '08-29', end: '09-01', location: 'all', surge: 1.20 },
  { name: 'Thanksgiving Week', start: '11-24', end: '11-30', location: 'all', surge: 1.30 },
  { name: 'Summer Peak', start: '06-15', end: '08-15', location: 'all', surge: 1.15 },
];

export function getCurrentPeakSeason(location?: string): { name: string; surge: number } | null {
  const now = new Date();
  const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  for (const season of PEAK_SEASONS) {
    const inRange = monthDay >= season.start && monthDay <= season.end;
    const locationMatch = season.location === 'all' || !location || season.location.toLowerCase() === location.toLowerCase();
    if (inRange && locationMatch) {
      return { name: season.name, surge: season.surge };
    }
  }
  return null;
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

export async function executeFunction(functionName: string, args: Record<string, unknown>, supabase: SupabaseClient, userId: string, teamId: string | null): Promise<ToolResult> {
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
        const { status, location } = args as { status?: string; location?: string };
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

        const { data: vehicles, error } = await query.order('created_at', { ascending: false });
        
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
        
        const vehicleList = vehicleData.map((v: Vehicle) => ({
          name: `${v.year} ${v.make} ${v.model}`,
          status: v.status,
          location: v.location || 'Miami',
          rate: `$${v.daily_rate || v.current_rate} per day`,
          utilization: `${(v.utilization || 0)}% utilized`,
          revenue: `$${Number(v.revenue || 0).toFixed(0)} total revenue`
        }));

        // Group by location for summary
        const locationGroups = vehicleData.reduce((acc: Record<string, number>, v: Vehicle) => {
          const loc = v.location || 'Miami';
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
        const { status, start_date, end_date, location, date } = args;
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
        const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd   = new Date(); todayEnd.setUTCHours(23, 59, 59, 999);
        let windowStart: Date | null = null;
        let windowEnd: Date | null = null;
        let windowLabel: string | null = null;

        const keyword = (typeof date === 'string' ? date.toLowerCase().trim() : '')
          || (synonym?.window === 'today' ? 'today' : '')
          || (synonym?.window === 'future' ? 'upcoming' : '');

        if (keyword === 'today') {
          windowStart = todayStart; windowEnd = todayEnd;
          windowLabel = `today (${todayStart.toISOString().slice(0,10)})`;
        } else if (keyword === 'tomorrow') {
          windowStart = new Date(todayStart.getTime() + 86400000);
          windowEnd   = new Date(todayEnd.getTime()   + 86400000);
          windowLabel = `tomorrow (${windowStart.toISOString().slice(0,10)})`;
        } else if (keyword === 'this_week' || keyword === 'week') {
          windowStart = todayStart;
          windowEnd   = new Date(todayEnd.getTime() + 6 * 86400000);
          windowLabel = `this week (${windowStart.toISOString().slice(0,10)} → ${windowEnd.toISOString().slice(0,10)})`;
        } else if (keyword === 'upcoming' || keyword === 'future') {
          windowStart = todayStart; windowEnd = null;
          windowLabel = `upcoming (from ${todayStart.toISOString().slice(0,10)})`;
        } else if (start_date || end_date) {
          windowStart = start_date ? new Date(start_date) : null;
          windowEnd   = end_date   ? new Date(end_date)   : null;
          windowLabel = `${start_date || '…'} → ${end_date || '…'}`;
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
          .limit(30);

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
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'Unknown vehicle';
          const customerName = b.customers?.full_name || b.customer_name || 'Unknown';
          const totalAmount = Number(b.total_value || b.total_amount || 0);
          return {
            customer: customerName,
            vehicle: vehicleName,
            location: b.vehicles?.location || 'Miami',
            dates: formatDateRange(b.start_date, b.end_date),
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
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'a vehicle';
          const customerName = b.customers?.full_name || b.customer_name || 'A customer';
          const amountVal = Number(b.total_value || b.total_amount || 0);
          
          return {
            description: `${customerName} booked ${vehicleName} for ${formatUsdWords(amountVal)}`,
            location: b.vehicles?.location || 'Miami',
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
        
        const window = resolveTimeframeWindow(timeframe);

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
        const avgUtilization = vehicles.length > 0 
          ? vehicles.reduce((sum, v) => sum + ((v.utilization || 0) || 0), 0) / vehicles.length 
          : 0;

        // Check for peak season
        const peakSeason = getCurrentPeakSeason(location);

        console.log(`[getFleetMetrics] Results - Vehicles: ${vehicles.length}, Active Bookings: ${activeBookings}, Revenue: $${totalRevenue}`);

        return {
          totalVehicles: vehicles.length,
          activeBookings,
          totalBookings: bookings.length,
          revenue: formatUsdWords(totalRevenue),
          revenueRaw: totalRevenue,
          averageUtilization: `${avgUtilization.toFixed(0)}%`,
          location: location || 'all',
          timeframe,
          peakSeason: peakSeason?.name || null,
          surgePricing: peakSeason?.surge || 1.0,
          summary: `${location ? `${location} fleet` : 'Your fleet'} has ${vehicles.length} vehicles with ${activeBookings} active bookings and ${formatUsdWords(totalRevenue)} in revenue for the ${timeframe || 'period'}.${peakSeason ? ` Currently in ${peakSeason.name} with ${((peakSeason.surge - 1) * 100).toFixed(0)}% surge pricing recommended.` : ''}`
        };
      }

      case "getLocationMetrics": {
        const { location } = args;
        console.log(`[getLocationMetrics] Team: ${teamId}, Location: ${location || 'all'}`);
        
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
        
        // Group by location
        const locationStats: Record<string, any> = {};
        
        for (const vehicle of allVehicles) {
          const loc = vehicle.location || 'Miami';
          if (!locationStats[loc]) {
            locationStats[loc] = {
              location: loc,
              vehicleCount: 0,
              totalRevenue: 0,
              totalUtilization: 0,
              avgRate: 0,
              vehicles: []
            };
          }
          locationStats[loc].vehicleCount++;
          locationStats[loc].totalRevenue += Number(vehicle.revenue || 0);
          locationStats[loc].totalUtilization += vehicle.utilization || 0;
          locationStats[loc].avgRate += Number(vehicle.current_rate || vehicle.daily_rate || 0);
          locationStats[loc].vehicles.push({
            name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            status: vehicle.status,
            utilization: vehicle.utilization || 0,
            rate: vehicle.current_rate || vehicle.daily_rate
          });
        }
        
        // Calculate averages
        for (const loc of Object.keys(locationStats)) {
          const stats = locationStats[loc];
          stats.avgUtilization = stats.totalUtilization / stats.vehicleCount;
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
          const loc = booking.vehicles?.location || 'Miami';
          if (locationStats[loc]) {
            locationStats[loc].activeBookings = (locationStats[loc].activeBookings || 0) + 1;
          }
        }
        
        // Check peak season for each location
        for (const loc of Object.keys(locationStats)) {
          const peakSeason = getCurrentPeakSeason(loc);
          locationStats[loc].peakSeason = peakSeason?.name || null;
          locationStats[loc].surgePricing = peakSeason?.surge || 1.0;
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
              avgUtilization: `${stats.avgUtilization.toFixed(0)}%`,
              avgRate: `$${stats.avgRate.toFixed(0)}`,
              activeBookings: stats.activeBookings || 0,
              peakSeason: stats.peakSeason,
              surgePricing: stats.surgePricing,
              topVehicles: stats.vehicles.slice(0, 5),
              summary: `${stats.location} has ${stats.vehicleCount} vehicles with ${formatUsdWords(stats.totalRevenue)} total revenue, ${stats.avgUtilization.toFixed(0)}% average utilization, and ${stats.activeBookings || 0} active bookings.${stats.peakSeason ? ` Currently in ${stats.peakSeason} peak season.` : ''}`
            };
          }
        }
        
        // Return all locations
        const locations = Object.values(locationStats);
        return {
          locationCount: locations.length,
          locations: locations.map((l: any) => ({
            location: l.location,
            vehicleCount: l.vehicleCount,
            totalRevenue: formatUsdWords(l.totalRevenue),
            totalRevenueRaw: l.totalRevenue,
            avgUtilization: `${l.avgUtilization.toFixed(0)}%`,
            avgRate: `$${l.avgRate.toFixed(0)}`,
            activeBookings: l.activeBookings || 0,
            peakSeason: l.peakSeason
          })),
          summary: `Your fleet spans ${locations.length} location${locations.length > 1 ? 's' : ''}: ${locations.map((l: any) => `${l.location} (${l.vehicleCount} vehicles, ${formatUsdWords(l.totalRevenue)} revenue)`).join('; ')}.`
        };
      }

      case "getPaymentSummary": {
        const { status, timeframe, location } = args;
        console.log(`[getPaymentSummary] Team: ${teamId}, Status: ${status || 'all'}, Timeframe: ${timeframe || 'all'}, Location: ${location || 'all'}`);
        
        // Payments are events, not rentals: created_at IS the correct axis here.
        const window = resolveTimeframeWindow(timeframe);
        
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
        const { vehicleName, includeBookings } = args;
        
        let vehicleQuery = supabase
          .from('vehicles')
          .select('*');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: vehicle } = await vehicleQuery
          .or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`)
          .limit(1)
          .maybeSingle();

        if (!vehicle) return { 
          error: "Vehicle not found",
          summary: `I couldn't find a vehicle matching "${vehicleName}" in your fleet.`
        };

        const fullName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
        let bookingsData = null;
        if (includeBookings) {
          const { data: bookings } = await supabase
            .from('bookings')
            .select('*, customers(full_name)')
            .eq('vehicle_id', vehicle.id)
            .order('start_date', { ascending: false })
            .limit(5);
          bookingsData = bookings?.map(b => {
            const customerName = b.customers?.full_name || b.customer_name || 'Unknown';
            return {
              customer: customerName,
              dates: `${new Date(b.start_date).toLocaleDateString()} to ${new Date(b.end_date).toLocaleDateString()}`,
              status: b.status,
              amount: `$${Number(b.total_value || b.total_amount || 0).toFixed(0)}`
            };
          });
        }

        return { 
          vehicle: {
            name: fullName,
            status: vehicle.status,
            location: vehicle.location || 'Miami',
            rate: `$${vehicle.current_rate || vehicle.daily_rate} per day`,
            suggestedRate: vehicle.suggested_rate ? `$${vehicle.suggested_rate}` : null,
            utilization: `${vehicle.utilization || 0}% utilization`,
            revenue: `$${Number(vehicle.revenue || 0).toFixed(0)} total revenue`,
            licensePlate: vehicle.license_plate,
            vin: vehicle.vin
          },
          bookings: bookingsData,
          summary: `${fullName} in ${vehicle.location || 'Miami'} is currently ${vehicle.status}, priced at $${vehicle.current_rate || vehicle.daily_rate} per day with ${vehicle.utilization || 0}% utilization.`
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
              vehicle: b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'Unknown',
              location: b.vehicles?.location || 'Miami',
              dates: `${new Date(b.start_date).toLocaleDateString()} to ${new Date(b.end_date).toLocaleDateString()}`,
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
            vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            location: vehicle.location,
            rate: `$${vehicle.current_rate}`,
            available: !conflicts || conflicts.length === 0,
            conflicts: conflicts?.map(c => ({
              dates: `${new Date(c.start_date).toLocaleDateString()} to ${new Date(c.end_date).toLocaleDateString()}`,
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
        const window = resolveTimeframeWindow(timeframe);

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
        const { metric, limit = 5, location } = args;
        
        if (metric === 'revenue' || metric === 'utilization') {
          let query = supabase
            .from('vehicles')
            .select('name, make, model, year, revenue, utilization, location');
          
          if (teamId) {
            query = query.eq('team_id', teamId);
          }
          
          if (location && location !== 'all') {
            query = query.ilike('location', `%${location}%`);
          }
          
          const { data: vehicles } = await query
            .order(metric === 'utilization' ? 'utilization' : 'revenue', { ascending: false })
            .limit(limit);
          
          const performers = vehicles?.map(v => {
            const rev = Number(v.revenue || 0);
            return {
              name: `${v.year} ${v.make} ${v.model}`,
              location: v.location,
              revenue: formatUsdWords(rev),
              revenueRaw: rev,
              utilization: `${v.utilization || 0}%`
            };
          }) || [];
          
          return { 
            metric, 
            performers,
            summary: `Top ${performers.length} vehicles by ${metric}${location ? ` in ${location}` : ''}: ${performers.map(p => `${p.name} (${metric === 'revenue' ? p.revenue : p.utilization})`).join(', ')}.`
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
        const { status, daysRange, location } = args;
        let query = supabase
          .from('bookings')
          .select('*, vehicles(make, model, year, location), customers(full_name)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        if (status) query = query.eq('status', status);
        
        if (daysRange) {
          const dateFilter = new Date();
          dateFilter.setDate(dateFilter.getDate() - daysRange);
          query = query.gte('start_date', dateFilter.toISOString());
        }

        const { data: bookings } = await query.order('start_date', { ascending: false }).limit(30);
        
        let filteredBookings = bookings || [];
        if (location && location !== 'all') {
          filteredBookings = filteredBookings.filter((b: any) => 
            b.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        const bookingList = filteredBookings.map(b => {
          const vehicleName = b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'vehicle';
          const amt = Number(b.total_value || b.total_amount || 0);
          return {
            customer: b.customers?.full_name || b.customer_name || 'Unknown',
            vehicle: vehicleName,
            location: b.vehicles?.location || 'Miami',
            dates: formatDateRange(b.start_date, b.end_date),
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
          summary: `Found ${filteredBookings.length} bookings${status ? ` with ${status} status` : ''}${location ? ` in ${location}` : ''}${daysRange ? ` in the last ${daysRange} days` : ''}. Total value: ${formatUsdWords(totalValue)}.`
        };
      }

      case "getDamageReports": {
        const { status, location } = args;
        let query = supabase
          .from('damage_claims')
          .select('*, vehicles(make, model, year, location)');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }

        if (status && status !== 'all') query = query.eq('claim_status', status);

        const { data: claims } = await query.order('reported_date', { ascending: false });
        
        let filteredClaims = claims || [];
        if (location && location !== 'all') {
          filteredClaims = filteredClaims.filter((c: any) => 
            c.vehicles?.location?.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        const claimList = filteredClaims.map(c => ({
          vehicle: c.vehicles ? `${c.vehicles.year} ${c.vehicles.make} ${c.vehicles.model}` : 'Unknown',
          location: c.vehicles?.location || 'Miami',
          severity: c.severity,
          status: c.claim_status,
          estimatedCost: c.estimated_cost ? `$${c.estimated_cost}` : 'TBD',
          reportedDate: new Date(c.reported_date).toLocaleDateString()
        }));
        
        return { 
          claims: claimList, 
          count: filteredClaims.length,
          summary: `You have ${filteredClaims.length} damage report${filteredClaims.length !== 1 ? 's' : ''}${status && status !== 'all' ? ` with ${status} status` : ''}${location ? ` in ${location}` : ''}.`
        };
      }

      case "getUpcomingMaintenance": {
        const { daysAhead = 30, location } = args;
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
        
        const maintenanceList = filteredMaintenance.map(m => ({
          vehicle: m.vehicles ? `${m.vehicles.year} ${m.vehicles.make} ${m.vehicles.model}` : 'Unknown',
          location: m.vehicles?.location || 'Miami',
          type: m.maintenance_type,
          scheduledDate: new Date(m.scheduled_date).toLocaleDateString(),
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
        const { customerName } = args;
        
        let query = supabase
          .from('customers')
          .select('full_name, lifetime_value, total_bookings, customer_status');
        
        if (teamId) {
          query = query.eq('team_id', teamId);
        }
        
        const { data: customer } = await query
          .ilike('full_name', `%${customerName}%`)
          .maybeSingle();

        if (!customer) return { 
          error: "Customer not found",
          summary: `I couldn't find a customer matching "${customerName}".`
        };

        const ltv = Number(customer.lifetime_value || 0);
        return { 
          customer: {
            name: customer.full_name,
            status: customer.customer_status,
            totalBookings: customer.total_bookings || 0,
            lifetimeValue: formatUsdWords(ltv),
            lifetimeValueRaw: ltv
          },
          summary: `${customer.full_name} is a ${customer.customer_status || 'regular'} customer with ${customer.total_bookings || 0} bookings and ${formatUsdWords(ltv)} lifetime value.`
        };
      }

      case "getVaultDocuments": {
        const { category, status } = args;

        let docsQuery = supabase
          .from('documents')
          .select('id, name, type, status, expires_at, verification_status, vehicles(make, model, year)')
          .eq('team_id', teamId)
          .order('expires_at', { ascending: true, nullsFirst: false })
          .limit(50);

        if (category) docsQuery = docsQuery.eq('type', category);
        if (status) docsQuery = docsQuery.eq('status', status);

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
            ? `${d.vehicles.year || ''} ${d.vehicles.make || ''} ${d.vehicles.model || ''}`.trim()
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
          summary = category || status
            ? `No documents match that filter.`
            : `There are no documents in your vault yet.`;
        } else {
          summary = `Found ${documents.length} document${documents.length === 1 ? '' : 's'}`;
          if (expired) summary += `, ${expired} expired`;
          if (expiringSoon) summary += `, ${expiringSoon} expiring within 30 days`;
          summary += '.';
        }

        console.log(`[getVaultDocuments] team ${teamId}: ${documents.length} docs (${expired} expired, ${expiringSoon} expiring)`);
        return { documents, expired, expiringSoon, summary };
      }


      case "getDemandForecast": {
        const { city = 'miami', days = 14, location } = args;
        const effectiveLocation = location || city;
        console.log(`[getDemandForecast] Team: ${teamId}, Location: ${effectiveLocation}, Days: ${days}`);
        
        // Check for peak season
        const peakSeason = getCurrentPeakSeason(effectiveLocation);
        
        let demandMultiplier = peakSeason?.surge || 1.0;
        
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
          location: effectiveLocation,
          forecastDays: days,
          demandMultiplier,
          peakSeason: peakSeason?.name || null,
          upcomingBookings,
          upcomingRevenue: formatUsdWords(upcomingRevenue),
          upcomingRevenueRaw: upcomingRevenue,
          summary: peakSeason 
            ? `${effectiveLocation} is currently in ${peakSeason.name} peak season with a ${((peakSeason.surge - 1) * 100).toFixed(0)}% surge multiplier. You have ${upcomingBookings} bookings worth ${formatUsdWords(upcomingRevenue)} coming up.`
            : `Standard demand period for ${effectiveLocation}. You have ${upcomingBookings} bookings worth ${formatUsdWords(upcomingRevenue)} coming up.`
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
        const utilization = vehicle.utilization || 0;
        const vehicleLocation = vehicle.location || 'Miami';
        
        // Check for peak season
        const peakSeason = getCurrentPeakSeason(vehicleLocation);
        
        // Calculate recommendation
        let suggestedRate = currentRate;
        const factors: string[] = [];
        
        // Utilization-based pricing
        if (utilization > 80) {
          suggestedRate *= 1.15;
          factors.push(`high demand at ${utilization}% utilization`);
        } else if (utilization < 50) {
          suggestedRate *= 0.95;
          factors.push(`low utilization at ${utilization}%`);
        }
        
        // Peak season adjustment
        if (peakSeason) {
          suggestedRate *= peakSeason.surge;
          factors.push(`${peakSeason.name} peak season (${((peakSeason.surge - 1) * 100).toFixed(0)}% surge)`);
        }
        
        // Use suggested_rate from DB if available
        if (vehicle.suggested_rate && Math.abs(vehicle.suggested_rate - suggestedRate) < 100) {
          suggestedRate = vehicle.suggested_rate;
        }
        
        suggestedRate = Math.round(suggestedRate / 5) * 5;
        const difference = suggestedRate - currentRate;
        const percentChange = ((difference / currentRate) * 100).toFixed(1);
        
        return {
          vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          location: vehicleLocation,
          currentRate: `$${currentRate}`,
          suggestedRate: `$${suggestedRate}`,
          difference: difference > 0 ? `+$${difference}` : `$${difference}`,
          percentChange: difference > 0 ? `+${percentChange}%` : `${percentChange}%`,
          factors,
          peakSeason: peakSeason?.name || null,
          monthlyImpact: `$${Math.abs(difference * 20).toFixed(0)}/month`,
          summary: suggestedRate > currentRate 
            ? `I recommend increasing the rate for your ${vehicle.year} ${vehicle.make} ${vehicle.model} in ${vehicleLocation} from $${currentRate} to $${suggestedRate} per day, a ${percentChange}% increase. This is based on ${factors.join(' and ')}. This could add approximately $${Math.abs(difference * 20).toFixed(0)} per month in revenue.`
            : suggestedRate < currentRate
              ? `Consider reducing the rate for your ${vehicle.year} ${vehicle.make} ${vehicle.model} in ${vehicleLocation} from $${currentRate} to $${suggestedRate} per day to boost bookings. This is based on ${factors.join(' and ')}.`
              : `The current rate of $${currentRate} for your ${vehicle.year} ${vehicle.make} ${vehicle.model} in ${vehicleLocation} appears optimal given current market conditions.`
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
        const avgRate = vehicles.reduce((sum, v) => sum + Number(v.current_rate || v.daily_rate || 0), 0) / totalVehicles;
        const avgUtilization = vehicles.reduce((sum, v) => sum + (v.utilization || 0), 0) / totalVehicles;
        const totalRevenue = vehicles.reduce((sum, v) => sum + Number(v.revenue || 0), 0);
        
        // Find under and over-utilized vehicles
        const underUtilized = vehicles.filter(v => (v.utilization || 0) < 50);
        const highPerformers = vehicles.filter(v => (v.utilization || 0) > 75);
        
        // Check for peak season
        const peakSeason = getCurrentPeakSeason(location);
        
        // Group by location
        const byLocation = vehicles.reduce((acc, v) => {
          const loc = v.location || 'Miami';
          if (!acc[loc]) {
            acc[loc] = { count: 0, revenue: 0, avgRate: 0 };
          }
          acc[loc].count++;
          acc[loc].revenue += Number(v.revenue || 0);
          acc[loc].avgRate += Number(v.current_rate || v.daily_rate || 0);
          return acc;
        }, {} as Record<string, { count: number; revenue: number; avgRate: number }>);
        
        for (const loc of Object.keys(byLocation)) {
          byLocation[loc].avgRate = byLocation[loc].avgRate / byLocation[loc].count;
        }
        
        return {
          totalVehicles,
          averageRate: `$${avgRate.toFixed(0)}`,
          averageUtilization: `${avgUtilization.toFixed(0)}%`,
          totalFleetRevenue: formatUsdWords(totalRevenue),
          totalFleetRevenueRaw: totalRevenue,
          underUtilizedCount: underUtilized.length,
          highPerformerCount: highPerformers.length,
          location: location || 'all',
          peakSeason: peakSeason?.name || null,
          surgePricing: peakSeason?.surge || 1.0,
          byLocation: Object.entries(byLocation).map(([loc, stats]) => ({
            location: loc,
            vehicleCount: stats.count,
            revenue: formatUsdWords(stats.revenue),
            revenueRaw: stats.revenue,
            avgRate: `$${stats.avgRate.toFixed(0)}`
          })),
          topPerformers: highPerformers.slice(0, 3).map(v => ({
            name: `${v.year} ${v.make} ${v.model}`,
            location: v.location,
            utilization: `${v.utilization || 0}%`,
            rate: `$${v.current_rate || v.daily_rate}`
          })),
          recommendations: underUtilized.length > 0 
            ? `${underUtilized.length} vehicles are under-utilized and may benefit from price adjustments.`
            : 'Fleet pricing looks healthy!',
          summary: `Your fleet${location ? ` in ${location}` : ''} has ${totalVehicles} vehicles with an average daily rate of $${avgRate.toFixed(0)} and ${avgUtilization.toFixed(0)}% average utilization. Total fleet revenue is ${formatUsdWords(totalRevenue)}. ${highPerformers.length} vehicles are performing above 75% utilization, while ${underUtilized.length} are below 50%.${peakSeason ? ` Currently in ${peakSeason.name} peak season.` : ''}`
        };
      }

      case "getEventImpact": {
        const { eventName, location } = args;
        console.log(`[getEventImpact] Searching for event: ${eventName}, Location: ${location}`);
        
        // Check peak seasons calendar first
        const peakSeason = PEAK_SEASONS.find(s => 
          s.name.toLowerCase().includes(eventName.toLowerCase()) ||
          eventName.toLowerCase().includes(s.name.toLowerCase())
        );
        
        if (peakSeason) {
          return {
            searched: eventName,
            eventName: peakSeason.name,
            dates: `${peakSeason.start} to ${peakSeason.end}`,
            location: peakSeason.location,
            surgePricing: peakSeason.surge,
            impact: `${((peakSeason.surge - 1) * 100).toFixed(0)}% surge pricing recommended`,
            recommendation: `During ${peakSeason.name}, increase rates by ${((peakSeason.surge - 1) * 100).toFixed(0)}% to capture peak demand. Ensure high-value vehicles are available.`,
            summary: `${peakSeason.name} runs from ${peakSeason.start} to ${peakSeason.end} in ${peakSeason.location}. I recommend a ${((peakSeason.surge - 1) * 100).toFixed(0)}% price surge during this period to maximize revenue.`
          };
        }
        
        return {
          searched: eventName,
          impact: "Events typically increase demand by 15-30% in the surrounding area",
          recommendation: "Consider adjusting rates 2-3 days before major events to capture increased demand",
          summary: `For events like "${eventName}", you can expect increased demand for luxury vehicle rentals. I recommend raising rates by 15-25% during peak event days and ensuring your highest-demand vehicles are available.`
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
        const { vehicleName } = args;
        
        const specsDatabase: Record<string, any> = {
          "ferrari sf90": {
            make: "Ferrari", model: "SF90 Stradale", engine: "4.0L V8 + Electric Motors",
            horsepower: "986 hp", torque: "590 lb-ft", acceleration: "2.5 sec (0-60 mph)",
            topSpeed: "211 mph", drivetrain: "AWD", weight: "3,461 lbs"
          },
          "lamborghini aventador": {
            make: "Lamborghini", model: "Aventador SVJ", engine: "6.5L V12",
            horsepower: "770 hp", torque: "531 lb-ft", acceleration: "2.8 sec (0-60 mph)",
            topSpeed: "217 mph", drivetrain: "AWD", weight: "3,362 lbs"
          },
          "mclaren 720s": {
            make: "McLaren", model: "720S Spider", engine: "4.0L Twin-Turbo V8",
            horsepower: "710 hp", torque: "568 lb-ft", acceleration: "2.8 sec (0-60 mph)",
            topSpeed: "212 mph", drivetrain: "RWD", weight: "3,128 lbs"
          },
          "bugatti chiron": {
            make: "Bugatti", model: "Chiron Sport", engine: "8.0L Quad-Turbo W16",
            horsepower: "1,479 hp", torque: "1,180 lb-ft", acceleration: "2.4 sec (0-60 mph)",
            topSpeed: "261 mph", drivetrain: "AWD", weight: "4,400 lbs"
          },
          "porsche 911": {
            make: "Porsche", model: "911 Turbo S", engine: "3.7L Twin-Turbo Flat-6",
            horsepower: "640 hp", torque: "590 lb-ft", acceleration: "2.6 sec (0-60 mph)",
            topSpeed: "205 mph", drivetrain: "AWD", weight: "3,636 lbs"
          },
          "rolls-royce": {
            make: "Rolls-Royce", model: "Phantom", engine: "6.75L Twin-Turbo V12",
            horsepower: "563 hp", torque: "664 lb-ft", acceleration: "5.1 sec (0-60 mph)",
            topSpeed: "155 mph", drivetrain: "RWD", weight: "5,644 lbs"
          }
        };

        const searchKey = vehicleName.toLowerCase();
        const spec = Object.keys(specsDatabase).find(key => searchKey.includes(key) || key.includes(searchKey));
        
        if (spec) {
          const specData = specsDatabase[spec];
          return {
            ...specData,
            summary: `The ${specData.make} ${specData.model} features a ${specData.engine} producing ${specData.horsepower} and ${specData.torque}. It does 0-60 in ${specData.acceleration} with a top speed of ${specData.topSpeed}.`
          };
        }
        return { 
          error: "Vehicle specs not found in database", 
          searched: vehicleName,
          summary: `I don't have detailed specs for "${vehicleName}" in my database. Try asking about Ferrari SF90, Lamborghini Aventador, McLaren 720S, Bugatti Chiron, Porsche 911, or Rolls-Royce.`
        };
      }

      case "logFeedback": {
        const { feedbackType, keywords, userQuery, rariResponse, context } = args;
        console.log(`[logFeedback] Logging feedback: ${feedbackType}`);
        
        const { error } = await supabase
          .from('rari_feedback')
          .insert({
            user_id: userId,
            feedback_type: feedbackType || 'feature_request',
            keywords: keywords ? keywords.split(',').map((k: string) => k.trim()) : [],
            user_query: userQuery,
            rari_response: rariResponse,
            context: context ? JSON.parse(context) : null
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
          summary: "I've logged your feedback. This feature is coming soon, and the team will review your request. Is there anything else I can help you with?"
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
        const window = resolveTimeframeWindow(timeframe);
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
          totals: {
            grossRevenue: formatUsdWords(totalGross),
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
          .select('id, name, make, model, location, current_rate, utilization, revenue, status');
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (!vehicles || vehicles.length === 0) {
          return { summary: "You don't have any vehicles to compare." };
        }
        
        // Group by location
        const locationData: Record<string, any> = {};
        
        for (const vehicle of vehicles) {
          const loc = vehicle.location || 'Miami';
          if (!locationData[loc]) {
            locationData[loc] = {
              location: loc,
              vehicleCount: 0,
              availableCount: 0,
              rentedCount: 0,
              totalRevenue: 0,
              totalUtilization: 0,
              avgRate: 0
            };
          }
          
          locationData[loc].vehicleCount++;
          locationData[loc].totalUtilization += (vehicle.utilization || 0);
          locationData[loc].totalRevenue += Number(vehicle.revenue || 0);
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
          avgUtilization: `${(loc.totalUtilization / loc.vehicleCount).toFixed(0)}%`,
          avgRate: `$${(loc.avgRate / loc.vehicleCount).toFixed(0)}`
        }));
        
        // Sort by revenue
        locations.sort((a, b) => parseFloat(b.revenue.replace('$', '')) - parseFloat(a.revenue.replace('$', '')));
        
        return {
          locations,
          locationCount: locations.length,
          summary: `Location comparison: ${locations.map(l => `${l.location} (${l.vehicleCount} vehicles, ${l.revenue} revenue, ${l.avgUtilization} utilization)`).join('; ')}.`
        };
      }

      case "getOutstandingBalances": {
        const { location, minAmount } = args;
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
        
        const outstandingList = filteredBookings.map((b: any) => {
          const endDate = new Date(b.end_date);
          const daysOverdue = Math.floor((new Date().getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            customer: b.customers?.full_name || b.customer_name || 'Unknown',
            vehicle: b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'Unknown',
            location: b.vehicles?.location || 'Miami',
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
          .select('id, name, make, model, year, location, current_rate, utilization')
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
        
        const idleVehicles = vehicles
          .filter((v: any) => !recentlyBookedIds.has(v.id))
          .map((v: any) => ({
            vehicle: `${v.year} ${v.make} ${v.model}`,
            location: v.location || 'Miami',
            currentRate: `$${v.current_rate}`,
            utilization: `${v.utilization || 0}%`,
            recommendation: (v.utilization || 0) < 20 ? 'Consider 10-15% price reduction' : 'Run promotion'
          }));
        
        const potentialLoss = idleVehicles.reduce((sum: number, v: any) => 
          sum + (parseFloat(v.currentRate.replace('$', '')) * daysIdle), 0
        );
        
        return {
          idleVehicles,
          count: idleVehicles.length,
          totalVehicles: vehicles.length,
          potentialRevenueLoss: `$${potentialLoss.toFixed(0)}`,
          daysThreshold: daysIdle,
          summary: idleVehicles.length > 0
            ? `${idleVehicles.length} of ${vehicles.length} vehicles are idle (no bookings in ${daysIdle} days)${location ? ` in ${location}` : ''}. Potential revenue loss: $${potentialLoss.toFixed(0)}. Most idle: ${idleVehicles[0]?.vehicle}. ${idleVehicles[0]?.recommendation}.`
            : `Great news! All ${vehicles.length} vehicles${location ? ` in ${location}` : ''} have been active in the last ${daysIdle} days.`
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
          
          const loc = vehicle.location || 'Miami';
          if (!byLocation[loc]) byLocation[loc] = [];
          
          byLocation[loc].push({
            vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
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
        
        // Check for idle vehicles
        let vehicleQuery = supabase
          .from('vehicles')
          .select('name, make, model, year, location, utilization, status')
          .eq('status', 'available')
          .lt('utilization', 30);
        
        if (teamId) {
          vehicleQuery = vehicleQuery.eq('team_id', teamId);
        }
        
        const { data: vehicles } = await vehicleQuery;
        
        if (vehicles && vehicles.length > 0) {
          insights.push({
            type: 'utilization',
            priority: 'medium',
            title: `${vehicles.length} vehicles with low utilization`,
            description: `${vehicles.slice(0, 3).map((v: any) => `${v.make} ${v.model}`).join(', ')} have under 30% utilization`,
            action: 'Consider price adjustments or promotions'
          });
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
        
        // Check peak season
        const peakSeason = getCurrentPeakSeason();
        if (peakSeason) {
          insights.push({
            type: 'pricing',
            priority: 'high',
            title: `${peakSeason.name} peak season active`,
            description: `Demand is elevated. Recommended ${((peakSeason.surge - 1) * 100).toFixed(0)}% surge pricing.`,
            action: 'Review and adjust vehicle rates'
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
        let vQ = supabase.from('vehicles').select('id, year, make, model, status, location, current_rate, utilization');
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
          if (live) { liveState = 'on rent'; detail = `with ${live.customer_name}${live.booking_ref ? ` (${live.booking_ref})` : ''} until ${new Date(live.end_date).toLocaleDateString()}`; }
          else if (mw) { liveState = 'in maintenance'; detail = mw.reason || ''; }
          else if (v.status === 'retired') liveState = 'retired';
          return {
            vehicle: `${v.year} ${v.make} ${v.model}`,
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
        const todayStart = new Date(); todayStart.setUTCHours(0,0,0,0);
        const todayEnd   = new Date(); todayEnd.setUTCHours(23,59,59,999);
        const nowIso = new Date().toISOString();
        const teamFilter = (q: any) => teamId ? q.eq('team_id', teamId) : q;

        const [{ data: checkOuts }, { data: checkIns }, { data: overdue }, { data: maint }] = await Promise.all([
          teamFilter(supabase.from('bookings').select('booking_ref, customer_name, customer_phone, vehicle_name, start_date, pickup_location, status').gte('start_date', todayStart.toISOString()).lte('start_date', todayEnd.toISOString()).in('status', ['confirmed','pending']).order('start_date')),
          teamFilter(supabase.from('bookings').select('booking_ref, customer_name, customer_phone, vehicle_name, end_date, dropoff_location, status').gte('end_date', todayStart.toISOString()).lte('end_date', todayEnd.toISOString()).eq('status', 'confirmed').order('end_date')),
          teamFilter(supabase.from('bookings').select('booking_ref, customer_name, customer_phone, vehicle_name, end_date').lt('end_date', nowIso).eq('status', 'confirmed').order('end_date')).limit(20),
          teamFilter(supabase.from('maintenance_windows').select('vehicle_id, start_at, end_at, reason').gte('start_at', todayStart.toISOString()).lte('start_at', todayEnd.toISOString())),
        ]);

        return {
          date: todayStart.toISOString().slice(0,10),
          check_outs: (checkOuts || []).map((b: any) => ({ ref: b.booking_ref, customer: b.customer_name, phone: b.customer_phone, vehicle: b.vehicle_name, time: b.start_date, location: b.pickup_location })),
          check_ins:  (checkIns  || []).map((b: any) => ({ ref: b.booking_ref, customer: b.customer_name, phone: b.customer_phone, vehicle: b.vehicle_name, time: b.end_date, location: b.dropoff_location })),
          overdue:    (overdue   || []).map((b: any) => ({ ref: b.booking_ref, customer: b.customer_name, phone: b.customer_phone, vehicle: b.vehicle_name, was_due: b.end_date })),
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
          summary: `${data.booking_ref}: ${data.customer_name} in the ${data.vehicle_name}, ${new Date(data.start_date).toLocaleDateString()} to ${new Date(data.end_date).toLocaleDateString()}, status ${data.status}.`,
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
        const { priority } = args as { priority?: string };
        let q = supabase.from('work_orders').select('id, title, status, priority, vehicle_id, due_at, created_at, vendor_name, vehicles(year, make, model)').in('status', ['open','in_progress']).order('created_at', { ascending: true }).limit(50);
        if (teamId) q = q.eq('team_id', teamId);
        if (priority && priority !== 'all') q = q.eq('priority', priority);
        const { data, error } = await q;
        if (error) return { error: error.message };
        const list = (data || []).map((w: any) => ({
          title: w.title, status: w.status, priority: w.priority,
          vehicle: w.vehicles ? `${w.vehicles.year} ${w.vehicles.make} ${w.vehicles.model}` : 'unassigned',
          due_at: w.due_at, vendor: w.vendor_name,
        }));
        return {
          count: list.length,
          work_orders: list,
          summary: list.length ? `${list.length} open work order${list.length===1?'':'s'}. ${list.slice(0,3).map(w => `${w.title} (${w.vehicle})`).join('; ')}.` : 'No open work orders. Fleet is in good shape.',
        };
      }

      case "create_booking_hold": {
        const { vehicle_id, customer_name, customer_phone, start_date, end_date, notes } = args as any;
        if (!vehicle_id || !customer_name || !start_date || !end_date) {
          return { error: 'vehicle_id, customer_name, start_date, and end_date are required' };
        }
        let conflictQ = supabase.from('bookings').select('id, booking_ref, customer_name').eq('vehicle_id', vehicle_id).in('status', ['confirmed','pending']).lte('start_date', end_date).gte('end_date', start_date);
        if (teamId) conflictQ = conflictQ.eq('team_id', teamId);
        const { data: conflicts } = await conflictQ.limit(1);
        if (conflicts && conflicts.length) {
          return { error: 'conflict', conflict: conflicts[0], summary: `That window overlaps booking ${conflicts[0].booking_ref} for ${conflicts[0].customer_name}. Pick a different vehicle or time.` };
        }
        let veh: any = null;
        {
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
          vehicle_name: `${veh.year} ${veh.make} ${veh.model}`,
          customer_name,
          customer_phone: customer_phone || null,
          start_date,
          end_date,
          pickup_location: veh.location || 'Miami',
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
          summary: `Hold created — reference ${created.booking_ref}. ${veh.year} ${veh.make} ${veh.model} for ${customer_name}, ${days} day${days===1?'':'s'}, total $${total.toLocaleString()}. It's pending until you confirm or cancel.`,
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

