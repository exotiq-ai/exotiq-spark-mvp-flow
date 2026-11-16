import { describe, it, expect } from 'vitest';
import { moduleLabel, moduleIdToPath, pathToModuleId } from '@/lib/moduleRoutes';

const ALL_MODULES = ['dashboard', 'book', 'customers', 'fleet', 'pulse', 'motoriq', 'core', 'vault', 'margin', 'settings', 'team-hub', 'messages'];

describe('moduleLabel (the page name in the phone header)', () => {
  it('names every routed page, Fleet included', () => {
    expect(moduleLabel('fleet')).toBe('Fleet');
    expect(moduleLabel('book')).toBe('Bookings');
    expect(moduleLabel('core')).toBe('FleetCopilot™');
    expect(moduleLabel('pulse')).toBe('Pulse Analytics');
  });

  it('has a real label for every module the router knows', () => {
    for (const id of ALL_MODULES) {
      expect(pathToModuleId(moduleIdToPath(id))).toBe(id);
      expect(moduleLabel(id)).not.toMatch(/Exotiq\.ai|\|/);
      expect(moduleLabel(id).length).toBeGreaterThan(0);
    }
  });

  it('falls back to Dashboard for an unknown id', () => {
    expect(moduleLabel('nope')).toBe('Dashboard');
  });
});
