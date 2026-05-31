import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

const listFunctionDirs = () =>
  readdirSync(resolve(repoRoot, "supabase/functions"))
    .filter((entry) => statSync(resolve(repoRoot, "supabase/functions", entry)).isDirectory())
    .sort();

const listConfiguredFunctions = () => {
  const config = readFileSync(resolve(repoRoot, "supabase/config.toml"), "utf8");
  return Array.from(config.matchAll(/^\[functions\.([^\]]+)\]/gm))
    .map((match) => match[1])
    .sort();
};

describe("Supabase edge function config", () => {
  it("declares every repo function and has no stale config entries", () => {
    expect(listConfiguredFunctions()).toEqual(listFunctionDirs());
  });
});
