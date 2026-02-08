import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Delete storage files for rejected photos, then delete rows
    const { data: rejected } = await supabase
      .from("unmatched_photos")
      .select("id, storage_path")
      .eq("status", "rejected");

    let rejectedFilesDeleted = 0;
    let rejectedRowsDeleted = 0;

    if (rejected && rejected.length > 0) {
      // Delete storage files
      const paths = rejected
        .map((r: any) => r.storage_path)
        .filter(Boolean);

      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("vehicle-photos")
          .remove(paths);
        if (!storageError) {
          rejectedFilesDeleted = paths.length;
        }
      }

      // Delete rows
      const ids = rejected.map((r: any) => r.id);
      const { error: deleteError } = await supabase
        .from("unmatched_photos")
        .delete()
        .in("id", ids);
      if (!deleteError) {
        rejectedRowsDeleted = ids.length;
      }
    }

    // 2. For matched photos, just delete the unmatched_photos rows
    //    (storage files are still used by vehicle_photos)
    const { data: matched } = await supabase
      .from("unmatched_photos")
      .select("id")
      .eq("status", "matched");

    let matchedRowsDeleted = 0;

    if (matched && matched.length > 0) {
      const ids = matched.map((m: any) => m.id);
      const { error: deleteError } = await supabase
        .from("unmatched_photos")
        .delete()
        .in("id", ids);
      if (!deleteError) {
        matchedRowsDeleted = ids.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rejected: { filesDeleted: rejectedFilesDeleted, rowsDeleted: rejectedRowsDeleted },
        matched: { rowsDeleted: matchedRowsDeleted },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
