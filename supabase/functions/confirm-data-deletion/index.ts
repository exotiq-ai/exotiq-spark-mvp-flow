import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

interface ConfirmDeletionRequest {
  token: string;
  confirmationPhrase: string;
  reason?: string;
  teamId: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, confirmationPhrase, reason, teamId }: ConfirmDeletionRequest = await req.json();

    // Validate confirmation phrase
    if (confirmationPhrase !== CONFIRMATION_PHRASE) {
      return new Response(
        JSON.stringify({ error: "Invalid confirmation phrase" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify token and get deletion request
    const { data: deletionRequest, error: fetchError } = await supabase
      .from("deletion_requests")
      .select("*")
      .eq("confirmation_token", token)
      .eq("team_id", teamId)
      .in("status", ["email_sent", "pending"])
      .single();

    if (fetchError || !deletionRequest) {
      console.error("Deletion request not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired deletion token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired (1 hour)
    const scheduledAt = new Date(deletionRequest.scheduled_deletion_at);
    if (scheduledAt < new Date()) {
      // Mark as expired
      await supabase
        .from("deletion_requests")
        .update({ status: "expired" })
        .eq("id", deletionRequest.id);

      return new Response(
        JSON.stringify({ error: "Deletion token has expired. Please request a new one." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update deletion request status
    await supabase
      .from("deletion_requests")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", deletionRequest.id);

    console.log(`Starting data deletion for team: ${teamId}`);

    // Cascading delete in order (respecting foreign keys)
    const deletionOrder = [
      // Child tables first
      { table: "inspection_photos", column: "inspection_id", joinTable: "vehicle_inspections", joinColumn: "team_id" },
      { table: "vehicle_inspections", column: "team_id" },
      { table: "damage_claims", column: "team_id" },
      { table: "payment_receipts", column: "payment_id", joinTable: "payments", joinColumn: "team_id" },
      { table: "payments", column: "team_id" },
      { table: "messages", column: "team_id" },
      { table: "automated_messages", column: "user_id", userId: deletionRequest.requested_by },
      { table: "customer_notes", column: "user_id", userId: deletionRequest.requested_by },
      { table: "documents", column: "team_id" },
      { table: "bookings", column: "team_id" },
      { table: "customers", column: "team_id" },
      { table: "maintenance_schedules", column: "team_id" },
      { table: "vehicles", column: "team_id" },
      { table: "location_staff", column: "location_id", joinTable: "locations", joinColumn: "team_id" },
      { table: "locations", column: "team_id" },
      { table: "team_messages", column: "conversation_id", joinTable: "team_conversations", joinColumn: "team_id" },
      { table: "conversation_members", column: "conversation_id", joinTable: "team_conversations", joinColumn: "team_id" },
      { table: "team_conversations", column: "team_id" },
      { table: "team_integrations", column: "team_id" },
      { table: "import_batches", column: "team_id" },
      { table: "data_backups", column: "team_id" },
      { table: "rari_insights", column: "team_id" },
      // Team members (but not the owner's profile)
      { table: "team_members", column: "team_id" },
    ];

    for (const item of deletionOrder) {
      try {
        if (item.userId) {
          // Delete by user_id
          const { error } = await supabase
            .from(item.table)
            .delete()
            .eq(item.column, item.userId);
          
          if (error) {
            console.warn(`Warning deleting from ${item.table}:`, error);
          } else {
            console.log(`Deleted from ${item.table}`);
          }
        } else if (item.joinTable) {
          // Need to do a join delete - get IDs first
          const { data: joinData } = await supabase
            .from(item.joinTable)
            .select("id")
            .eq(item.joinColumn, teamId);
          
          if (joinData && joinData.length > 0) {
            const ids = joinData.map((d: { id: string }) => d.id);
            const { error } = await supabase
              .from(item.table)
              .delete()
              .in(item.column, ids);
            
            if (error) {
              console.warn(`Warning deleting from ${item.table}:`, error);
            } else {
              console.log(`Deleted from ${item.table}`);
            }
          }
        } else {
          // Simple delete by team_id
          const { error } = await supabase
            .from(item.table)
            .delete()
            .eq(item.column, teamId);
          
          if (error) {
            console.warn(`Warning deleting from ${item.table}:`, error);
          } else {
            console.log(`Deleted from ${item.table}`);
          }
        }
      } catch (err) {
        console.warn(`Error deleting from ${item.table}:`, err);
        // Continue with other tables
      }
    }

    // Delete storage files
    try {
      // List and delete vehicle photos
      const { data: vehiclePhotos } = await supabase.storage
        .from("vehicle-photos")
        .list(teamId);
      
      if (vehiclePhotos && vehiclePhotos.length > 0) {
        const filePaths = vehiclePhotos.map((f: { name: string }) => `${teamId}/${f.name}`);
        await supabase.storage.from("vehicle-photos").remove(filePaths);
        console.log("Deleted vehicle photos");
      }

      // List and delete customer documents
      const { data: customerDocs } = await supabase.storage
        .from("customer-documents")
        .list(teamId);
      
      if (customerDocs && customerDocs.length > 0) {
        const filePaths = customerDocs.map((f: { name: string }) => `${teamId}/${f.name}`);
        await supabase.storage.from("customer-documents").remove(filePaths);
        console.log("Deleted customer documents");
      }
    } catch (err) {
      console.warn("Error deleting storage files:", err);
    }

    // Cancel Stripe subscription if exists
    try {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        // Get user's Stripe customer ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", deletionRequest.requested_by)
          .single();

        if (profile?.email) {
          // Search for Stripe customer
          const searchResponse = await fetch(
            `https://api.stripe.com/v1/customers/search?query=email:'${profile.email}'`,
            {
              headers: {
                Authorization: `Bearer ${stripeKey}`,
              },
            }
          );
          const searchData = await searchResponse.json();

          if (searchData.data && searchData.data.length > 0) {
            const customerId = searchData.data[0].id;

            // Get active subscriptions
            const subsResponse = await fetch(
              `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active`,
              {
                headers: {
                  Authorization: `Bearer ${stripeKey}`,
                },
              }
            );
            const subsData = await subsResponse.json();

            // Cancel each subscription
            for (const sub of subsData.data || []) {
              await fetch(`https://api.stripe.com/v1/subscriptions/${sub.id}`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${stripeKey}`,
                },
              });
              console.log(`Cancelled subscription: ${sub.id}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Error cancelling Stripe subscription:", err);
    }

    // Log the reason if provided
    if (reason) {
      console.log(`Deletion reason: ${reason}`);
    }

    // Mark deletion as completed
    await supabase
      .from("deletion_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", deletionRequest.id);

    // Finally, soft delete the team (mark as deleted)
    await supabase
      .from("teams")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: deletionRequest.requested_by,
      })
      .eq("id", teamId);

    console.log(`Data deletion completed for team: ${teamId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "All data has been permanently deleted",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in confirm-data-deletion:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
