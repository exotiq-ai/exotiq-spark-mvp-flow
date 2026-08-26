import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FLEET_TOOLS, toJsonSchema } from '../../supabase/functions/_shared/fleet-tools/registry';
import { TOOL_CASES } from '../../supabase/functions/rari-selftest/cases';

/**
 * Contract layer for Rari's tool surface.
 *
 * 1. Schema snapshot — the registry schemas are published to the live
 *    ElevenLabs agent. Any rename or type change must be a deliberate,
 *    reviewed act (update the snapshot in the same commit and re-run
 *    `rari:sync-tools --apply`), never an accidental side effect.
 * 2. Harness coverage — every registry tool must have at least one E2E case,
 *    so a newly added tool can't ship untested.
 */

const SNAPSHOT_PATH = resolve(__dirname, '__snapshots__/rari-tool-schemas.json');

function currentSchemas() {
  return Object.fromEntries(
    [...FLEET_TOOLS]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((tool) => [tool.name, toJsonSchema(tool)]),
  );
}

describe('Rari tool registry contract', () => {
  it('matches the published schema snapshot', () => {
    const current = currentSchemas();

    if (!existsSync(SNAPSHOT_PATH) || process.env.UPDATE_RARI_SNAPSHOT === '1') {
      writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(current, null, 2)}\n`);
    }

    const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
    expect(
      current,
      'Registry schemas changed. If intentional, run with UPDATE_RARI_SNAPSHOT=1 and re-sync the ElevenLabs agent.',
    ).toEqual(snapshot);
  });

  it('has an E2E case for every registry tool', () => {
    const covered = new Set(TOOL_CASES.map((c) => c.tool));
    const uncovered = FLEET_TOOLS.map((t) => t.name).filter((n) => !covered.has(n));
    expect(uncovered, 'Add a case to supabase/functions/rari-selftest/cases.ts').toEqual([]);
  });

  it('only references tools that exist in the registry', () => {
    const known = new Set(FLEET_TOOLS.map((t) => t.name));
    const unknown = [...new Set(TOOL_CASES.map((c) => c.tool))].filter((n) => !known.has(n));
    expect(unknown, 'Harness references tools the registry does not declare').toEqual([]);
  });

  it('only passes parameters the tool declares', () => {
    const problems: string[] = [];
    for (const c of TOOL_CASES) {
      const tool = FLEET_TOOLS.find((t) => t.name === c.tool);
      if (!tool) continue;
      const schema = toJsonSchema(tool) as { properties?: Record<string, unknown> };
      const declared = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(c.args)) {
        // create_booking_hold cases intentionally exercise handler-side aliases.
        if (declared.has(key)) continue;
        problems.push(`${c.tool}: "${key}" is not a declared parameter`);
      }
    }
    expect(problems).toEqual([]);
  });
});
