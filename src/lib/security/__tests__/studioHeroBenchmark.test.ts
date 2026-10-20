import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'supabase/functions/studio-hero-benchmark/index.ts'), 'utf8');

describe('Studio Hero benchmark isolation', () => {
  it('does not write vehicle photos or spend tenant render attempts', () => {
    const tableCalls = source.split(/(?=\.from\(")/).slice(1);
    const writtenTables = tableCalls
      .filter((call) => /\.(insert|upsert|update|delete)\(/.test(call))
      .map((call) => call.match(/^\.from\("([^"]+)"\)/)?.[1]);
    expect(writtenTables).not.toContain('hero_render_jobs');
    expect(writtenTables).not.toContain('vehicle_photos');
  });

  it('keeps uploaded examples out of the saved identity sheet', () => {
    expect(source).toMatch(/if \(!referenceImages\) await db\.from\("vehicle_identity_sheets"\)\.upsert/);
  });
});