import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'supabase/functions/studio-hero-benchmark/index.ts'), 'utf8');

describe('Studio Hero benchmark isolation', () => {
  it('does not write vehicle photos or spend tenant render attempts', () => {
    const mutations = Array.from(source.matchAll(/\.from\("([^"]+)"\)[\s\S]*?\.(insert|upsert|update|delete)\(/g));
    expect(mutations.map((match) => match[1])).not.toContain('hero_render_jobs');
    expect(source).not.toMatch(/\.from\("vehicle_photos"\)[\s\S]*?\.(insert|upsert|update|delete)\(/);
  });

  it('keeps uploaded examples out of the saved identity sheet', () => {
    expect(source).toMatch(/if \(!referenceImages\) await db\.from\("vehicle_identity_sheets"\)\.upsert/);
  });
});