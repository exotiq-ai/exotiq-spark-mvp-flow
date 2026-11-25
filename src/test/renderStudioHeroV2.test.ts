import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The live studio render (render-studio-hero) runs the v2 recipe by default. These read the function's
// source because it runs on Deno and is not importable here; the pure parts are tested in studioHeroPlan.test.ts.
const source = readFileSync(resolve(process.cwd(), 'supabase/functions/render-studio-hero/index.ts'), 'utf8');
const v2Body = source.slice(source.indexOf('async function renderV2('), source.indexOf('async function reviewContextV2('));

describe('render-studio-hero v2', () => {
  it('runs v2 unless STUDIO_HERO_PIPELINE says v1', () => {
    expect(source).toContain('studioPipeline(Deno.env.get("STUDIO_HERO_PIPELINE"))');
    expect(source).toMatch(/if \(PIPELINE === "v2"\) \{\s*return await renderV2\(/);
  });

  it('never mirrors the source photo', () => {
    expect(v2Body.length).toBeGreaterThan(0);
    expect(v2Body).not.toContain('mirrorDataUrl');
    expect(v2Body).toContain('saveAndReview(ctx, job, prompt, renderRes, false,');
  });

  it('reserves a render only after the photo check, identity sheet and studio reference succeed', () => {
    const reserve = v2Body.indexOf("rpc('studio_reserve_attempt'");
    expect(reserve).toBeGreaterThan(0);
    expect(v2Body.indexOf('classifyDataUrl(')).toBeLessThan(reserve);
    expect(v2Body.indexOf('loadIdentitySheet(')).toBeLessThan(reserve);
    expect(v2Body.indexOf('fetchAsDataUrl(STUDIO_HERO_STYLE_REFERENCE_URL)')).toBeLessThan(reserve);
  });

  it('records the recipe version and reviews with the scored v2 review', () => {
    expect(v2Body).toContain('_version: STUDIO_RECIPE_VERSION');
    expect(v2Body).toContain('recipe_version: STUDIO_RECIPE_VERSION');
    expect(v2Body).toContain('runQcV2(');
  });

  it('only ever renders from real photos of the car', () => {
    expect(source).toContain('.filter(isRealVehiclePhoto)');
  });
});
