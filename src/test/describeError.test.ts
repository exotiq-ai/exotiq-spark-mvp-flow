import { describe, expect, it } from 'vitest';
import { describeError } from '@/lib/describeError';

// Found in production (2026-11-13): Super Admin "Approval failed [object Object]" for a Supabase error object.
describe('describeError', () => {
  it('reads the message of a Supabase error object', () => {
    expect(describeError({ message: 'duplicate key', code: '23505', details: null, hint: null })).toBe('duplicate key');
  });
  it('turns the platform-fee guard into an instruction', () => {
    const e = { message: 'platform_fee_percent must be explicitly confirmed (> 0 and platform_fee_confirmed_at set) before a team can be marketplace_visible', code: 'P0001' };
    expect(describeError(e)).toMatch(/^Confirm the platform fee/);
  });
  it('handles Error, string and empty input, never "[object Object]"', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
    expect(describeError('plain')).toBe('plain');
    expect(describeError({})).toBe('Something went wrong. Please try again.');
    expect(describeError(null, 'fallback')).toBe('fallback');
    expect(describeError({ foo: 1 })).not.toContain('[object Object]');
  });
});
