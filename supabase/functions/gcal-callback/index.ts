import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Get the frontend URL for redirects
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://exotiq-spark-mvp-flow.lovable.app";

    if (error) {
      console.error("Google OAuth error:", error);
      return Response.redirect(`${frontendUrl}/dashboard?gcal=error&reason=${encodeURIComponent(error)}`, 302);
    }

    if (!code || !stateParam) {
      return Response.redirect(`${frontendUrl}/dashboard?gcal=error&reason=missing_params`, 302);
    }

    let state: { team_id: string; user_id: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return Response.redirect(`${frontendUrl}/dashboard?gcal=error&reason=invalid_state`, 302);
    }

    const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")!;
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gcal-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("Token exchange error:", tokenData);
      return Response.redirect(`${frontendUrl}/dashboard?gcal=error&reason=token_exchange_failed`, 302);
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

    // Get connected email
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const connectedEmail = userInfo.email || "Unknown";

    // Get team name for calendar
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: team } = await adminClient
      .from("teams")
      .select("name")
      .eq("id", state.team_id)
      .single();

    const calendarName = `Exotiq Calendar - ${team?.name || "My Fleet"}`;

    // Create a secondary calendar
    const calRes = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: calendarName,
        description: "Auto-synced bookings from Exotiq fleet management",
        timeZone: "America/New_York",
      }),
    });

    const calData = await calRes.json();
    if (!calData.id) {
      console.error("Calendar creation error:", calData);
      return Response.redirect(`${frontendUrl}/dashboard?gcal=error&reason=calendar_creation_failed`, 302);
    }

    // Store integration in team_integrations
    const { error: upsertError } = await adminClient
      .from("team_integrations")
      .upsert(
        {
          team_id: state.team_id,
          integration_type: "google_calendar",
          is_active: true,
          configured_by: state.user_id,
          config: {
            access_token,
            refresh_token,
            token_expiry: tokenExpiry,
            calendar_id: calData.id,
            connected_email: connectedEmail,
            calendar_name: calendarName,
          },
        },
        { onConflict: "team_id,integration_type" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return Response.redirect(`${frontendUrl}/dashboard?gcal=error&reason=save_failed`, 302);
    }

    return Response.redirect(`${frontendUrl}/dashboard?tab=settings&gcal=success`, 302);
  } catch (err) {
    console.error("gcal-callback error:", err);
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://exotiq-spark-mvp-flow.lovable.app";
    return Response.redirect(`${frontendUrl}/dashboard?gcal=error&reason=unexpected`, 302);
  }
});
