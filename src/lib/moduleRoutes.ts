/**
 * Central mapping between internal module IDs and URL path segments.
 * Single source of truth for all dashboard routing.
 */

const MODULE_TO_SEGMENT: Record<string, string> = {
  dashboard: '',
  book: 'bookings',
  fleet: 'fleet',
  pulse: 'pulse',
  motoriq: 'motoriq',
  core: 'fleetcopilot',
  vault: 'vault',
  settings: 'settings',
  'team-hub': 'team-hub',
  messages: 'messages',
};

const SEGMENT_TO_MODULE: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_TO_SEGMENT)
    .filter(([_, seg]) => seg !== '')
    .map(([mod, seg]) => [seg, mod])
);

// Legacy aliases
SEGMENT_TO_MODULE['optimize'] = 'motoriq';
SEGMENT_TO_MODULE['activity'] = 'team-hub';

export const MODULE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard | Exotiq.ai',
  book: 'Bookings | Exotiq.ai',
  fleet: 'Fleet | Exotiq.ai',
  pulse: 'Pulse Analytics | Exotiq.ai',
  motoriq: 'MotorIQ | Exotiq.ai',
  core: 'FleetCopilot™ | Exotiq.ai',
  vault: 'Vault | Exotiq.ai',
  settings: 'Settings | Exotiq.ai',
  'team-hub': 'Team Hub | Exotiq.ai',
  messages: 'Messages | Exotiq.ai',
};

/**
 * Convert a module ID to its dashboard path.
 * e.g. "book" → "/dashboard/bookings"
 */
export function moduleIdToPath(moduleId: string, queryParams?: Record<string, string>): string {
  const segment = MODULE_TO_SEGMENT[moduleId] ?? moduleId;
  const base = segment ? `/dashboard/${segment}` : '/dashboard';
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams(queryParams).toString();
    return `${base}?${params}`;
  }
  return base;
}

/**
 * Extract the module ID from a pathname.
 * e.g. "/dashboard/bookings" → "book", "/dashboard" → "dashboard"
 */
export function pathToModuleId(pathname: string): string {
  const match = pathname.match(/^\/dashboard\/?([^/?]*)/);
  if (!match || !match[1]) return 'dashboard';
  return SEGMENT_TO_MODULE[match[1]] ?? match[1];
}
