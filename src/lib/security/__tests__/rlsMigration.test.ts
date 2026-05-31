import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260530203000_harden_tenant_rls_policies.sql"
);
const signupSlugMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260530224500_harden_signup_team_slug_generation.sql"
);

describe("tenant RLS hardening migration", () => {
  const migration = () => readFileSync(migrationPath, "utf8");

  it("covers each confirmed migration-readiness security finding", () => {
    const sql = migration();

    expect(sql).toContain("customer-documents");
    expect(sql).toContain("message-attachments");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.is_same_team");
    expect(sql).toContain("user_activity_log");
    expect(sql).toContain("realtime.messages");
    expect(sql).toContain("is_team_admin");
  });

  it("removes the broad authenticated storage policies", () => {
    const sql = migration();

    expect(sql).not.toContain("bucket_id = 'customer-documents' AND auth.uid() IS NOT NULL");
    expect(sql).not.toContain("bucket_id = 'message-attachments' AND auth.role() = 'authenticated'");
  });

  it("prevents blank team slugs for auth-created profiles without display metadata", () => {
    const sql = readFileSync(signupSlugMigrationPath, "utf8");

    expect(sql).toContain("NULLIF");
    expect(sql).toContain("fleet-' || LEFT(NEW.id::text, 8)");
    expect(sql).toContain("WHERE slug IS NULL OR btrim(slug) = ''");
  });
});
