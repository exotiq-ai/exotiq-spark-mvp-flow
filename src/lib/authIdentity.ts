import type { User } from '@supabase/supabase-js';

/** The parts of a user that, when changed, should make the app re-read its data. */
const fingerprint = (u: User) =>
  JSON.stringify([u.id, u.email, u.phone, u.role, u.updated_at, u.app_metadata, u.user_metadata]);

/**
 * Keep the current user object when a new one describes the same account.
 *
 * Supabase hands back a fresh object on every session check and token refresh.
 * Dozens of hooks are keyed on `user`, so a new object with the same content
 * made the whole app fetch its data again (every dashboard load ran twice).
 */
export function keepUserIfSame(prev: User | null, next: User | null): User | null {
  if (!prev || !next) return next;
  return fingerprint(prev) === fingerprint(next) ? prev : next;
}
