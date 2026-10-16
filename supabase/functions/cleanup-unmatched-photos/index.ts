import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceOrUser } from "../_shared/serviceAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Hard ceiling on rows deleted per run; leftovers are picked up by the next run.
const MAX_ROWS_PER_RUN = 500;
// The scheduled (cron) path only removes items older than this, so reviewers get a grace period.
const CRON_MIN_AGE_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Caller must be the scheduler (x-cron-token) or a signed-in user.
    const auth = await requireServiceOrUser(req);
    if (!auth.ok) return auth.response(corsHeaders);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "true";

    // Scope: a signed-in user only ever cleans THEIR OWN team(s); only the scheduler works across all teams.
    let teamIds: string[] | null = null;
    if (!auth.isCron) {
      const { data: memberships, error: mErr } = await supabase
        .from("team_members").select("team_id").eq("user_id", auth.userId!);
      if (mErr) return json({ error: "Could not resolve your team" }, 500);
      teamIds = [...new Set((memberships ?? []).map((m: { team_id: string }) => m.team_id))];
      if (teamIds.length === 0) return json({ error: "No team found for this user" }, 403);
    }
    // User-triggered cleanup is immediate (an explicit click); scheduled cleanup waits for the grace period.
    const minAgeDays = auth.isCron ? Number(url.searchParams.get("min_age_days") ?? CRON_MIN_AGE_DAYS) : 0;
    const cutoff = new Date(Date.now() - minAgeDays * 86400_000).toISOString();

    const pick = (status: "rejected" | "matched") => {
      let q = supabase.from("unmatched_photos").select("id, storage_path").eq("status", status);
      if (teamIds) q = q.in("team_id", teamIds);
      if (minAgeDays > 0) q = q.lt("created_at", cutoff);
      return q.order("created_at", { ascending: true }).limit(MAX_ROWS_PER_RUN);
    };

    // 1. Rejected photos: remove the stored files (never one that a vehicle photo still uses), then the rows.
    const { data: rejected, error: rErr } = await pick("rejected");
    if (rErr) return json({ error: "Could not list rejected photos" }, 500);
    const rejectedRows = rejected ?? [];
    let rejectedFilesDeleted = 0;
    let rejectedRowsDeleted = 0;
    let filesSkippedInUse = 0;

    if (rejectedRows.length > 0) {
      const candidatePaths = rejectedRows.flatMap((r: { storage_path: string | null }) => {
        if (!r.storage_path) return [];
        return [r.storage_path, r.storage_path.replace(/\.[^.]+$/, "_thumb.jpg")];
      });
      const { data: inUse } = await supabase
        .from("vehicle_photos").select("storage_path").in("storage_path", candidatePaths);
      const used = new Set((inUse ?? []).map((v: { storage_path: string }) => v.storage_path));
      const deletable = candidatePaths.filter((p: string) => !used.has(p));
      filesSkippedInUse = candidatePaths.length - deletable.length;

      if (!dryRun) {
        if (deletable.length > 0) {
          const { error: storageError } = await supabase.storage.from("vehicle-photos").remove(deletable);
          if (!storageError) rejectedFilesDeleted = deletable.length;
        }
        const ids = rejectedRows.map((r: { id: string }) => r.id);
        const { error: delErr } = await supabase.from("unmatched_photos").delete().in("id", ids);
        if (!delErr) rejectedRowsDeleted = ids.length;
      } else {
        rejectedFilesDeleted = deletable.length;
        rejectedRowsDeleted = rejectedRows.length;
      }
    }

    // 2. Matched photos: only the queue rows go (the files are kept for vehicle_photos).
    const { data: matched, error: mErr2 } = await pick("matched");
    if (mErr2) return json({ error: "Could not list matched photos" }, 500);
    const matchedRows = matched ?? [];
    let matchedRowsDeleted = 0;
    if (matchedRows.length > 0) {
      if (!dryRun) {
        const ids = matchedRows.map((m: { id: string }) => m.id);
        const { error: delErr } = await supabase.from("unmatched_photos").delete().in("id", ids);
        if (!delErr) matchedRowsDeleted = ids.length;
      } else {
        matchedRowsDeleted = matchedRows.length;
      }
    }

    return json({
      success: true,
      dryRun,
      scope: teamIds ? "your-team" : "all-teams",
      minAgeDays,
      maxRowsPerRun: MAX_ROWS_PER_RUN,
      rejected: { filesDeleted: rejectedFilesDeleted, rowsDeleted: rejectedRowsDeleted, filesSkippedInUse },
      matched: { rowsDeleted: matchedRowsDeleted },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
