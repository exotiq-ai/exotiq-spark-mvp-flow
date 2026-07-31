// ElevenLabs voice tool webhook — THIN ADAPTER.
//
// All capability logic now lives in ../_shared/fleet-tools/. This file only:
//   1. verifies the per-session tool token (fail closed),
//   2. normalises the many payload shapes ElevenLabs sends into a tool call,
//   3. delegates to the shared executor.
//
// Do not add tool handlers here — add them to _shared/fleet-tools/executor.ts
// and register them in _shared/fleet-tools/registry.ts.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { verifyToolToken, getUserTeamId, looksLikeJwt } from '../_shared/fleet-tools/auth.ts';
import { executeFunction } from '../_shared/fleet-tools/executor.ts';
import { isKnownFleetTool, FLEET_TOOL_NAMES } from '../_shared/fleet-tools/registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readJsonBody(req: Request): Promise<any> {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') return {};
    const raw = await req.text().catch(() => '');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    console.warn('[readJsonBody] Failed to parse JSON body');
    return {};
  }
}

// Map common parameter-only payloads to actual tool names
// ElevenLabs sometimes sends { "status": "all" } instead of { "tool_name": "get_bookings", "parameters": { "status": "all" } }
const PARAMETER_TO_TOOL_MAP: Record<string, string> = {
  // Single parameter keys that map to specific tools
  'status': 'get_fleet_vehicles',      // { "status": "available" } -> get_fleet_vehicles
  'timeframe': 'getFleetMetrics',      // { "timeframe": "this_week" } -> getFleetMetrics
  'location': 'getLocationMetrics',    // { "location": "Miami" } -> getLocationMetrics
  'vehicleName': 'getVehicleDetails',  // { "vehicleName": "Ferrari" } -> getVehicleDetails
  'customerName': 'getCustomerProfile', // { "customerName": "John" } -> getCustomerProfile
  'metric': 'getTopPerformers',        // { "metric": "revenue" } -> getTopPerformers
  'eventName': 'getEventImpact',       // { "eventName": "Art Basel" } -> getEventImpact
  'daysAhead': 'getUpcomingMaintenance', // { "daysAhead": 30 } -> getUpcomingMaintenance
  'daysRange': 'searchBookings',       // { "daysRange": 7 } -> searchBookings
  'city': 'getDemandForecast',         // { "city": "miami" } -> getDemandForecast
  'days': 'getDemandForecast',         // { "days": 14 } -> getDemandForecast
};

// Known valid tool names (to distinguish from parameter keys)
const KNOWN_TOOLS = new Set([
  'get_fleet_vehicles', 'get_bookings', 'get_recent_activity',
  'getFleetMetrics', 'getLocationMetrics', 'getPaymentSummary',
  'getVehicleDetails', 'getCustomerProfile', 'checkAvailability',
  'getRevenueAnalysis', 'getTopPerformers', 'searchBookings',
  'getDamageReports', 'getUpcomingMaintenance', 'getCustomerLifetimeValue',
  'getVaultDocuments', 'getDemandForecast', 'getPricingRecommendation',
  'getFleetPricingOverview', 'getEventImpact',
  'getCarJoke', 'getVehicleSpecs', 'logFeedback', 'featureComingSoon',
  'getVehicleProfitLoss', 'getFleetProfitLoss', 'getCompetitorRates',

  'createBooking', 'updateBooking', 'sendCustomerMessage',
  // New ops tools (2026-06-12)
  'get_vehicle_status', 'get_todays_schedule', 'get_booking_by_reference',
  'search_customer', 'get_open_work_orders', 'create_booking_hold',
]);

function extractToolCall(body: any, url: URL): { toolName?: string; parameters: any } {
  // 1) Query params (supports /elevenlabs-tools?tool_name=...)
  // 0) Path suffix takes priority: /elevenlabs-tools/<toolName>?...
  const pathPartsEarly = url.pathname.split('/').filter(Boolean);
  const lastEarly = pathPartsEarly[pathPartsEarly.length - 1];
  if (lastEarly && lastEarly !== 'elevenlabs-tools' && isKnownFleetTool(lastEarly)) {
    const qp: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { qp[k] = v; });
    const merged = { ...(body || {}), ...qp };
    return { toolName: lastEarly, parameters: merged };
  }

  const qpName =
    url.searchParams.get('tool_name') ||
    url.searchParams.get('tool') ||
    url.searchParams.get('name') ||
    url.searchParams.get('function_name');

  if (qpName) {
    return { toolName: qpName, parameters: body?.parameters ?? body ?? {} };
  }

  // NEW STEP: If body is empty but URL has query params, infer tool from query params
  // This handles ElevenLabs sending GET requests like ?limit=5 or ?status=confirmed with empty body
  if ((!body || Object.keys(body).length === 0) && url.searchParams.size > 0) {
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      // Skip tool name keys since they're handled above
      if (!['tool_name', 'tool', 'name', 'function_name'].includes(key)) {
        queryParams[key] = value;
      }
    });
    
    const paramKeys = Object.keys(queryParams);
    
    if (paramKeys.length > 0) {
      // Single param: use PARAMETER_TO_TOOL_MAP with smart detection
      if (paramKeys.length === 1) {
        const k = paramKeys[0];
        const v = queryParams[k];
        
        // Special case: status param with booking-related values → get_bookings
        // Canonical statuses + synonyms Rari may emit
        const bookingStatuses = [
          'confirmed', 'pending', 'active', 'completed', 'cancelled', 'in_progress', 'all',
          'current', 'rented', 'out', 'upcoming', 'future'
        ];
        if (k === 'status' && bookingStatuses.includes(v.toLowerCase())) {
          console.log(`[extractToolCall] Mapping URL param { "status": "${v}" } to tool: get_bookings (booking status detected)`);
          return { toolName: 'get_bookings', parameters: queryParams };
        }

        // Date keyword (today/tomorrow/this_week/upcoming) → get_bookings
        if (k === 'date') {
          console.log(`[extractToolCall] Mapping URL param { "date": "${v}" } to tool: get_bookings`);
          return { toolName: 'get_bookings', parameters: queryParams };
        }

        if (PARAMETER_TO_TOOL_MAP[k]) {
          console.log(`[extractToolCall] Mapping URL param { "${k}": "${v}" } to tool: ${PARAMETER_TO_TOOL_MAP[k]}`);
          return { toolName: PARAMETER_TO_TOOL_MAP[k], parameters: queryParams };
        }
        // Special case: limit → get_recent_activity
        if (k === 'limit') {
          console.log(`[extractToolCall] Mapping URL param "limit" to tool: get_recent_activity`);
          return { toolName: 'get_recent_activity', parameters: queryParams };
        }
      }

      // Multi-param: use same inference as body
      let inferredTool = 'get_fleet_vehicles'; // default
      if (paramKeys.includes('customerName')) inferredTool = 'getCustomerProfile';
      else if (paramKeys.includes('vehicleName') && (paramKeys.includes('startDate') || paramKeys.includes('endDate'))) inferredTool = 'checkAvailability';
      else if (paramKeys.includes('vehicleName')) inferredTool = 'getVehicleDetails';
      else if (paramKeys.includes('timeframe') && paramKeys.includes('location')) inferredTool = 'getRevenueAnalysis';
      else if (paramKeys.includes('timeframe')) inferredTool = 'getFleetMetrics';
      else if (paramKeys.includes('daysRange')) inferredTool = 'searchBookings';
      else if (paramKeys.includes('daysAhead')) inferredTool = 'getUpcomingMaintenance';
      // start_date/end_date/date → bookings (NOT vehicles); vehicles don't have date fields
      else if (paramKeys.includes('date') || paramKeys.includes('start_date') || paramKeys.includes('end_date')) inferredTool = 'get_bookings';
      else if (paramKeys.includes('status')) inferredTool = 'get_bookings';
      else if (paramKeys.includes('limit')) inferredTool = 'get_recent_activity';
      else if (paramKeys.includes('metric')) inferredTool = 'getTopPerformers';
      
      console.log(`[extractToolCall] Inferred tool from URL params ${JSON.stringify(paramKeys)}: ${inferredTool}`);
      return { toolName: inferredTool, parameters: queryParams };
    }
  }

  // 2) Common wrappers
  const directName = body?.tool_name || body?.name || body?.function_name;
  if (directName) return { toolName: directName, parameters: body?.parameters || body?.args || {} };

  const nestedName = body?.tool?.name || body?.function?.name || body?.toolCall?.name || body?.tool_call?.name;
  const nestedParams =
    body?.tool?.parameters ||
    body?.tool?.args ||
    body?.function?.parameters ||
    body?.function?.args ||
    body?.toolCall?.parameters ||
    body?.tool_call?.parameters;
  if (nestedName) return { toolName: nestedName, parameters: nestedParams || body?.parameters || body?.args || {} };

  // OpenAI-like: { function: { name, arguments } }
  if (body?.function?.arguments && typeof body.function.arguments === 'string' && body.function.name) {
    try {
      return { toolName: body.function.name, parameters: JSON.parse(body.function.arguments) };
    } catch {
      return { toolName: body.function.name, parameters: { raw: body.function.arguments } };
    }
  }

  // 3) URL path suffix: /elevenlabs-tools/<toolName>
  const pathParts = url.pathname.split('/').filter(Boolean);
  const last = pathParts[pathParts.length - 1];
  if (last && last !== 'elevenlabs-tools' && isKnownFleetTool(last)) {
    return { toolName: last, parameters: body?.parameters ?? body ?? {} };
  }

  // 4) Legacy single-key format: { "<toolName>": <params> }
  const keys = Object.keys(body || {}).filter((k) => !['conversation_metadata', 'metadata'].includes(k));
  if (keys.length === 1) {
    const k = keys[0];
    const v = body[k];

    // Check if this key is a known tool name
    if (isKnownFleetTool(k)) {
      if (typeof v === 'object' && v !== null) return { toolName: k, parameters: v };
      if (typeof v === 'string') {
        const pairs = v.split(' ');
        const parameters: any = {};
        for (const pair of pairs) {
          const [pk, pv] = pair.split(':');
          if (pk && pv) parameters[pk] = pv;
        }
        return { toolName: k, parameters };
      }
    }

    // 5) Parameter-only payload like { "status": "all" } or { "date": "today" }
    // Booking-status synonyms and date keywords must route to get_bookings, NOT vehicles.
    const bookingStatusValues = new Set(['confirmed','pending','active','completed','cancelled','in_progress','all','current','rented','out','upcoming','future']);
    if (k === 'status' && typeof v === 'string' && bookingStatusValues.has(v.toLowerCase())) {
      console.log(`[extractToolCall] Mapping parameter-only { "status": "${v}" } to tool: get_bookings`);
      return { toolName: 'get_bookings', parameters: { [k]: v } };
    }
    if (k === 'date') {
      console.log(`[extractToolCall] Mapping parameter-only { "date": "${v}" } to tool: get_bookings`);
      return { toolName: 'get_bookings', parameters: { [k]: v } };
    }
    if (PARAMETER_TO_TOOL_MAP[k]) {
      const mappedTool = PARAMETER_TO_TOOL_MAP[k];
      console.log(`[extractToolCall] Mapping parameter-only payload { "${k}": "${v}" } to tool: ${mappedTool}`);
      return { toolName: mappedTool, parameters: { [k]: v } };
    }
  }

  // 6) Handle multi-key parameter payloads like { "status": "all", "location": "Miami" }
  if (keys.length > 0 && keys.length <= 5) {
    // Check if ALL keys are known parameters (not tool names)
    const allKeysAreParams = keys.every(k => PARAMETER_TO_TOOL_MAP[k] || ['start_date', 'end_date', 'date', 'limit', 'includeBookings', 'includeHistory'].includes(k));
    if (allKeysAreParams) {
      // Determine the best tool based on the parameters present
      let inferredTool = 'get_fleet_vehicles'; // default

      if (keys.includes('customerName')) inferredTool = 'getCustomerProfile';
      else if (keys.includes('vehicleName') && (keys.includes('startDate') || keys.includes('endDate'))) inferredTool = 'checkAvailability';
      else if (keys.includes('vehicleName')) inferredTool = 'getVehicleDetails';
      else if (keys.includes('timeframe') && keys.includes('location')) inferredTool = 'getRevenueAnalysis';
      else if (keys.includes('timeframe')) inferredTool = 'getFleetMetrics';
      else if (keys.includes('daysRange')) inferredTool = 'searchBookings';
      else if (keys.includes('daysAhead')) inferredTool = 'getUpcomingMaintenance';
      // Any date keyword/range or status → bookings (vehicles table has no date columns)
      else if (keys.includes('date') || keys.includes('start_date') || keys.includes('end_date')) inferredTool = 'get_bookings';
      else if (keys.includes('status')) inferredTool = 'get_bookings';
      else if (keys.includes('metric')) inferredTool = 'getTopPerformers';
      
      console.log(`[extractToolCall] Inferred tool from parameters ${JSON.stringify(keys)}: ${inferredTool}`);
      return { toolName: inferredTool, parameters: body };
    }
  }

  return { toolName: undefined, parameters: body || {} };
}


serve(async (req) => {
  const requestId = generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  const url = new URL(req.url);
  if (url.pathname.endsWith('/health') && req.method === 'GET') {
    const hasToolSecret = !!Deno.env.get('RARI_TOOL_TOKEN_SECRET');
    return new Response(JSON.stringify({
      ok: true,
      requestId,
      hasToolSecret,
      authMode: 'tool_token_only',
      timestamp: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    console.log(`\n[${requestId}] === ElevenLabs Tool Request ===`);
    console.log(`[${requestId}] Method: ${req.method} | URL: ${url.pathname}${url.search}`);

    // Log headers (redact authorization for security)
    const headers = Object.fromEntries(req.headers.entries());
    const safeHeaders = { ...headers };
    if (safeHeaders.authorization) safeHeaders.authorization = `[REDACTED:${safeHeaders.authorization.length}chars]`;
    console.log(`[${requestId}] Headers:`, JSON.stringify(safeHeaders));

    const body = await readJsonBody(req);
    console.log(`[${requestId}] Body:`, JSON.stringify(body, null, 2));

    // Initialize Supabase with service role for backend operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RARI_TOOL_TOKEN_SECRET = Deno.env.get('RARI_TOOL_TOKEN_SECRET');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================================
    // IDENTITY RESOLUTION — FAIL CLOSED
    //
    // The ONLY accepted credential is the signed per-session tool
    // token minted by `elevenlabs-session`, which carries the real
    // userId + teamId. There are deliberately no fallbacks:
    // caller-supplied metadata, DEMO_USER_ID and hardcoded demo
    // users all allowed one tenant's data to be served to another.
    // Do not reintroduce them.
    // ============================================================
    const unauthorized = (reason: string, detail: string) => {
      console.warn(`[${requestId}] ✗ 401 (${reason}) — refusing to serve tenant data`);
      return new Response(
        JSON.stringify({
          error: 'Authentication required',
          reason,
          summary: `I can't verify which account this request belongs to, so I won't guess. ${detail}`,
          requestId,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    if (!RARI_TOOL_TOKEN_SECRET) {
      console.error(`[${requestId}] RARI_TOOL_TOKEN_SECRET is not configured`);
      return unauthorized(
        'tool_token_secret_missing',
        'The voice assistant is not fully configured on the server yet.'
      );
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(
        'missing_bearer_token',
        'Please start a new session from inside the app so I can confirm your account.'
      );
    }

    const token = authHeader.slice(7).trim();
    console.log(`[${requestId}] [Auth] Bearer token received (${token.length} chars, JWT-like: ${looksLikeJwt(token)})`);

    if (!looksLikeJwt(token)) {
      return unauthorized(
        'token_not_session_token',
        'This request is using a static key instead of a per-session token, so I cannot tell which account is asking.'
      );
    }

    const payload = await verifyToolToken(token, RARI_TOOL_TOKEN_SECRET);
    if (!payload?.userId) {
      return unauthorized(
        'token_verification_failed',
        'Your session token could not be verified. Please start a new session from inside the app.'
      );
    }

    const userId: string = payload.userId;
    let teamId: string | null = payload.teamId ?? null;
    const authMethod = 'tool_token';

    console.log(`[${requestId}] ✓ Verified tool token: userId=${userId}, teamId=${teamId || 'null'}`);

    
    // Resolve tool + parameters from request
    const { toolName, parameters } = extractToolCall(body, url);

    console.log(`[${requestId}] Tool: ${toolName || '(missing)'} | Params: ${JSON.stringify(parameters)}`);

    if (!toolName) {
      console.log(`[${requestId}] ✗ Missing tool name - returning 400`);
      return new Response(
        JSON.stringify({
          error: 'Missing tool name',
          summary: 'Your agent is calling the tools endpoint without specifying which tool to run. Update the tool webhook to include tool_name + parameters (e.g. {"tool_name":"get_bookings","parameters":{"status":"active"}}) or call /elevenlabs-tools/<toolName>.',
          requestId,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify user exists in profiles table. We never create a profile here —
    // an unknown user id means the token is stale or forged, not that we
    // should manufacture an account.
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error(`[${requestId}] Profile lookup error:`, userError);
      return unauthorized(
        'profile_lookup_failed',
        'I could not confirm your account just now. Please try again in a moment.'
      );
    }

    if (!userProfile) {
      console.warn(`[${requestId}] ✗ User ${userId} has no profile - refusing`);
      return unauthorized(
        'unknown_user',
        'That account is not recognised. Please start a new session from inside the app.'
      );
    }

    console.log(`[${requestId}] User verified: ${userProfile.full_name || userProfile.email}`);

    // Resolve the team strictly from this user's own membership.
    // The token's teamId is treated as a claim to be confirmed, never trusted
    // on its own, and there is deliberately no "pick any team" fallback.
    const membershipTeamId = await getUserTeamId(supabase, userId);

    if (teamId && teamId !== membershipTeamId) {
      const { data: claimedMembership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .eq('team_id', teamId)
        .eq('is_active', true)
        .maybeSingle();

      if (!claimedMembership) {
        console.warn(`[${requestId}] ✗ Token claimed team ${teamId} but user is not a member - refusing`);
        return unauthorized(
          'team_claim_rejected',
          'Your session is pointing at an account you do not have access to.'
        );
      }
    }

    if (!teamId) {
      teamId = membershipTeamId;
      console.log(`[${requestId}] Team from membership: ${teamId || 'null'}`);
    }

    if (!teamId) {
      console.warn(`[${requestId}] ✗ User ${userId} belongs to no active team - refusing`);
      return new Response(
        JSON.stringify({
          error: 'No team access',
          reason: 'no_team_membership',
          summary: 'Your account is not linked to a fleet yet, so there is no data for me to look at.',
          requestId,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Execute the requested tool with team_id
    console.log(`[${requestId}] Executing tool: ${toolName}`);
    const result = await executeFunction(toolName, parameters, supabase, userId, teamId);

    // Add request metadata to result for debugging and verification
    const response = {
      ...result,
      _meta: {
        requestId,
        authMethod,
        userId,
        teamId,
        userName: userProfile?.full_name || 'Unknown',
        tool: toolName,
      }
    };

    console.log(`[${requestId}] ✓ Tool completed: ${toolName} | Summary: ${result.summary?.substring(0, 100) || 'No summary'}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[${requestId}] ✗ Error:`, error);
    console.error(`[${requestId}] Stack:`, error instanceof Error ? error.stack : 'No stack');
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Something went wrong processing your request. Please try again.',
        requestId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
