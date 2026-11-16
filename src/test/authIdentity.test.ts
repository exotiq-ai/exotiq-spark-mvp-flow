import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { keepUserIfSame } from '@/lib/authIdentity';

const user = (over: Partial<User> = {}): User =>
  ({
    id: 'u1',
    aud: 'authenticated',
    email: 'op@example.com',
    role: 'authenticated',
    updated_at: '2026-11-16T10:00:00Z',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Op' },
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  }) as User;

describe('keepUserIfSame', () => {
  it('keeps the existing object when the server returns the same user', () => {
    const prev = user();
    const next = user(); // equal content, different object (what getUser() returns)
    expect(keepUserIfSame(prev, next)).toBe(prev);
  });

  it('ignores fields that change on every sign-in check', () => {
    const prev = user({ last_sign_in_at: '2026-11-16T09:00:00Z' });
    const next = user({ last_sign_in_at: '2026-11-16T10:30:00Z' });
    expect(keepUserIfSame(prev, next)).toBe(prev);
  });

  it('takes the new object when the user is different', () => {
    const prev = user();
    const next = user({ id: 'u2' });
    expect(keepUserIfSame(prev, next)).toBe(next);
  });

  it('takes the new object when the account changed', () => {
    const prev = user();
    expect(keepUserIfSame(prev, user({ email: 'new@example.com' }))).not.toBe(prev);
    expect(keepUserIfSame(prev, user({ user_metadata: { full_name: 'Renamed' } }))).not.toBe(prev);
    expect(keepUserIfSame(prev, user({ updated_at: '2026-11-17T00:00:00Z' }))).not.toBe(prev);
  });

  it('handles sign-in and sign-out', () => {
    const u = user();
    expect(keepUserIfSame(null, u)).toBe(u);
    expect(keepUserIfSame(u, null)).toBeNull();
    expect(keepUserIfSame(null, null)).toBeNull();
  });
});
