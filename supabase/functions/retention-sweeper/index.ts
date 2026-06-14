// retention-sweeper
// Scheduled daily via pg_cron. Reads public.retention_policies and either
// (a) reports what WOULD be deleted (dry-run, default) or
// (b) deletes/anonymizes rows past their retention window (enforce).
//
// Safety:
//   - Dry-run is the default for every existing policy (retention_policies.enabled = false).
//   - Append-only legal logs are deny-listed and never touched.
//   - Every run writes a row to retention_sweep_log (immutable).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Entities we will NEVER auto-delete regardless of policy config.
// These are legal-floor records (consent, audit, payments/tax).
const DENY_LIST = new Set<string>([
  "terms_acceptances",
  "data_access_log",
  "role_audit_log",
  "vehicle_change_log",
  "ai_transfer_log",
  "retention_sweep_log",
  "payments",
  "payment_receipts",
  "stripe_webhook_events",
]);

// Policy entity_type → SQL table mapping.
// Only entities listed here are reachable. Adding a new entity is an explicit
// engineering action (forces the team to think about cascades).
const ENTITY_TABLE: Record<string, { table: string; timestampCol: string; mode: "soft" | "hard" }> = {
  messages: { table: "messages", timestampCol: "created_at", mode: "hard" },
  team_messages: { table: "team_messages", timestampCol: "created_at", mode: "hard" },
  rari_messages: { table: "rari_messages", timestampCol: "created_at", mode: "hard" },
  rari_conversations: { table: "rari_conversations", timestampCol: "created_at", mode: "hard" },
  notifications: { table: "notifications", timestampCol: "created_at", mode: "hard" },
  inspection_photos: { table: "inspection_photos", timestampCol: "uploaded_at", mode: "hard" },
  unmatched_photos: { table: "unmatched_photos", timestampCol: "created_at", mode: "hard" },
  weekly_digests: { table: "weekly_digests", timestampCol: "created_at", mode: "hard" },
  user_activity_log: { table: "user_activity_log", timestampCol: "created_at", mode: "hard" },
};

interface Policy {
  id: string;
  entity_type: string;
  retention_days: number;
  enabled: boolean;
  action: string;
}

async function admin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function logSweep(
  db: ReturnType<typeof createClient>,
  row: {
    entity_type: string;
    retention_days: number;
    would_delete_count: number;
    deleted_count: number;
    dry_run: boolean;
    error?: string;
  }
) {
  try {
    // deno-lint-ignore no-explicit-any
    await (db.from("retention_sweep_log") as any).insert(row);
  } catch (e) {
    console.warn("[retention-sweeper] failed to write sweep log", e);
  }
}

async function processPolicy(
  db: ReturnType<typeof createClient>,
  policy: Policy
): Promise<{ would: number; deleted: number; error?: string }> {
  if (DENY_LIST.has(policy.entity_type)) {
    return { would: 0, deleted: 0, error: "deny-listed" };
  }
  const map = ENTITY_TABLE[policy.entity_type];
  if (!map) {
    return { would: 0, deleted: 0, error: "no table mapping" };
  }

  const cutoff = new Date(Date.now() - policy.retention_days * 86400 * 1000).toISOString();

  // Count first (always — used for dry-run report and post-delete sanity).
  // deno-lint-ignore no-explicit-any
  const { count, error: countErr } = await (db.from(map.table) as any)
    .select("id", { count: "exact", head: true })
    .lt(map.timestampCol, cutoff);

  if (countErr) {
    return { would: 0, deleted: 0, error: `count failed: ${countErr.message}` };
  }
  const would = count ?? 0;

  if (!policy.enabled || policy.action === "report_only") {
    return { would, deleted: 0 };
  }

  // Enforce. Cap per-run deletion to 10k rows to avoid runaway sweeps.
  // deno-lint-ignore no-explicit-any
  const { error: delErr } = await (db.from(map.table) as any)
    .delete()
    .lt(map.timestampCol, cutoff)
    .limit(10000);

  if (delErr) {
    return { would, deleted: 0, error: `delete failed: ${delErr.message}` };
  }
  return { would, deleted: would }; // best-effort; not exact when >10k
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const db = await admin();

  // deno-lint-ignore no-explicit-any
  const { data: policies, error } = await (db.from("retention_policies") as any)
    .select("id, entity_type, retention_days, enabled, action");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const results: Record<string, unknown> = {};
  for (const policy of (policies ?? []) as Policy[]) {
    const dryRun = !policy.enabled;
    const r = await processPolicy(db, policy);
    await logSweep(db, {
      entity_type: policy.entity_type,
      retention_days: policy.retention_days,
      would_delete_count: r.would,
      deleted_count: r.deleted,
      dry_run: dryRun,
      error: r.error,
    });
    results[policy.entity_type] = { ...r, dry_run: dryRun };
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
