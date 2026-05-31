#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const artifactRoot =
  rootIndex >= 0 && args[rootIndex + 1]
    ? path.resolve(args[rootIndex + 1])
    : path.resolve("migration-artifacts");

const requiredGroups = [
  {
    name: "full-postgres-dump",
    description: "Full Postgres dump",
    patterns: [/pg[_-]?dump/i, /database.*dump/i, /full.*dump/i, /\.dump$/i, /\.sql(\.gz)?$/i],
  },
  {
    name: "auth-users-export",
    description: "Auth users export with password hashes or explicit fallback note",
    patterns: [/auth.*users/i, /users.*auth/i, /password.*hash/i, /forced-password-reset-fallback/i],
  },
  {
    name: "storage-export",
    description: "Storage bucket export or approved storage-copy fallback",
    patterns: [/storage/i, /bucket/i, /vehicle-photos/i, /storage-copy-fallback/i],
  },
  {
    name: "auth-config",
    description: "Auth configuration snapshot",
    patterns: [/auth.*config/i, /redirect.*allow/i, /email.*template/i, /smtp/i],
  },
  {
    name: "cron-jobs",
    description: "Cron job export",
    patterns: [/cron/i, /pg_cron/i, /scheduled/i],
  },
  {
    name: "backup-pitr",
    description: "Backup/PITR availability statement",
    patterns: [/backup/i, /pitr/i, /point.*in.*time/i],
  },
];

const forbiddenSecretPatterns = [
  /secret/i,
  /service[_-]?role/i,
  /stripe.*sk_/i,
  /resend.*key/i,
  /openai.*key/i,
  /elevenlabs.*key/i,
  /google.*secret/i,
];

const allowedSecretNameFiles = [/secrets\.csv$/i, /required_env\.txt$/i, /secret[_-]?names/i];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

const files = walk(artifactRoot);
const relativeFiles = files.map((file) => path.relative(artifactRoot, file));

const missing = requiredGroups.filter(
  (group) => !relativeFiles.some((file) => group.patterns.some((pattern) => pattern.test(file))),
);

const riskySecretFiles = relativeFiles.filter((file) => {
  if (allowedSecretNameFiles.some((pattern) => pattern.test(file))) return false;
  return forbiddenSecretPatterns.some((pattern) => pattern.test(file));
});

console.log(`Artifact root: ${artifactRoot}`);
console.log(`Files found: ${files.length}`);

if (!fs.existsSync(artifactRoot)) {
  console.log("Artifact root does not exist yet.");
}

if (missing.length > 0) {
  console.log("\nMissing required artifact groups:");
  for (const group of missing) {
    console.log(`- ${group.name}: ${group.description}`);
  }
}

if (riskySecretFiles.length > 0) {
  console.log("\nPotential secret-bearing files found in artifact root:");
  for (const file of riskySecretFiles) {
    console.log(`- ${file}`);
  }
}

if (missing.length === 0 && riskySecretFiles.length === 0) {
  console.log("\nArtifact package passed filename-level validation.");
  process.exit(0);
}

console.log("\nArtifact package is not ready for restore.");
process.exit(1);

