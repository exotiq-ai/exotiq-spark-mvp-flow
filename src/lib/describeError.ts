// Supabase returns errors as plain objects ({ message, details, hint, code }), not Error instances, so
// `e instanceof Error ? e.message : String(e)` printed "[object Object]" (Super Admin, 2026-11-13: approving a
// marketplace request whose platform fee was not confirmed). Always surface the real message, in plain words
// where we know it.
const KNOWN: Array<[RegExp, string]> = [
  [
    /platform_fee_percent must be explicitly confirmed/i,
    'Confirm the platform fee for this team first (open the row, Marketplace readiness, Confirm platform fee), then approve.',
  ],
];

export function describeError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  let message = '';
  if (e instanceof Error) message = e.message;
  else if (typeof e === 'string') message = e;
  else if (e && typeof e === 'object') {
    const o = e as { message?: unknown; error_description?: unknown; error?: unknown; details?: unknown };
    const pick = [o.message, o.error_description, o.error, o.details].find((v) => typeof v === 'string' && v.trim());
    message = typeof pick === 'string' ? pick : '';
  }
  message = message.trim();
  if (!message || message === '[object Object]') return fallback;
  for (const [pattern, plain] of KNOWN) if (pattern.test(message)) return plain;
  return message;
}
