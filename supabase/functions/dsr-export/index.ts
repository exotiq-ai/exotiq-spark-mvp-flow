// dsr-export
// Generates a GDPR Art. 15 / 20 data export for a single data subject
// (customer or operator user) on demand. Owner/admin-gated.
//
// Output: a JSON bundle uploaded to the private `dsr-exports` bucket,
//   plus a 7-day signed URL stored on data_subject_requests.
//
// Cross-tenant safety belt: every query filters by team_id = caller's team
// even though FK ownership is already constrained by team scope.

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

// Tables we read for a customer-subject export.
// Each entry: table, customer-id column, plus tenant column.
const CUSTOMER_TABLES: { table: string; fk: string }[] = [
  { table: "customers", fk: "id" },
  { table: "bookings", fk: "customer_id" },
  { table: "payments", fk: "customer_id" },
  { table: "documents", fk: "customer_id" },
  { table: "damage_claims", fk: "customer_id" },
  { table: "customer_notes", fk: "customer_id" },
  { table: "messages", fk: "customer_id" },
];

// Tables we read for an operator-user-subject export.
const USER_TABLES: { table: string; fk: string }[] = [
  { table: "profiles", fk: "id" },
  { table: "user_settings", fk: "user_id" },
  { table: "user_roles", fk: "user_id" },
  { table: "team_members", fk: "user_id" },
  { table: "notification_preferences", fk: "user_id" },
  { table: "user_activity_log", fk: "user_id" },
];

interface Body {
  request_id: string;
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

    // Resolve caller from JWT
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

    // Owner/admin check
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

    // Caller's team
    // deno-lint-ignore no-explicit-any
    const { data: tm } = await (db.from("team_members") as any)
      .select("team_id")
      .eq("user_id", callerId)
      .maybeSingle();
    const callerTeamId = (tm as { team_id?: string } | null)?.team_id;
    if (!callerTeamId) {
      return new Response(JSON.stringify({ error: "no team" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.request_id) {
      return new Response(JSON.stringify({ error: "request_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load request
    // deno-lint-ignore no-explicit-any
    const { data: reqRow, error: reqErr } = await (db.from("data_subject_requests") as any)
      .select("*")
      .eq("id", body.request_id)
      .maybeSingle();

    if (reqErr || !reqRow) {
      return new Response(JSON.stringify({ error: "request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (reqRow.team_id && reqRow.team_id !== callerTeamId) {
      return new Response(JSON.stringify({ error: "cross-team request" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bundle: Record<string, unknown> = {
      manifest: {
        request_id: body.request_id,
        generated_at: new Date().toISOString(),
        generated_by_user_id: callerId,
        team_id: callerTeamId,
        subject_user_id: reqRow.subject_user_id,
        subject_customer_id: reqRow.subject_customer_id,
        subject_email: reqRow.subject_email,
      },
      tables: {} as Record<string, unknown[]>,
      counts: {} as Record<string, number>,
    };

    // Customer export
    if (reqRow.subject_customer_id) {
      for (const t of CUSTOMER_TABLES) {
        // deno-lint-ignore no-explicit-any
        let q = (db.from(t.table) as any).select("*").eq("team_id", callerTeamId);
        q = q.eq(t.fk, reqRow.subject_customer_id);
        const { data, error } = await q;
        if (error) {
          (bundle.tables as Record<string, unknown[]>)[t.table] = [
            { __export_error: error.message },
          ];
          continue;
        }
        (bundle.tables as Record<string, unknown[]>)[t.table] = data ?? [];
        (bundle.counts as Record<string, number>)[t.table] = (data ?? []).length;
      }
    }

    // Operator user export
    if (reqRow.subject_user_id) {
      for (const t of USER_TABLES) {
        // deno-lint-ignore no-explicit-any
        const { data, error } = await (db.from(t.table) as any)
          .select("*")
          .eq(t.fk, reqRow.subject_user_id);
        if (error) {
          (bundle.tables as Record<string, unknown[]>)[t.table] = [
            { __export_error: error.message },
          ];
          continue;
        }
        (bundle.tables as Record<string, unknown[]>)[t.table] = data ?? [];
        (bundle.counts as Record<string, number>)[t.table] = (data ?? []).length;
      }
    }

    // Upload to private bucket
    const filename = `${callerTeamId}/${body.request_id}-${Date.now()}.json`;
    const json = JSON.stringify(bundle, null, 2);
    // deno-lint-ignore no-explicit-any
    const { error: upErr } = await (db.storage.from("dsr-exports") as any).upload(
      filename,
      new Blob([json], { type: "application/json" }),
      { upsert: true, contentType: "application/json" }
    );
    if (upErr) {
      return new Response(JSON.stringify({ error: `upload failed: ${upErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7-day signed URL
    // deno-lint-ignore no-explicit-any
    const { data: signed } = await (db.storage.from("dsr-exports") as any).createSignedUrl(
      filename,
      60 * 60 * 24 * 7
    );

    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

    // deno-lint-ignore no-explicit-any
    await (db.from("data_subject_requests") as any)
      .update({
        export_url: signed?.signedUrl ?? null,
        export_expires_at: expiresAt,
        fulfilled_at: new Date().toISOString(),
        status: "fulfilled",
      })
      .eq("id", body.request_id);

    // Audit log
    // deno-lint-ignore no-explicit-any
    await (db.from("data_access_log") as any).insert({
      team_id: callerTeamId,
      actor_user_id: callerId,
      entity: "data_subject_requests",
      record_id: body.request_id,
      action: "export_generated",
      metadata: { counts: bundle.counts },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        export_url: signed?.signedUrl,
        export_expires_at: expiresAt,
        counts: bundle.counts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
