import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Accounts shared across many concurrent visitors (the public demo login)
 * must NEVER be signed out with global scope — a global sign-out revokes
 * every session the account has, which is why other demo visitors' persisted
 * sessions started failing auth.getUser with `session_not_found`.
 */
export const SHARED_ACCOUNT_EMAILS = new Set(['hello@exotiq.ai']);

export const isSharedAccountEmail = (email?: string | null): boolean =>
  !!email && SHARED_ACCOUNT_EMAILS.has(email.toLowerCase());

/**
 * Sign out with the requested scope, except for shared demo accounts which
 * are always signed out locally so other visitors' sessions stay valid.
 */
export async function safeSignOut(
  client: SupabaseClient,
  scope: 'global' | 'local' | 'others' = 'global',
) {
  let effectiveScope = scope;
  try {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (isSharedAccountEmail(session?.user?.email)) {
      effectiveScope = 'local';
    }
  } catch {
    // If we can't read the session, fall back to local — revoking shared
    // sessions is the worse failure mode.
    effectiveScope = 'local';
  }
  return client.auth.signOut({ scope: effectiveScope });
}
