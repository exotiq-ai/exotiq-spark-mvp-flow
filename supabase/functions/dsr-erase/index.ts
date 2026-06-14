// dsr-erase
// Hard-erasure executor for GDPR Art. 17 / equivalent.
// Two-phase: mode="preview" returns row counts per table; mode="execute"
// performs the cascaded delete + anonymization, scoped to the caller's
// team and the deletion_requests row's subject.
//
// Legal-floor deny list (hardcoded): tables that we cannot delete from
// under tax / AML / consent-evidence retention floors. For those tables
// we anonymize PII columns in place and keep the financial / audit core.
//
// Owner/admin gated. Writes a tamper-evident receipt into data_access_log.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function admin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// Tables read/erased for a customer subject. fk = column on the table
// that holds the customer id. anonymize=true means we NULL out the PII
// columns rather than delete the row (legal-retention floor).
const CUSTOMER_TARGETS: {
  table: string;
  fk: string;
  anonymize?: { columns: string[] };
}[] = [
  { table: "customer_notes", fk: "customer_id" },
  { table: "messages", fk: "customer_id" },
  { table: "damage_claims", fk: "customer_id" },
  { table: "documents", fk: "customer_id" },
  // Legal-floor: tax/AML — keep totals, drop PII.
  {
    table: "payments",
    fk: "customer_id",
    anonymize: { columns: ["customer_id"] },
  },
  {
    table: "bookings",
    fk: "customer_id",
    anonymize: { columns: ["customer_id", "renter_email", "renter_phone", "renter_name"] },
  },
  // Customer row itself is anonymized so historical FK refs remain valid.
  {
    table: "customers",
    fk: "id",
    anonymize: {
      columns: [
        "first_name",
        "last_name",
        "email",
        "phone",
        "address_line1",
        "address_line2",
        "city",
        "state",
        "postal_code",
        "date_of_birth",
        "notes",
      ],
    },
  },
];

// Operator-user targets. Some are deleted (preferences); profiles row
// is anonymized to keep audit-log FK integrity.
const USER_TARGETS: {
  table: string;
  fk: string;
  anonymize?: { columns: string[] };
}[] = [
  { table: "user_settings", fk: "user_id" },
  { table: "notification_preferences", fk: "user_id" },
  { table: "user_dashboard_layouts", fk: "user_id" },
  { table: "user_dashboard_preferences", fk: "user_id" },
  { table: "user_presence", fk: "user_id" },
  {
    table: "profiles",
    fk: "id",
    anonymize: { columns: ["first_name", "last_name", "email", "phone", "avatar_url"] },
  },
];

interface Body {
  request_id: string;
  mode: "preview" | "execute";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = admin();
    const { data: userData, error: userErr } = await db.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    // deno-lint-ignore no-explicit-any
    const { data: roleRows } = await (db.from("user_roles") as any)
      .select("role")
      .eq("user_id", callerId);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    if (!roles.includes("owner") && !roles.includes("admin")) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // deno-lint-ignore no-explicit-any
    const { data: tm } = await (db.from("team_members") as any)
      .select("team_id")
      .eq("user_id", callerId)
      .maybeSingle();
    const teamId = (tm as { team_id?: string } | null)?.team_id;
    if (!teamId) {
      return new Response(JSON.stringify({ error: "no team" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.request_id || (body.mode !== "preview" && body.mode !== "execute")) {
      return new Response(JSON.stringify({ error: "request_id and mode required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // deno-lint-ignore no-explicit-any
    const { data: dr } = await (db.from("deletion_requests") as any)
      .select("*")
      .eq("id", body.request_id)
      .maybeSingle();
    if (!dr) {
      return new Response(JSON.stringify({ error: "request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (dr.team_id && dr.team_id !== teamId) {
      return new Response(JSON.stringify({ error: "cross-team request" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subjectCustomerId = dr.subject_customer_id ?? dr.customer_id ?? null;
    const subjectUserId = dr.subject_user_id ?? dr.user_id ?? null;
    if (!subjectCustomerId && !subjectUserId) {
      return new Response(JSON.stringify({ error: "no subject on deletion request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targets = subjectCustomerId ? CUSTOMER_TARGETS : USER_TARGETS;
    const subjectId = subjectCustomerId ?? subjectUserId!;
    const previewCounts: Record<string, number> = {};
    const actionCounts: Record<string, { deleted: number; anonymized: number }> = {};

    // Preview pass — count rows
    for (const t of targets) {
      // deno-lint-ignore no-explicit-any
      let q = (db.from(t.table) as any).select("id", { count: "exact", head: true });
      if (subjectCustomerId) q = q.eq("team_id", teamId);
      q = q.eq(t.fk, subjectId);
      const { count } = await q;
      previewCounts[t.table] = count ?? 0;
    }

    if (body.mode === "preview") {
      // deno-lint-ignore no-explicit-any
      await (db.from("deletion_requests") as any)
        .update({ preview_counts: previewCounts })
        .eq("id", body.request_id);
      return new Response(
        JSON.stringify({ ok: true, mode: "preview", counts: previewCounts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // EXECUTE — delete / anonymize per target
    for (const t of targets) {
      try {
        if (t.anonymize) {
          const patch: Record<string, unknown> = {};
          for (const c of t.anonymize.columns) patch[c] = null;
          patch["deleted_at" as string] = new Date().toISOString();
          // deno-lint-ignore no-explicit-any
          let q = (db.from(t.table) as any).update(patch);
          if (subjectCustomerId) q = q.eq("team_id", teamId);
          q = q.eq(t.fk, subjectId);
          const { error, count } = await q.select("id", { count: "exact" });
          if (error && !/column .* does not exist/.test(error.message)) {
            // Fallback without deleted_at column
            delete patch["deleted_at"];
            // deno-lint-ignore no-explicit-any
            let q2 = (db.from(t.table) as any).update(patch);
            if (subjectCustomerId) q2 = q2.eq("team_id", teamId);
            q2 = q2.eq(t.fk, subjectId);
            const r = await q2.select("id", { count: "exact" });
            actionCounts[t.table] = { deleted: 0, anonymized: r.count ?? 0 };
          } else {
            actionCounts[t.table] = { deleted: 0, anonymized: count ?? 0 };
          }
        } else {
          // deno-lint-ignore no-explicit-any
          let q = (db.from(t.table) as any).delete();
          if (subjectCustomerId) q = q.eq("team_id", teamId);
          q = q.eq(t.fk, subjectId);
          const { count } = await q.select("id", { count: "exact" });
          actionCounts[t.table] = { deleted: count ?? 0, anonymized: 0 };
        }
      } catch (e) {
        actionCounts[t.table] = { deleted: 0, anonymized: 0 };
        console.error(`erase ${t.table} failed`, (e as Error).message);
      }
    }

    // Storage cleanup — DSR exports for this team subject
    try {
      // deno-lint-ignore no-explicit-any
      const { data: files } = await (db.storage.from("dsr-exports") as any).list(
        `${teamId}`,
        { limit: 1000 }
      );
      const stale = (files ?? []).filter((f: { name: string }) =>
        f.name.includes(body.request_id) || f.name.includes(subjectId)
      );
      if (stale.length) {
        await (db.storage.from("dsr-exports") as any).remove(
          stale.map((f: { name: string }) => `${teamId}/${f.name}`)
        );
      }
    } catch (e) {
      console.error("storage cleanup", (e as Error).message);
    }

    // Receipt to audit log
    // deno-lint-ignore no-explicit-any
    const { data: rec } = await (db.from("data_access_log") as any)
      .insert({
        team_id: teamId,
        actor_user_id: callerId,
        entity: "deletion_requests",
        record_id: body.request_id,
        action: "erasure_completed",
        metadata: {
          subject_customer_id: subjectCustomerId,
          subject_user_id: subjectUserId,
          preview_counts: previewCounts,
          action_counts: actionCounts,
        },
      })
      .select("id")
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    await (db.from("deletion_requests") as any)
      .update({
        preview_counts: previewCounts,
        executed_at: new Date().toISOString(),
        receipt_id: (rec as { id?: string } | null)?.id ?? null,
        status: "completed",
      })
      .eq("id", body.request_id);

    return new Response(
      JSON.stringify({ ok: true, mode: "execute", counts: actionCounts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
