import { describe, expect, it } from 'vitest';
import {
  correctionsFor,
  isRealVehiclePhoto,
  isValidIdentitySheet,
  pickRenderReferences,
  renderReferenceSplit,
  studioPipeline,
  type ClassifiedPhoto,
} from '../../supabase/functions/_shared/studioHeroPlan.ts';

const photo = (id: string, kind: string): ClassifiedPhoto<{ id: string }> => ({
  photo: { id },
  kind,
  facing: 'left',
  paint: 'red',
  matchesListedColor: true,
});

describe('studioPipeline', () => {
  it('runs v2 unless v1 is asked for explicitly', () => {
    expect(studioPipeline(undefined)).toBe('v2');
    expect(studioPipeline('')).toBe('v2');
    expect(studioPipeline('v2')).toBe('v2');
    expect(studioPipeline('nonsense')).toBe('v2');
    expect(studioPipeline('v1')).toBe('v1');
    expect(studioPipeline(' V1 ')).toBe('v1');
  });
});

describe('pickRenderReferences', () => {
  it('uses a front three-quarter photo as the main source even when it is not first', () => {
    const picked = pickRenderReferences([
      photo('side', 'exterior_other'),
      photo('fq', 'exterior_front_quarter'),
      photo('rear', 'rear'),
    ]);
    expect(picked.main?.photo.id).toBe('fq');
    expect(picked.extras.map((p) => p.photo.id)).toEqual(['side', 'rear']);
  });

  it('falls back to another full exterior view for the main source', () => {
    const picked = pickRenderReferences([photo('detail', 'detail'), photo('side', 'exterior_other')]);
    expect(picked.main?.photo.id).toBe('side');
    expect(picked.extras.map((p) => p.photo.id)).toEqual(['detail']);
  });

  it('never uses a rear, detail, interior or collage photo as the main source', () => {
    const picked = pickRenderReferences([
      photo('rear', 'rear'),
      photo('detail', 'detail'),
      photo('cabin', 'interior'),
      photo('grid', 'collage'),
    ]);
    expect(picked.main).toBeNull();
    expect(picked.extras).toEqual([]);
  });

  it('keeps interior, collage and unknown photos out of the references', () => {
    const picked = pickRenderReferences([
      photo('fq', 'exterior_front_quarter'),
      photo('cabin', 'interior'),
      photo('grid', 'collage'),
      photo('odd', 'other'),
      photo('wheel', 'detail'),
    ]);
    expect(picked.extras.map((p) => p.photo.id)).toEqual(['wheel']);
  });

  it('caps the set at four photos, main included', () => {
    const picked = pickRenderReferences([
      photo('fq', 'exterior_front_quarter'),
      photo('a', 'exterior_other'),
      photo('b', 'rear'),
      photo('c', 'detail'),
      photo('d', 'detail'),
    ]);
    expect([picked.main, ...picked.extras].map((p) => p?.photo.id)).toEqual(['fq', 'a', 'b', 'c']);
  });

  it('honours a main photo chosen by Exotiq support', () => {
    const picked = pickRenderReferences(
      [photo('fq', 'exterior_front_quarter'), photo('side', 'exterior_other')],
      { mainId: 'side', idOf: (p) => p.id },
    );
    expect(picked.main?.photo.id).toBe('side');
    expect(picked.extras.map((p) => p.photo.id)).toEqual(['fq']);
  });
});

describe('renderReferenceSplit', () => {
  it('renders from the main photo plus at most two extras; the identity sheet and review see up to three', () => {
    const refs = ['main', 'a', 'b', 'c'];
    expect(renderReferenceSplit(refs)).toEqual({ source: 'main', extras: ['a', 'b'], review: ['main', 'a', 'b'] });
    expect(renderReferenceSplit(['main'])).toEqual({ source: 'main', extras: [], review: ['main'] });
  });
});

describe('correctionsFor', () => {
  const v1 = { wrong_direction: 'FACE LEFT', paint_mismatch: 'MATCH PAINT' };
  const v2 = { wrong_wheels: 'MATCH WHEELS' };

  it('adds one correction per earlier failure, from either dictionary, without repeats', () => {
    expect(correctionsFor(['wrong_wheels', 'wrong_direction', 'wrong_wheels'], v1, v2)).toEqual([
      'MATCH WHEELS',
      'FACE LEFT',
    ]);
  });

  it('ignores codes it has no correction for', () => {
    expect(correctionsFor(['made_up', 'paint_mismatch'], v1, v2)).toEqual(['MATCH PAINT']);
  });
});

describe('isRealVehiclePhoto', () => {
  const real = { url: 'https://x/p.jpg', source: 'upload', photo_type: 'exterior', original_filename: 'IMG_0042.jpg' };

  it('accepts an uploaded exterior photo', () => {
    expect(isRealVehiclePhoto(real)).toBe(true);
    expect(isRealVehiclePhoto({ url: 'https://x/p.jpg' })).toBe(true);
  });

  it('rejects studio renders and AI-invented heroes, whatever their angle or score', () => {
    expect(isRealVehiclePhoto({ ...real, source: 'studio_render' })).toBe(false);
    expect(isRealVehiclePhoto({ ...real, source: 'generated' })).toBe(false);
    expect(isRealVehiclePhoto({ ...real, source: 'ai_generated' })).toBe(false);
    expect(isRealVehiclePhoto({ ...real, original_filename: 'generated-hero-Ferrari-Roma.png' })).toBe(false);
    expect(isRealVehiclePhoto({ ...real, original_filename: 'studio-hero-Ferrari-Roma-attempt1.png' })).toBe(false);
  });

  it('rejects interior photos and rows without a URL', () => {
    expect(isRealVehiclePhoto({ ...real, photo_type: 'interior' })).toBe(false);
    expect(isRealVehiclePhoto({ ...real, url: null })).toBe(false);
  });
});

describe('isValidIdentitySheet', () => {
  it('needs wheels, paint and an evidence list', () => {
    expect(isValidIdentitySheet({ wheels: {}, paint: {}, evidence: [] })).toBe(true);
    expect(isValidIdentitySheet({ wheels: {}, paint: {} })).toBe(false);
    expect(isValidIdentitySheet({ paint: {}, evidence: [] })).toBe(false);
    expect(isValidIdentitySheet([{ wheels: {}, paint: {}, evidence: [] }])).toBe(false);
    expect(isValidIdentitySheet(null)).toBe(false);
  });
});
