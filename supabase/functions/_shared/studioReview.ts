export const REVIEW_ITEMS = ['direction', 'wheels', 'bumper_materials', 'badges', 'paint', 'roof', 'framing', 'wall', 'lighting', 'reflection'] as const;
const failures = new Set(['wrong_wheels', 'detail_mismatch', 'paint_mismatch', 'wrong_direction', 'wrong_backdrop', 'wrong_lighting', 'wrong_floor', 'wrong_orientation', 'wrong_framing']);

export function validateStudioReview(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.pass !== 'boolean' || typeof v.fidelity !== 'number' || typeof v.studio !== 'number' || !Number.isFinite(v.fidelity) || !Number.isFinite(v.studio) || v.fidelity < 0 || v.fidelity > 10 || v.studio < 0 || v.studio > 10 || !Array.isArray(v.failures) || v.failures.some((f) => typeof f !== 'string' || !failures.has(f)) || typeof v.notes !== 'string') return null;
  const checks = v.checks;
  if (!checks || typeof checks !== 'object') return null;
  const c = checks as Record<string, unknown>;
  if (REVIEW_ITEMS.some((item) => typeof c[item] !== 'boolean')) return null;
  const allPassed = REVIEW_ITEMS.every((item) => c[item] === true);
  return { pass: v.pass && v.fidelity >= 8 && v.studio >= 7 && v.failures.length === 0 && allPassed, fidelity: v.fidelity, studio: v.studio, failures: v.failures as string[], notes: v.notes, checks: c };
}

export function mergeIdentity(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = mergeIdentity(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else result[key] = value;
  }
  return result;
}

export async function identityRevision(inputs: unknown): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(inputs)));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}