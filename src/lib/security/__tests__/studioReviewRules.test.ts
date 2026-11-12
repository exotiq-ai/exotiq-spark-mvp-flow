import { describe, expect, it } from 'vitest';
import { validateStudioReview, mergeIdentity, REVIEW_ITEMS } from '../../../../supabase/functions/_shared/studioReview';

const good = () => ({ pass: true, fidelity: 8, studio: 7, failures: [], notes: 'Verified', checks: Object.fromEntries(REVIEW_ITEMS.map((k) => [k, true])) });
describe('Studio review rules', () => {
  it('requires fidelity at least 8', () => { expect(validateStudioReview({ ...good(), fidelity: 7.9 })?.pass).toBe(false); });
  it('requires studio score at least 7', () => { expect(validateStudioReview({ ...good(), studio: 6.9 })?.pass).toBe(false); });
  it('rejects any failed item even with perfect aggregate scores', () => { const v = good(); v.checks.wheels = false; expect(validateStudioReview({ ...v, fidelity: 10, studio: 10 })?.pass).toBe(false); });
  it('rejects incomplete review instead of promoting', () => { expect(validateStudioReview({ pass: true })).toBeNull(); });
  it('rejects out-of-range or malformed scores', () => { expect(validateStudioReview({ ...good(), fidelity: 11 })).toBeNull(); expect(validateStudioReview({ ...good(), studio: '10' })).toBeNull(); });
  it('accepts the exact minimum scores only with every check passed', () => { expect(validateStudioReview(good())?.pass).toBe(true); });
  it('preserves reviewed corrections across new machine observations', () => { expect(mergeIdentity({ wheels: { finish: 'black', style: 'dish' }, paint: 'black' }, { wheels: { finish: 'chrome' } })).toEqual({ wheels: { finish: 'chrome', style: 'dish' }, paint: 'black' }); });
});