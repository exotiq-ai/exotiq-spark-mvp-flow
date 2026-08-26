import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FLEET_TOOLS } from '../../supabase/functions/_shared/fleet-tools/registry';
import { TOOL_PARAM_ALIASES } from '../../supabase/functions/_shared/fleet-tools/executor';

/**
 * Guards against registry/executor parameter drift.
 *
 * The registry schemas are synced to ElevenLabs and must not be renamed, so
 * the executor either reads the registry name directly or maps it through
 * TOOL_PARAM_ALIASES. A registry param that no handler ever reads means that
 * tool silently receives `undefined` — exactly the class of bug this catches.
 */

const EXECUTOR_PATH = resolve(
  __dirname,
  '../../supabase/functions/_shared/fleet-tools/executor.ts',
);
const source = readFileSync(EXECUTOR_PATH, 'utf8');

/** Map tool name -> the source text of its `case` block. */
function caseBlocks(src: string): Record<string, string> {
  const blocks: Record<string, string> = {};
  const re = /^\s*case "([\w-]+)":/gm;
  const starts: { name: string; index: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    starts.push({ name: m[1], index: m.index, end: re.lastIndex });
  }
  for (let i = 0; i < starts.length; i++) {
    // Fall-through cases (`case "a": case "b": {`) share the following body.
    let bodyStart = starts[i].end;
    let j = i;
    while (j + 1 < starts.length && src.slice(starts[j].end, starts[j + 1].index).trim() === '') {
      j++;
      bodyStart = starts[j].end;
    }
    const bodyEnd = j + 1 < starts.length ? starts[j + 1].index : src.indexOf('\n      default:', bodyStart);
    blocks[starts[i].name] = src.slice(bodyStart, bodyEnd > 0 ? bodyEnd : src.length);
  }
  return blocks;
}

const blocks = caseBlocks(source);

describe('fleet-tools registry/executor parity', () => {
  it('every registry tool has a handler case', () => {
    const missing = FLEET_TOOLS.map((t) => t.name).filter((name) => !blocks[name]);
    expect(missing, `tools with no executor case: ${missing.join(', ')}`).toEqual([]);
  });

  it('every registry param is read by its handler (directly or via an alias)', () => {
    const drift: string[] = [];

    for (const tool of FLEET_TOOLS) {
      const body = blocks[tool.name];
      if (!body) continue;
      const aliases = TOOL_PARAM_ALIASES[tool.name] || {};

      for (const param of tool.params || []) {
        const candidates = [param.name, aliases[param.name]].filter(Boolean) as string[];
        // create_booking_hold resolves free-text `vehicle` to `vehicle_id`.
        if (tool.name === 'create_booking_hold' && param.name === 'vehicle') {
          candidates.push('vehicle_id');
        }
        const read = candidates.some((c) => new RegExp(`\\b${c}\\b`).test(body));
        if (!read) drift.push(`${tool.name}.${param.name}`);
      }
    }

    expect(
      drift,
      `registry params never read by their handler: ${drift.join(', ')}`,
    ).toEqual([]);
  });

  it('alias map only references real registry tools and params', () => {
    const byName = new Map(FLEET_TOOLS.map((t) => [t.name, t]));
    const bad: string[] = [];
    for (const [toolName, map] of Object.entries(TOOL_PARAM_ALIASES)) {
      const tool = byName.get(toolName);
      if (!tool) {
        bad.push(`unknown tool ${toolName}`);
        continue;
      }
      const params = new Set((tool.params || []).map((p) => p.name));
      for (const from of Object.keys(map)) {
        if (!params.has(from)) bad.push(`${toolName}.${from}`);
      }
    }
    expect(bad, `stale alias entries: ${bad.join(', ')}`).toEqual([]);
  });
});
