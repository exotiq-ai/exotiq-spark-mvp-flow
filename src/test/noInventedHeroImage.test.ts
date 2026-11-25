import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// A vehicle's hero image must come from a real photo of that vehicle (or the
// studio render made from one). The old text-to-image generator invented a
// "car like yours" from make, model and colour and showed it as the real car.
const root = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('no invented hero images', () => {
  it('nothing in the app calls the text-to-image hero generator', () => {
    const callers = sourceFiles(resolve(root, 'src'))
      .filter((file) => !file.endsWith('noInventedHeroImage.test.ts'))
      .filter((file) => /generate-hero-image|useGenerateHeroImage/.test(readFileSync(file, 'utf8')));
    expect(callers).toEqual([]);
  });

  it('the generator hook and edge function are gone', () => {
    expect(existsSync(resolve(root, 'src/hooks/useGenerateHeroImage.ts'))).toBe(false);
    expect(existsSync(resolve(root, 'supabase/functions/generate-hero-image'))).toBe(false);
    expect(readFileSync(resolve(root, 'supabase/config.toml'), 'utf8')).not.toContain('[functions.generate-hero-image]');
  });

  it('Add Vehicle no longer promises an AI preview image', () => {
    const dialog = readFileSync(resolve(root, 'src/components/dialogs/AddVehicleDialog.tsx'), 'utf8');
    expect(dialog).not.toMatch(/AI preview image/i);
  });
});
