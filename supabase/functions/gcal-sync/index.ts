import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.error("Token refresh failed:", data);
    return null;
  }
  return { access_token: data.access_token, expires_in: data.expires_in };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, booking_id, team_id } = await req.json();

    if (!action || !booking_id || !team_id) {
      return new Response(JSON.stringify({ error: "action, booking_id, team_id required" }), {
        status: 400, headers: corsHeaders,
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get integration config
    const { data: integration } = await adminClient
      .from("team_integrations")
      .select("*")
      .eq("team_id", team_id)
      .eq("integration_type", "google_calendar")
      .eq("is_active", true)
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_integration" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = integration.config as any;
    let accessToken = config.access_token;

    // Check if token expired, refresh if needed
    if (new Date(config.token_expiry) <= new Date()) {
      const refreshed = await refreshAccessToken(config.refresh_token);
      if (!refreshed) {
        // Mark integration as inactive if refresh fails
        await adminClient
          .from("team_integrations")
          .update({ is_active: false })
          .eq("id", integration.id);
        return new Response(JSON.stringify({ error: "token_refresh_failed" }), {
          status: 401, headers: corsHeaders,
        });
      }
      accessToken = refreshed.access_token;
      // Update stored tokens
      await adminClient
        .from("team_integrations")
        .update({
          config: {
            ...config,
            access_token: refreshed.access_token,
            token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          },
          last_used_at: new Date().toISOString(),
        })
        .eq("id", integration.id);
    }

    // Get booking data
    const { data: booking } = await adminClient
      .from("bookings")
      .select("*, vehicles(name, make, model, year)")
      .eq("id", booking_id)
      .single();

    if (!booking) {
      return new Response(JSON.stringify({ error: "booking_not_found" }), {
        status: 404, headers: corsHeaders,
      });
    }

    const vehicleInfo = (booking as any).vehicles;
    const vehicleName = vehicleInfo
      ? `${vehicleInfo.year || ""} ${vehicleInfo.make || ""} ${vehicleInfo.model || ""}`.trim() || vehicleInfo.name
      : booking.vehicle_name || "Vehicle";

    const calendarId = config.calendar_id;
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    if (action === "create" || action === "update") {
      const event = {
        summary: `${vehicleName} - ${booking.customer_name}`,
        location: booking.pickup_location || "",
        description: [
          `Customer: ${booking.customer_name}`,
          booking.customer_email ? `Email: ${booking.customer_email}` : "",
          booking.customer_phone ? `Phone: ${booking.customer_phone}` : "",
          `Daily Rate: $${booking.daily_rate}`,
          `Total: $${booking.total_value}`,
          booking.notes ? `\nNotes: ${booking.notes}` : "",
          `\nStatus: ${booking.status || "pending"}`,
          booking.booking_ref ? `Ref: ${booking.booking_ref}` : "",
        ].filter(Boolean).join("\n"),
        start: {
          date: booking.start_date.split("T")[0],
        },
        end: {
          // Google Calendar end date is exclusive for all-day events
          date: (() => {
            const d = new Date(booking.end_date.split("T")[0]);
            d.setDate(d.getDate() + 1);
            return d.toISOString().split("T")[0];
          })(),
        },
        colorId: booking.status === "confirmed" ? "2" : booking.status === "cancelled" ? "11" : "5",
      };

      if (action === "update" && booking.google_calendar_event_id) {
        // Update existing event
        const res = await fetch(`${baseUrl}/${booking.google_calendar_event_id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error("Google Calendar update error:", err);
          // If event not found, create a new one
          if (res.status === 404) {
            const createRes = await fetch(baseUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(event),
            });
            const created = await createRes.json();
            if (created.id) {
              await adminClient
                .from("bookings")
                .update({ google_calendar_event_id: created.id })
                .eq("id", booking_id);
            }
          }
        }
      } else {
        // Create new event
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });
        const created = await res.json();
        if (created.id) {
          await adminClient
            .from("bookings")
            .update({ google_calendar_event_id: created.id })
            .eq("id", booking_id);
        } else {
          console.error("Event creation failed:", created);
        }
      }
    } else if (action === "delete") {
      if (booking.google_calendar_event_id) {
        await fetch(`${baseUrl}/${booking.google_calendar_event_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        await adminClient
          .from("bookings")
          .update({ google_calendar_event_id: null })
          .eq("id", booking_id);
      }
    }

    // Update last_used_at
    await adminClient
      .from("team_integrations")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", integration.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gcal-sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders,
    });
  }
});
