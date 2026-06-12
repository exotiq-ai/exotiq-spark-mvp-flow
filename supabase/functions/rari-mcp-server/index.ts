import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================
// MCP (Model Context Protocol) Server for Rari Fleet Assistant
// Implements MCP protocol with HTTP+SSE transport for ElevenLabs
// ============================================================

// Tool definitions following MCP schema
const TOOL_MANIFEST = {
  // Fleet & Vehicle Tools
  get_fleet_vehicles: {
    name: "get_fleet_vehicles",
    description: "Get a list of all vehicles in the fleet with their status, location, daily rate, and utilization. Use this to see what vehicles are available, rented, or in maintenance. Can filter by status (available, rented, maintenance, all) and/or location (Miami, Scottsdale, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by vehicle status",
          enum: ["all", "available", "rented", "maintenance"]
        },
        location: {
          type: "string",
          description: "Filter by location (e.g., Miami, Los Angeles)"
        }
      }
    }
  },
  getFleetMetrics: {
    name: "getFleetMetrics",
    description: "Get comprehensive fleet performance metrics including total vehicles, active bookings count, total revenue, average utilization percentage, and peak season status. Timeframe options: today, week, month, year. Can filter by location. Use this for overall fleet health and performance overview.",
    inputSchema: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          description: "Time period for metrics",
          enum: ["today", "week", "month", "year"]
        },
        location: {
          type: "string",
          description: "Filter metrics by location"
        }
      }
    }
  },
  getLocationMetrics: {
    name: "getLocationMetrics",
    description: "Get detailed metrics broken down by location including vehicle counts, revenue, utilization, and active bookings per location.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Specific location to get metrics for, or 'all' for all locations"
        }
      }
    }
  },
  getVehicleDetails: {
    name: "getVehicleDetails",
    description: "Get detailed information about a specific vehicle including status, rates, utilization, and optionally recent bookings.",
    inputSchema: {
      type: "object",
      properties: {
        vehicleName: {
          type: "string",
          description: "Name, make, or model of the vehicle to look up"
        },
        includeBookings: {
          type: "boolean",
          description: "Whether to include recent booking history"
        }
      },
      required: ["vehicleName"]
    }
  },
  getVehicleSpecs: {
    name: "getVehicleSpecs",
    description: "Get technical specifications for a vehicle (horsepower, engine, acceleration, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        vehicleName: {
          type: "string",
          description: "Name or model of the vehicle"
        }
      },
      required: ["vehicleName"]
    }
  },
  checkAvailability: {
    name: "checkAvailability",
    description: "Check if vehicles are available for a specific date range. Can filter by vehicle name and location.",
    inputSchema: {
      type: "object",
      properties: {
        vehicleName: {
          type: "string",
          description: "Optional: specific vehicle to check"
        },
        startDate: {
          type: "string",
          description: "Start date (YYYY-MM-DD format)"
        },
        endDate: {
          type: "string",
          description: "End date (YYYY-MM-DD format)"
        },
        location: {
          type: "string",
          description: "Filter by location"
        }
      },
      required: ["startDate", "endDate"]
    }
  },

  // Booking Tools
  get_bookings: {
    name: "get_bookings",
    description: "Get a list of bookings. Filter by status, date range, and location.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by booking status",
          enum: ["all", "active", "confirmed", "pending", "completed", "cancelled"]
        },
        start_date: {
          type: "string",
          description: "Filter bookings starting after this date (YYYY-MM-DD)"
        },
        end_date: {
          type: "string",
          description: "Filter bookings ending before this date (YYYY-MM-DD)"
        },
        location: {
          type: "string",
          description: "Filter by vehicle location"
        }
      }
    }
  },
  searchBookings: {
    name: "searchBookings",
    description: "Search bookings with filters for status, time range, and location.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status"
        },
        daysRange: {
          type: "number",
          description: "Number of days to look back"
        },
        location: {
          type: "string",
          description: "Filter by location"
        }
      }
    }
  },
  get_recent_activity: {
    name: "get_recent_activity",
    description: "Get recent booking activity and transactions.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of activities to return (default: 10)"
        },
        activity_type: {
          type: "string",
          description: "Type of activity to filter"
        }
      }
    }
  },

  // Payment & Revenue Tools
  getPaymentSummary: {
    name: "getPaymentSummary",
    description: "Get payment summary including totals by status, method, type. Shows completed vs pending amounts.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by payment status",
          enum: ["all", "completed", "pending", "failed", "refunded"]
        },
        timeframe: {
          type: "string",
          description: "Time period",
          enum: ["today", "week", "month", "year", "all"]
        },
        location: {
          type: "string",
          description: "Filter by vehicle location"
        }
      }
    }
  },
  getRevenueAnalysis: {
    name: "getRevenueAnalysis",
    description: "Analyze revenue from completed bookings for a time period, optionally filtered by vehicle or location.",
    inputSchema: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          description: "Time period",
          enum: ["today", "week", "month", "year"]
        },
        vehicleName: {
          type: "string",
          description: "Filter by specific vehicle"
        },
        location: {
          type: "string",
          description: "Filter by location"
        }
      }
    }
  },
  getTopPerformers: {
    name: "getTopPerformers",
    description: "Get top performing vehicles by revenue or utilization, or top customers by lifetime value.",
    inputSchema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          description: "What to rank by",
          enum: ["revenue", "utilization", "customers"]
        },
        limit: {
          type: "number",
          description: "Number of results (default: 5)"
        },
        location: {
          type: "string",
          description: "Filter by location"
        }
      }
    }
  },

  // Pricing Tools
  getPricingRecommendation: {
    name: "getPricingRecommendation",
    description: "Get AI-powered pricing recommendations for a specific vehicle. Analyzes current utilization, peak season status, and demand patterns to suggest optimal daily rental rate. Returns current rate, suggested rate, difference, and reasoning factors. Use this when user asks about pricing adjustments or optimal rates.",
    inputSchema: {
      type: "object",
      properties: {
        vehicleName: {
          type: "string",
          description: "Vehicle to get pricing for"
        },
        location: {
          type: "string",
          description: "Location for seasonal adjustments"
        }
      },
      required: ["vehicleName"]
    }
  },
  getFleetPricingOverview: {
    name: "getFleetPricingOverview",
    description: "Get an overview of fleet pricing, utilization, and revenue with recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Filter by location or 'all'"
        }
      }
    }
  },
  getDemandForecast: {
    name: "getDemandForecast",
    description: "Get demand forecast for a location including upcoming events and peak season info.",
    inputSchema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "City to forecast demand for (default: miami)"
        },
        location: {
          type: "string",
          description: "Alternative to city parameter"
        },
        days: {
          type: "number",
          description: "Days ahead to forecast (default: 14)"
        }
      }
    }
  },
  getEventImpact: {
    name: "getEventImpact",
    description: "Analyze the potential impact of a specific event on demand and pricing.",
    inputSchema: {
      type: "object",
      properties: {
        eventName: {
          type: "string",
          description: "Name of the event (e.g., Art Basel, Super Bowl)"
        },
        location: {
          type: "string",
          description: "Location of the event"
        }
      },
      required: ["eventName"]
    }
  },

  // Customer Tools
  getCustomerProfile: {
    name: "getCustomerProfile",
    description: "Get detailed customer profile including status, bookings, and lifetime value.",
    inputSchema: {
      type: "object",
      properties: {
        customerName: {
          type: "string",
          description: "Name of the customer to look up"
        },
        includeHistory: {
          type: "boolean",
          description: "Whether to include booking history"
        }
      },
      required: ["customerName"]
    }
  },
  getCustomerLifetimeValue: {
    name: "getCustomerLifetimeValue",
    description: "Get a customer's lifetime value and booking count.",
    inputSchema: {
      type: "object",
      properties: {
        customerName: {
          type: "string",
          description: "Name of the customer"
        }
      },
      required: ["customerName"]
    }
  },

  // Operations Tools
  getDamageReports: {
    name: "getDamageReports",
    description: "Get damage claim reports, optionally filtered by status and location.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by claim status",
          enum: ["all", "pending", "in_progress", "resolved", "closed"]
        },
        location: {
          type: "string",
          description: "Filter by location"
        }
      }
    }
  },
  getUpcomingMaintenance: {
    name: "getUpcomingMaintenance",
    description: "Get upcoming maintenance schedules for the fleet.",
    inputSchema: {
      type: "object",
      properties: {
        daysAhead: {
          type: "number",
          description: "Number of days to look ahead (default: 30)"
        },
        location: {
          type: "string",
          description: "Filter by location"
        }
      }
    }
  },
  getVaultDocuments: {
    name: "getVaultDocuments",
    description: "Get documents from the vault (insurance, registration, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Document category to filter by"
        },
        status: {
          type: "string",
          description: "Document status filter"
        }
      }
    }
  },

  // Utility Tools
  getWeatherInfo: {
    name: "getWeatherInfo",
    description: "Get current weather information for a location.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Location to get weather for"
        }
      },
      required: ["location"]
    }
  },
  getCarJoke: {
    name: "getCarJoke",
    description: "Get a fun car-themed joke.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  logFeedback: {
    name: "logFeedback",
    description: "Log user feedback or feature requests.",
    inputSchema: {
      type: "object",
      properties: {
        feedbackType: {
          type: "string",
          description: "Type of feedback",
          enum: ["feature_request", "bug_report", "general", "not_working"]
        },
        keywords: {
          type: "string",
          description: "Comma-separated keywords"
        },
        userQuery: {
          type: "string",
          description: "The user's original query"
        },
        rariResponse: {
          type: "string",
          description: "Rari's response"
        },
        context: {
          type: "string",
          description: "Additional context as JSON string"
        }
      }
    }
  },
  featureComingSoon: {
    name: "featureComingSoon",
    description: "Log a feature request when a capability is not yet available.",
    inputSchema: {
      type: "object",
      properties: {
        featureName: {
          type: "string",
          description: "Name of the requested feature"
        },
        userRequest: {
          type: "string",
          description: "The user's original request"
        }
      },
      required: ["featureName"]
    }
  }
};

// Peak season calendar for pricing context — expanded with real-world events
const PEAK_SEASONS = [
  // Miami
  { name: 'Art Basel Miami', start: '12-01', end: '12-08', location: 'Miami', surge: 1.35 },
  { name: 'Miami Boat Show', start: '02-12', end: '02-16', location: 'Miami', surge: 1.30 },
  { name: 'Ultra Music Festival', start: '03-28', end: '03-30', location: 'Miami', surge: 1.35 },
  { name: 'Miami Grand Prix', start: '05-02', end: '05-04', location: 'Miami', surge: 1.40 },
  { name: 'Miami Open Tennis', start: '03-17', end: '03-30', location: 'Miami', surge: 1.25 },
  { name: 'Miami Swim Week', start: '06-01', end: '06-08', location: 'Miami', surge: 1.20 },
  { name: 'Spring Break', start: '03-10', end: '03-25', location: 'Miami', surge: 1.25 },
  // Scottsdale / Phoenix
  { name: 'Barrett-Jackson Auction', start: '01-18', end: '01-26', location: 'Scottsdale', surge: 1.35 },
  { name: 'WM Phoenix Open', start: '02-03', end: '02-09', location: 'Scottsdale', surge: 1.40 },
  { name: 'Scottsdale Arabian Horse Show', start: '02-13', end: '02-23', location: 'Scottsdale', surge: 1.20 },
  { name: 'Spring Training Baseball', start: '02-22', end: '03-25', location: 'Scottsdale', surge: 1.20 },
  { name: 'Scottsdale Arts Festival', start: '03-07', end: '03-09', location: 'Scottsdale', surge: 1.15 },
  // National holidays
  { name: 'Christmas & New Years', start: '12-20', end: '01-03', location: 'all', surge: 1.45 },
  { name: 'Super Bowl Weekend', start: '02-05', end: '02-12', location: 'all', surge: 1.50 },
  { name: 'Presidents Day Weekend', start: '02-14', end: '02-17', location: 'all', surge: 1.15 },
  { name: 'Memorial Day Weekend', start: '05-23', end: '05-26', location: 'all', surge: 1.25 },
  { name: 'Independence Day', start: '07-01', end: '07-06', location: 'all', surge: 1.30 },
  { name: 'Labor Day Weekend', start: '08-29', end: '09-01', location: 'all', surge: 1.20 },
  { name: 'Thanksgiving Week', start: '11-24', end: '11-30', location: 'all', surge: 1.30 },
  { name: 'Summer Peak', start: '06-15', end: '08-15', location: 'all', surge: 1.15 },
];

function getCurrentPeakSeason(location?: string): { name: string; surge: number } | null {
  const now = new Date();
  const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  for (const season of PEAK_SEASONS) {
    const inRange = monthDay >= season.start && monthDay <= season.end;
    const locationMatch = season.location === 'all' || !location || season.location.toLowerCase() === location.toLowerCase();
    if (inRange && locationMatch) {
      return { name: season.name, surge: season.surge };
    }
  }
  return null;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

// ============================================================
// Helper: Get user's team ID
// ============================================================
async function getUserTeamId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();
  return data?.team_id || null;
}

// ============================================================
// MCP JSON-RPC 2.0 Protocol Implementation
// ============================================================

// Session storage for SSE connections (in-memory for edge function)
const sessions = new Map<string, { controller: ReadableStreamDefaultController; encoder: TextEncoder }>();

function generateSessionId(): string {
  return crypto.randomUUID();
}

function createJSONRPCResponse(id: string | number | null, result: any): any {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function createJSONRPCError(id: string | number | null, code: number, message: string): any {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message }
  };
}

// Supabase project configuration
const SUPABASE_PROJECT_ID = 'jlgwbbqydjeokypoenoc';
const FUNCTION_BASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/rari-mcp-server`;

// Optional token authentication
function validateAuth(req: Request): boolean {
  const expectedToken = Deno.env.get('MCP_SECRET_TOKEN');
  if (!expectedToken) return true; // No token configured = open access
  
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${expectedToken}`) return true;
  
  // Also check apikey header as fallback
  const apiKey = req.headers.get('apikey');
  if (apiKey === expectedToken) return true;
  
  return false;
}

// Extract user ID from request context
async function extractUserId(req: Request, supabase: any): Promise<string> {
  // Try to get user ID from custom header
  const userIdHeader = req.headers.get('x-user-id') || req.headers.get('x-elevenlabs-user-id');
  if (userIdHeader) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userIdHeader)
      .single();
    if (profile) {
      console.log(`[MCP Server] Using user ID from header: ${userIdHeader}`);
      return userIdHeader;
    }
  }

  // Try to get from query parameter (for testing)
  const url = new URL(req.url);
  const userIdParam = url.searchParams.get('userId');
  if (userIdParam) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userIdParam)
      .single();
    if (profile) {
      console.log(`[MCP Server] Using user ID from query param: ${userIdParam}`);
      return userIdParam;
    }
  }

  // Fallback: Use demo user ID from environment or first user
  const demoUserId = Deno.env.get('DEMO_USER_ID');
  if (demoUserId) {
    console.log(`[MCP Server] Using demo user ID from env: ${demoUserId}`);
    return demoUserId;
  }

  // Last resort: Get first user
  const { data: firstUser } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  
  const userId = firstUser?.id || 'demo-user-id';
  console.log(`[MCP Server] Using fallback user ID: ${userId}`);
  return userId;
}

// Main server handler
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[MCP Server] ${req.method} ${path}`);

  // Validate authentication (optional)
  if (!validateAuth(req)) {
    console.log('[MCP Server] Unauthorized request');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // ============================================================
    // Manifest Endpoint - ElevenLabs compatible tool discovery
    // ============================================================
    if (path.endsWith('/manifest') && req.method === 'GET') {
      console.log('[MCP Server] Manifest requested (ElevenLabs format)');
      const tools = Object.values(TOOL_MANIFEST).map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }));
      return new Response(JSON.stringify({
        type: "mcp.tool_manifest",
        tools
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // SSE Endpoint
    // ============================================================
    if (path.endsWith('/sse') && req.method === 'GET') {
      console.log('[MCP Server] SSE connection requested');
      
      const sessionId = generateSessionId();
      const messagesEndpoint = `${FUNCTION_BASE_URL}/messages?sessionId=${sessionId}`;
      
      console.log(`[MCP Server] Session: ${sessionId}, Messages endpoint: ${messagesEndpoint}`);

      const encoder = new TextEncoder();
      let controllerRef: ReadableStreamDefaultController | null = null;
      let keepAliveInterval: number | null = null;
      
      const stream = new ReadableStream({
        start(controller) {
          controllerRef = controller;
          
          sessions.set(sessionId, { controller, encoder });
          console.log(`[MCP Server] Session ${sessionId} stored. Active sessions: ${sessions.size}`);
          
          const endpointMessage = `event: endpoint\ndata: ${messagesEndpoint}\n\n`;
          controller.enqueue(encoder.encode(endpointMessage));
          console.log(`[MCP Server] Sent endpoint event: ${messagesEndpoint}`);
          
          const readyMessage = `event: ready\ndata: {"status":"connected"}\n\n`;
          controller.enqueue(encoder.encode(readyMessage));
          console.log(`[MCP Server] Sent ready event`);
          
          keepAliveInterval = setInterval(() => {
            try {
              if (controllerRef) {
                controllerRef.enqueue(encoder.encode(': ping\n\n'));
              }
            } catch (e) {
              console.log(`[MCP Server] Keep-alive ping failed for session ${sessionId}, cleaning up`);
              if (keepAliveInterval) clearInterval(keepAliveInterval);
              sessions.delete(sessionId);
            }
          }, 15000) as unknown as number;
        },
        cancel() {
          console.log(`[MCP Server] Session ${sessionId} cancelled. Active sessions: ${sessions.size}`);
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
          sessions.delete(sessionId);
        }
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Session-Id': sessionId
        }
      });
    }

    // ============================================================
    // Messages Endpoint - Receives JSON-RPC requests via POST
    // ============================================================
    if (path.endsWith('/messages') && req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId');
      console.log(`[MCP Server] Message received for session: ${sessionId}`);
      
      const body = await req.json();
      console.log('[MCP Server] JSON-RPC request:', JSON.stringify(body, null, 2));
      
      const { jsonrpc, id, method, params } = body;
      
      if (jsonrpc !== '2.0') {
        return new Response(JSON.stringify(createJSONRPCError(id, -32600, 'Invalid JSON-RPC version')), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let response: any;

      switch (method) {
        case 'initialize': {
          console.log('[MCP Server] Handling initialize request');
          const requestedVersion = params?.protocolVersion;

          response = createJSONRPCResponse(id, {
            protocolVersion: requestedVersion || "2024-11-05",
            capabilities: {
              tools: {},
              resources: {},
              prompts: {}
            },
            serverInfo: {
              name: "Rari Fleet Assistant",
              version: "1.0.2"
            }
          });
          break;
        }

        case 'tools/list': {
          console.log('[MCP Server] Handling tools/list request');
          const tools = Object.values(TOOL_MANIFEST).map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }));
          response = createJSONRPCResponse(id, { tools });
          break;
        }

        case 'resources/list': {
          console.log('[MCP Server] Handling resources/list request (empty)');
          response = createJSONRPCResponse(id, { resources: [] });
          break;
        }

        case 'prompts/list': {
          console.log('[MCP Server] Handling prompts/list request (empty)');
          response = createJSONRPCResponse(id, { prompts: [] });
          break;
        }

        case 'ping': {
          response = createJSONRPCResponse(id, {});
          break;
        }

        case 'tools/call': {
          const { name: toolName, arguments: toolArgs } = params || {};
          console.log(`[MCP Server] Handling tools/call: ${toolName}`);
          console.log('[MCP Server] Tool arguments:', JSON.stringify(toolArgs));

          if (!toolName) {
            response = createJSONRPCError(id, -32602, 'Missing tool name');
            break;
          }

          // Initialize Supabase
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          // Extract user ID
          const userId = await extractUserId(req, supabase);
          
          // Get team ID for the user
          const teamId = await getUserTeamId(supabase, userId);
          if (!teamId) {
            response = createJSONRPCResponse(id, {
              content: [{
                type: "text",
                text: "Error: No team found. Please ensure you are assigned to a team."
              }],
              isError: true
            });
            break;
          }

          // Execute the tool
          const result = await executeFunction(toolName, toolArgs || {}, supabase, teamId);
          console.log('[MCP Server] Tool result:', JSON.stringify(result, null, 2));

          const responseText = result.summary 
            ? `${result.summary}\n\n${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}`
            : (typeof result === 'string' ? result : JSON.stringify(result, null, 2));

          if (result.error) {
            response = createJSONRPCResponse(id, {
              content: [{
                type: "text",
                text: `Error: ${result.error}\n${result.summary || 'An error occurred while executing the tool.'}`
              }],
              isError: true
            });
          } else {
            response = createJSONRPCResponse(id, {
              content: [{
                type: "text",
                text: responseText
              }],
              isError: false
            });
          }
          break;
        }

        case 'notifications/initialized': {
          console.log('[MCP Server] Client initialized notification received');
          return new Response(null, {
            status: 204,
            headers: corsHeaders
          });
        }

        default: {
          console.log(`[MCP Server] Unknown method: ${method}`);
          response = createJSONRPCError(id, -32601, `Method not found: ${method}`);
        }
      }

      console.log('[MCP Server] Sending response:', JSON.stringify(response, null, 2));

      const session = sessionId ? sessions.get(sessionId) : null;
      if (session) {
        try {
          const sseMessage = `event: message\ndata: ${JSON.stringify(response)}\n\n`;
          session.controller.enqueue(session.encoder.encode(sseMessage));
          console.log(`[MCP Server] Response sent via SSE to session ${sessionId}`);
        } catch (e) {
          console.log('[MCP Server] SSE send failed, returning HTTP response');
        }
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // REST Fallback - Tool discovery endpoint
    // ============================================================
    if (path.endsWith('/tools') && req.method === 'GET') {
      console.log('[MCP Server] Tools list requested (REST)');
      const tools = Object.values(TOOL_MANIFEST).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
      return new Response(JSON.stringify({ tools }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // Direct POST - Support direct tool execution (legacy format)
    // ============================================================
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[MCP Server] Direct POST received:', JSON.stringify(body, null, 2));

      // Check if it's a JSON-RPC request
      if (body.jsonrpc === '2.0' && body.method) {
        const { id, method, params } = body;
        
        if (method === 'initialize') {
          return new Response(JSON.stringify(createJSONRPCResponse(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "Rari Fleet Assistant", version: "1.0.2" }
          })), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (method === 'tools/list') {
          const tools = Object.values(TOOL_MANIFEST).map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }));
          return new Response(JSON.stringify(createJSONRPCResponse(id, { tools })), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (method === 'tools/call') {
          const { name: toolName, arguments: toolArgs } = params || {};
          
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          
          const userId = await extractUserId(req, supabase);
          const teamId = await getUserTeamId(supabase, userId);
          
          if (!teamId) {
            return new Response(JSON.stringify(createJSONRPCResponse(id, {
              content: [{ type: "text", text: "Error: No team found." }],
              isError: true
            })), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const result = await executeFunction(toolName, toolArgs || {}, supabase, teamId);
          
          return new Response(JSON.stringify(createJSONRPCResponse(id, {
            content: [{ type: "text", text: result.summary || JSON.stringify(result) }],
            isError: !!result.error
          })), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Legacy ElevenLabs webhook format
      const { tool_name, parameters } = body;
      
      if (tool_name) {
        console.log(`[MCP Server] Legacy tool call: ${tool_name}`);
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const userId = await extractUserId(req, supabase);
        const teamId = await getUserTeamId(supabase, userId);
        
        if (!teamId) {
          return new Response(JSON.stringify({
            error: 'No team found',
            summary: 'Please ensure you are assigned to a team.'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const result = await executeFunction(tool_name, parameters || {}, supabase, teamId);
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(createJSONRPCError(null, -32600, 'Invalid request format')), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // Default: Return server info
    // ============================================================
    return new Response(JSON.stringify({
      name: "Rari Fleet Assistant MCP Server",
      version: "1.0.2",
      protocol: "MCP (JSON-RPC 2.0)",
      description: "MCP server for Exotiq luxury fleet management",
      transport: "SSE",
      endpoints: {
        sse: "/rari-mcp-server/sse",
        messages: "/rari-mcp-server/messages",
        tools: "/rari-mcp-server/tools"
      },
      toolCount: Object.keys(TOOL_MANIFEST).length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[MCP Server] Error:', error);
    return new Response(JSON.stringify(createJSONRPCError(null, -32603, error instanceof Error ? error.message : 'Internal error')), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ============================================================
// Tool Execution Functions - All using team_id
// ============================================================

async function executeFunction(functionName: string, args: any, supabase: any, teamId: string) {
  console.log(`[TOOL] Executing: ${functionName} | Team: ${teamId}`);

  try {
    switch (functionName) {
      case "get_fleet_vehicles": {
        const { status, location } = args;
        let query = supabase.from('vehicles').select('*').eq('team_id', teamId);
        if (location && location !== 'all') query = query.eq('location', location);
        
        const { data: vehicles, error } = await query.order('created_at', { ascending: false });
        if (error) return { error: 'Failed to fetch vehicles', summary: 'Error retrieving vehicles.' };
        if (!vehicles?.length) return { count: 0, vehicles: [], summary: `No vehicles found${location ? ` in ${location}` : ''}.` };

        // Get active bookings
        const now = new Date().toISOString();
        const { data: activeBookings } = await supabase
          .from('bookings')
          .select('vehicle_id')
          .eq('team_id', teamId)
          .eq('status', 'confirmed')
          .lte('start_date', now)
          .gte('end_date', now);
        
        const rentedVehicleIds = new Set(activeBookings?.map((b: any) => b.vehicle_id) || []);

        const vehicleList = vehicles.map((v: any) => {
          const realStatus = rentedVehicleIds.has(v.id) ? 'rented' : v.status;
          return {
            name: `${v.year} ${v.make} ${v.model}`,
            status: realStatus,
            location: v.location || 'Miami',
            rate: `$${v.current_rate}/day`,
            utilization: `${v.utilization || 0}%`
          };
        });

        let filteredList = vehicleList;
        if (status && status !== 'all') {
          filteredList = vehicleList.filter((v: any) => v.status === status);
        }

        return {
          count: filteredList.length,
          vehicles: filteredList,
          summary: `Found ${filteredList.length} vehicles${status && status !== 'all' ? ` that are ${status}` : ''}${location ? ` in ${location}` : ''}.`
        };
      }

      case "getFleetMetrics": {
        const { timeframe, location } = args;
        let dateFilter = new Date();
        if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
        else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
        else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
        else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);

        let vehicleQuery = supabase.from('vehicles').select('*').eq('team_id', teamId);
        if (location && location !== 'all') vehicleQuery = vehicleQuery.eq('location', location);

        const [vehiclesResult, bookingsResult, revenueResult] = await Promise.all([
          vehicleQuery,
          supabase.from('bookings').select('*, vehicles(location)').eq('team_id', teamId).gte('created_at', dateFilter.toISOString()),
          supabase.from('bookings').select('total_value, vehicles(location)').eq('team_id', teamId).eq('status', 'completed').gte('created_at', dateFilter.toISOString())
        ]);

        const vehicles = vehiclesResult.data || [];
        let bookings = bookingsResult.data || [];
        let revenue = revenueResult.data || [];

        if (location && location !== 'all') {
          bookings = bookings.filter((b: any) => b.vehicles?.location?.toLowerCase() === location.toLowerCase());
          revenue = revenue.filter((b: any) => b.vehicles?.location?.toLowerCase() === location.toLowerCase());
        }

        const totalRevenue = revenue.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
        
        const now = new Date();
        const activeBookings = bookings.filter((b: any) => {
          const start = new Date(b.start_date);
          const end = new Date(b.end_date);
          return b.status === 'confirmed' && start <= now && end >= now;
        }).length;
        
        const avgUtilization = vehicles.length > 0 ? vehicles.reduce((sum: number, v: any) => sum + (v.utilization || 0), 0) / vehicles.length : 0;
        const peakSeason = getCurrentPeakSeason(location);

        return {
          totalVehicles: vehicles.length,
          activeBookings,
          totalBookings: bookings.length,
          revenue: totalRevenue,
          averageUtilization: `${avgUtilization.toFixed(0)}%`,
          timeframe,
          peakSeason: peakSeason?.name || null,
          summary: `${location ? `${location} fleet` : 'Fleet'}: ${vehicles.length} vehicles, ${activeBookings} active bookings, $${totalRevenue.toFixed(0)} revenue.${peakSeason ? ` Currently in ${peakSeason.name}.` : ''}`
        };
      }

      case "getLocationMetrics": {
        const { location } = args;
        const { data: allVehicles } = await supabase.from('vehicles').select('*').eq('team_id', teamId);
        if (!allVehicles?.length) return { summary: "No vehicles in fleet." };

        const locationStats: Record<string, any> = {};
        for (const vehicle of allVehicles) {
          const loc = vehicle.location || 'Miami';
          if (!locationStats[loc]) {
            locationStats[loc] = { location: loc, vehicleCount: 0, totalRevenue: 0, totalUtilization: 0, avgRate: 0, vehicles: [] };
          }
          locationStats[loc].vehicleCount++;
          locationStats[loc].totalRevenue += Number(vehicle.revenue || 0);
          locationStats[loc].totalUtilization += (vehicle.utilization || 0);
          locationStats[loc].avgRate += Number(vehicle.current_rate || 0);
        }

        for (const loc of Object.keys(locationStats)) {
          const stats = locationStats[loc];
          stats.avgUtilization = stats.totalUtilization / stats.vehicleCount;
          stats.avgRate = stats.avgRate / stats.vehicleCount;
        }

        if (location && location !== 'all' && locationStats[location]) {
          const stats = locationStats[location];
          return {
            location: stats.location,
            vehicleCount: stats.vehicleCount,
            totalRevenue: `$${stats.totalRevenue.toFixed(0)}`,
            avgUtilization: `${stats.avgUtilization.toFixed(0)}%`,
            summary: `${location}: ${stats.vehicleCount} vehicles, $${stats.totalRevenue.toFixed(0)} revenue, ${stats.avgUtilization.toFixed(0)}% utilization.`
          };
        }

        const locations = Object.values(locationStats);
        return {
          locationCount: locations.length,
          locations: locations.map((l: any) => ({ location: l.location, vehicleCount: l.vehicleCount, totalRevenue: `$${l.totalRevenue.toFixed(0)}` })),
          summary: `Fleet spans ${locations.length} locations: ${locations.map((l: any) => `${l.location} (${l.vehicleCount} vehicles)`).join(', ')}.`
        };
      }

      case "getPaymentSummary": {
        const { status, timeframe, location } = args;
        let dateFilter = new Date();
        if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
        else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
        else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
        else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);
        else dateFilter = new Date(0);

        const { data: payments } = await supabase.from('payments').select('*, bookings(customer_name, vehicle_id, vehicles(location))').eq('team_id', teamId).gte('transaction_date', dateFilter.toISOString()).order('transaction_date', { ascending: false });

        let filteredPayments = payments || [];
        if (location && location !== 'all') filteredPayments = filteredPayments.filter((p: any) => p.bookings?.vehicles?.location?.toLowerCase() === location.toLowerCase());
        if (status && status !== 'all') filteredPayments = filteredPayments.filter((p: any) => p.payment_status === status);

        const totalAmount = filteredPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
        const byStatus = filteredPayments.reduce((acc: Record<string, number>, p: any) => { const s = p.payment_status || 'unknown'; acc[s] = (acc[s] || 0) + Number(p.amount || 0); return acc; }, {} as Record<string, number>);

        return {
          totalPayments: filteredPayments.length,
          totalAmount: `$${totalAmount.toFixed(0)}`,
          completedAmount: `$${(byStatus['completed'] || 0).toFixed(0)}`,
          pendingAmount: `$${(byStatus['pending'] || 0).toFixed(0)}`,
          summary: `${timeframe || 'Total'} payments${location ? ` in ${location}` : ''}: $${totalAmount.toFixed(0)} across ${filteredPayments.length} transactions.`
        };
      }

      case "get_bookings": {
        const { status, start_date, end_date, location } = args;
        let query = supabase.from('bookings').select('*, vehicles(name, make, model, year, location), customers(full_name)').eq('team_id', teamId);
        if (status && status !== 'all') query = query.eq('status', status);
        if (start_date) query = query.gte('start_date', start_date);
        if (end_date) query = query.lte('end_date', end_date);

        const { data: bookings } = await query.order('start_date', { ascending: false }).limit(30);
        let filteredBookings = bookings || [];
        if (location && location !== 'all') filteredBookings = filteredBookings.filter((b: any) => b.vehicles?.location?.toLowerCase() === location.toLowerCase());

        const totalRevenue = filteredBookings.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
        return {
          count: filteredBookings.length,
          totalRevenue: `$${totalRevenue.toFixed(0)}`,
          summary: `${filteredBookings.length} bookings${status && status !== 'all' ? ` (${status})` : ''}${location ? ` in ${location}` : ''}. Total: $${totalRevenue.toFixed(0)}.`
        };
      }

      case "get_recent_activity": {
        const { limit = 10 } = args;
        const { data: recentBookings } = await supabase.from('bookings').select('*, vehicles(name, make, model, year, location), customers(full_name)').eq('team_id', teamId).order('created_at', { ascending: false }).limit(limit);

        const activities = recentBookings?.map((b: any) => ({
          description: `${b.customers?.full_name || 'Customer'} booked ${b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'vehicle'} for $${Number(b.total_value || 0).toFixed(0)}`,
          timeAgo: getTimeAgo(new Date(b.created_at))
        })) || [];

        return { count: activities.length, activities, summary: `Recent: ${activities.slice(0, 3).map((a: any) => a.description).join('. ')}` };
      }

      case "getVehicleDetails": {
        const { vehicleName, includeBookings } = args;
        const { data: vehicle } = await supabase.from('vehicles').select('*').eq('team_id', teamId).or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`).maybeSingle();
        if (!vehicle) return { error: "Vehicle not found", summary: `No vehicle matching "${vehicleName}".` };

        let bookingsData = null;
        if (includeBookings) {
          const { data: bookings } = await supabase.from('bookings').select('*, customers(full_name)').eq('vehicle_id', vehicle.id).order('start_date', { ascending: false }).limit(5);
          bookingsData = bookings?.map((b: any) => ({ customer: b.customers?.full_name || b.customer_name, status: b.status, total: `$${Number(b.total_value || 0).toFixed(0)}` }));
        }

        return {
          vehicle: { name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, status: vehicle.status, location: vehicle.location || 'Miami', rate: `$${vehicle.current_rate}/day`, utilization: `${vehicle.utilization}%` },
          bookings: bookingsData,
          summary: `${vehicle.year} ${vehicle.make} ${vehicle.model} is ${vehicle.status} at $${vehicle.current_rate}/day with ${vehicle.utilization}% utilization.`
        };
      }

      case "checkAvailability": {
        const { vehicleName, startDate, endDate, location } = args;
        let vehicleQuery = supabase.from('vehicles').select('id, name, make, model, year, status, location, current_rate').eq('team_id', teamId);
        if (vehicleName) vehicleQuery = vehicleQuery.or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`);
        if (location) vehicleQuery = vehicleQuery.eq('location', location);

        const { data: vehicles } = await vehicleQuery;
        if (!vehicles?.length) return { error: "No vehicles found", summary: "No matching vehicles." };

        const results = [];
        for (const vehicle of vehicles) {
          const { data: conflicts } = await supabase.from('bookings').select('id').eq('vehicle_id', vehicle.id).in('status', ['active', 'confirmed', 'pending']).or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);
          results.push({ vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, location: vehicle.location, available: !conflicts?.length });
        }

        const available = results.filter(r => r.available);
        return {
          requestedDates: `${startDate} to ${endDate}`,
          availableVehicles: available,
          summary: available.length > 0 ? `${available.length} vehicle${available.length > 1 ? 's' : ''} available: ${available.map(v => v.vehicle).join(', ')}.` : 'No vehicles available for those dates.'
        };
      }

      case "getRevenueAnalysis": {
        const { timeframe, vehicleName, location } = args;
        let dateFilter = new Date();
        if (timeframe === 'today') dateFilter.setHours(0, 0, 0, 0);
        else if (timeframe === 'week') dateFilter.setDate(dateFilter.getDate() - 7);
        else if (timeframe === 'month') dateFilter.setMonth(dateFilter.getMonth() - 1);
        else if (timeframe === 'year') dateFilter.setFullYear(dateFilter.getFullYear() - 1);

        const { data: bookings } = await supabase.from('bookings').select('total_value, daily_rate, vehicles(name, make, model, year, location)').eq('team_id', teamId).eq('status', 'completed').gte('created_at', dateFilter.toISOString());

        let filtered = bookings || [];
        if (location && location !== 'all') filtered = filtered.filter((b: any) => b.vehicles?.location?.toLowerCase() === location.toLowerCase());
        if (vehicleName) filtered = filtered.filter((b: any) => `${b.vehicles?.make} ${b.vehicles?.model}`.toLowerCase().includes(vehicleName.toLowerCase()));

        const totalRevenue = filtered.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
        return {
          totalRevenue: `$${totalRevenue.toFixed(0)}`,
          bookingCount: filtered.length,
          summary: `${timeframe || 'Total'} revenue${location ? ` from ${location}` : ''}: $${totalRevenue.toFixed(0)} across ${filtered.length} bookings.`
        };
      }

      case "getTopPerformers": {
        const { metric, limit = 5, location } = args;
        if (metric === 'revenue' || metric === 'utilization') {
          let query = supabase.from('vehicles').select('name, make, model, year, revenue, utilization, location').eq('team_id', teamId);
          if (location && location !== 'all') query = query.eq('location', location);
          
          const { data: vehicles } = await query.order(metric, { ascending: false }).limit(limit);
          const performers = vehicles?.map((v: any) => ({ name: `${v.year} ${v.make} ${v.model}`, value: metric === 'revenue' ? `$${Number(v.revenue || 0).toFixed(0)}` : `${v.utilization}%` })) || [];
          return { metric, performers, summary: `Top by ${metric}: ${performers.map((p: any) => `${p.name} (${p.value})`).join(', ')}.` };
        } else {
          const { data: customers } = await supabase.from('customers').select('full_name, total_bookings, lifetime_value').eq('team_id', teamId).order('lifetime_value', { ascending: false }).limit(limit);
          const performers = customers?.map((c: any) => ({ name: c.full_name, value: `$${Number(c.lifetime_value || 0).toFixed(0)}` })) || [];
          return { metric: 'customers', performers, summary: `Top customers: ${performers.map((p: any) => `${p.name} (${p.value})`).join(', ')}.` };
        }
      }

      case "searchBookings": {
        const { status, daysRange, location } = args;
        let query = supabase.from('bookings').select('*, vehicles(name, make, model, year, location), customers(full_name)').eq('team_id', teamId);
        if (status) query = query.eq('status', status);
        if (daysRange) {
          const dateFilter = new Date();
          dateFilter.setDate(dateFilter.getDate() - daysRange);
          query = query.gte('start_date', dateFilter.toISOString());
        }

        const { data: bookings } = await query.order('start_date', { ascending: false }).limit(30);
        let filtered = bookings || [];
        if (location && location !== 'all') filtered = filtered.filter((b: any) => b.vehicles?.location?.toLowerCase() === location.toLowerCase());

        const totalValue = filtered.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);
        return { count: filtered.length, totalValue: `$${totalValue.toFixed(0)}`, summary: `Found ${filtered.length} bookings${status ? ` (${status})` : ''}${location ? ` in ${location}` : ''}.` };
      }

      case "getCustomerProfile": {
        const { customerName, includeHistory } = args;
        const { data: customer } = await supabase.from('customers').select('*').eq('team_id', teamId).ilike('full_name', `%${customerName}%`).maybeSingle();
        if (!customer) return { error: "Customer not found", summary: `No customer matching "${customerName}".` };

        let bookingsData = null;
        if (includeHistory) {
          const { data: bookings } = await supabase.from('bookings').select('*, vehicles(name, make, model, year, location)').eq('customer_id', customer.id).order('start_date', { ascending: false }).limit(10);
          bookingsData = bookings?.map((b: any) => ({ vehicle: b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : 'Unknown', status: b.status, total: `$${Number(b.total_value || 0).toFixed(0)}` }));
        }

        return {
          customer: { name: customer.full_name, email: customer.email, totalBookings: customer.total_bookings || 0, lifetimeValue: `$${Number(customer.lifetime_value || 0).toFixed(0)}` },
          bookings: bookingsData,
          summary: `${customer.full_name}: ${customer.total_bookings || 0} bookings, $${Number(customer.lifetime_value || 0).toFixed(0)} lifetime value.`
        };
      }

      case "getCustomerLifetimeValue": {
        const { customerName } = args;
        const { data: customer } = await supabase.from('customers').select('full_name, lifetime_value, total_bookings, customer_status').eq('team_id', teamId).ilike('full_name', `%${customerName}%`).maybeSingle();
        if (!customer) return { error: "Customer not found", summary: `No customer matching "${customerName}".` };
        return { customer: { name: customer.full_name, totalBookings: customer.total_bookings || 0, lifetimeValue: `$${Number(customer.lifetime_value || 0).toFixed(0)}` }, summary: `${customer.full_name}: $${Number(customer.lifetime_value || 0).toFixed(0)} lifetime value.` };
      }

      case "getPricingRecommendation": {
        const { vehicleName, location } = args;
        let vehicleQuery = supabase.from('vehicles').select('*').eq('team_id', teamId);
        if (vehicleName) vehicleQuery = vehicleQuery.or(`name.ilike.%${vehicleName}%,make.ilike.%${vehicleName}%,model.ilike.%${vehicleName}%`);
        if (location) vehicleQuery = vehicleQuery.eq('location', location);

        const { data: vehicle } = await vehicleQuery.maybeSingle();
        if (!vehicle) return { error: "Vehicle not found", summary: `No vehicle matching "${vehicleName}".` };

        const currentRate = Number(vehicle.current_rate);
        const utilization = vehicle.utilization || 0;
        const peakSeason = getCurrentPeakSeason(vehicle.location);
        let suggestedRate = currentRate;
        const factors: string[] = [];

        if (utilization > 80) { suggestedRate *= 1.15; factors.push(`high demand (${utilization}% util)`); }
        else if (utilization < 50) { suggestedRate *= 0.95; factors.push(`low utilization (${utilization}%)`); }
        if (peakSeason) { suggestedRate *= peakSeason.surge; factors.push(`${peakSeason.name} (+${((peakSeason.surge - 1) * 100).toFixed(0)}%)`); }

        suggestedRate = Math.round(suggestedRate / 5) * 5;
        const difference = suggestedRate - currentRate;

        return {
          vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          currentRate: `$${currentRate}`,
          suggestedRate: `$${suggestedRate}`,
          difference: difference > 0 ? `+$${difference}` : `$${difference}`,
          factors,
          summary: suggestedRate > currentRate ? `Recommend increasing ${vehicle.make} ${vehicle.model} from $${currentRate} to $${suggestedRate}/day based on ${factors.join(', ')}.` : `Current rate of $${currentRate} is optimal.`
        };
      }

      case "getFleetPricingOverview": {
        const { location } = args;
        let query = supabase.from('vehicles').select('*').eq('team_id', teamId);
        if (location && location !== 'all') query = query.eq('location', location);

        const { data: vehicles } = await query;
        if (!vehicles?.length) return { summary: `No vehicles${location ? ` in ${location}` : ''} to analyze.` };

        const totalVehicles = vehicles.length;
        const avgRate = vehicles.reduce((sum: number, v: any) => sum + Number(v.current_rate), 0) / totalVehicles;
        const avgUtilization = vehicles.reduce((sum: number, v: any) => sum + (v.utilization || 0), 0) / totalVehicles;
        const totalRevenue = vehicles.reduce((sum: number, v: any) => sum + Number(v.revenue || 0), 0);

        return {
          totalVehicles,
          averageRate: `$${avgRate.toFixed(0)}`,
          averageUtilization: `${avgUtilization.toFixed(0)}%`,
          totalFleetRevenue: `$${totalRevenue.toFixed(0)}`,
          summary: `Fleet${location ? ` in ${location}` : ''}: ${totalVehicles} vehicles, avg $${avgRate.toFixed(0)}/day, ${avgUtilization.toFixed(0)}% utilization, $${totalRevenue.toFixed(0)} total revenue.`
        };
      }

      case "getDemandForecast": {
        const { city = 'miami', days = 14, location } = args;
        const effectiveLocation = location || city;
        const peakSeason = getCurrentPeakSeason(effectiveLocation);

        const { data: bookings } = await supabase.from('bookings').select('start_date, total_value, vehicles(location)').eq('team_id', teamId).gte('start_date', new Date().toISOString()).order('start_date', { ascending: true }).limit(20);

        let filtered = bookings || [];
        if (effectiveLocation !== 'all') filtered = filtered.filter((b: any) => b.vehicles?.location?.toLowerCase().includes(effectiveLocation.toLowerCase()));

        const upcomingBookings = filtered.length;
        const upcomingRevenue = filtered.reduce((sum: number, b: any) => sum + Number(b.total_value || 0), 0);

        return {
          location: effectiveLocation,
          forecastDays: days,
          demandMultiplier: peakSeason?.surge || 1.0,
          peakSeason: peakSeason?.name || null,
          upcomingBookings,
          upcomingRevenue: `$${upcomingRevenue.toFixed(0)}`,
          summary: peakSeason ? `${effectiveLocation} in ${peakSeason.name} peak (${((peakSeason.surge - 1) * 100).toFixed(0)}% surge). ${upcomingBookings} upcoming bookings worth $${upcomingRevenue.toFixed(0)}.` : `${effectiveLocation}: ${upcomingBookings} bookings worth $${upcomingRevenue.toFixed(0)} coming up.`
        };
      }

      case "getEventImpact": {
        const { eventName, location } = args;
        const peakSeason = PEAK_SEASONS.find(s => s.name.toLowerCase().includes(eventName.toLowerCase()) || eventName.toLowerCase().includes(s.name.toLowerCase()));

        if (peakSeason) {
          return {
            eventName: peakSeason.name,
            dates: `${peakSeason.start} to ${peakSeason.end}`,
            surgePricing: peakSeason.surge,
            summary: `${peakSeason.name} (${peakSeason.start} to ${peakSeason.end}): Recommend ${((peakSeason.surge - 1) * 100).toFixed(0)}% price surge.`
          };
        }

        return { searched: eventName, summary: `For events like "${eventName}", expect 15-30% demand increase. Recommend raising rates 2-3 days before.` };
      }

      case "getDamageReports": {
        const { status, location } = args;
        let query = supabase.from('damage_claims').select('*, vehicles(name, make, model, year, location)').eq('team_id', teamId);
        if (status && status !== 'all') query = query.eq('claim_status', status);

        const { data: claims } = await query.order('reported_date', { ascending: false });
        let filtered = claims || [];
        if (location && location !== 'all') filtered = filtered.filter((c: any) => c.vehicles?.location?.toLowerCase() === location.toLowerCase());

        return { claims: filtered.map(c => ({ vehicle: c.vehicles ? `${c.vehicles.year} ${c.vehicles.make} ${c.vehicles.model}` : 'Unknown', severity: c.severity, status: c.claim_status })), count: filtered.length, summary: `${filtered.length} damage report${filtered.length !== 1 ? 's' : ''}.` };
      }

      case "getUpcomingMaintenance": {
        const { daysAhead = 30, location } = args;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        const { data: maintenance } = await supabase.from('maintenance_schedules').select('*, vehicles(name, make, model, year, location)').eq('team_id', teamId).lte('scheduled_date', futureDate.toISOString()).gte('scheduled_date', new Date().toISOString()).order('scheduled_date', { ascending: true });

        let filtered = maintenance || [];
        if (location && location !== 'all') filtered = filtered.filter((m: any) => m.vehicles?.location?.toLowerCase() === location.toLowerCase());

        return { maintenance: filtered.map(m => ({ vehicle: m.vehicles ? `${m.vehicles.year} ${m.vehicles.make} ${m.vehicles.model}` : 'Unknown', type: m.maintenance_type, date: new Date(m.scheduled_date).toLocaleDateString() })), count: filtered.length, summary: `${filtered.length} maintenance task${filtered.length !== 1 ? 's' : ''} in next ${daysAhead} days.` };
      }

      case "getVaultDocuments": {
        const mockDocs = [
          { name: "McLaren 720S Insurance", category: "insurance", status: "active", expires: "2025-03-15" },
          { name: "Ferrari SF90 Registration", category: "registration", status: "active", expires: "2025-06-30" },
          { name: "Lamborghini Service Record", category: "inspection", status: "expiring", expires: "2024-11-18" }
        ];
        return { documents: mockDocs, summary: `Found ${mockDocs.length} documents in vault.` };
      }

      case "getVehicleSpecs": {
        const { vehicleName } = args;
        const specsDatabase: Record<string, any> = {
          "ferrari sf90": { make: "Ferrari", model: "SF90 Stradale", engine: "4.0L V8 + Electric Motors", horsepower: "986 hp", acceleration: "2.5 sec (0-60 mph)", topSpeed: "211 mph" },
          "lamborghini aventador": { make: "Lamborghini", model: "Aventador SVJ", engine: "6.5L V12", horsepower: "770 hp", acceleration: "2.8 sec (0-60 mph)", topSpeed: "217 mph" },
          "mclaren 720s": { make: "McLaren", model: "720S Spider", engine: "4.0L Twin-Turbo V8", horsepower: "710 hp", acceleration: "2.8 sec (0-60 mph)", topSpeed: "212 mph" },
          "bugatti chiron": { make: "Bugatti", model: "Chiron Sport", engine: "8.0L Quad-Turbo W16", horsepower: "1,479 hp", acceleration: "2.4 sec (0-60 mph)", topSpeed: "261 mph" },
          "porsche 911": { make: "Porsche", model: "911 Turbo S", engine: "3.7L Twin-Turbo Flat-6", horsepower: "640 hp", acceleration: "2.6 sec (0-60 mph)", topSpeed: "205 mph" }
        };

        const searchKey = vehicleName.toLowerCase();
        const spec = Object.keys(specsDatabase).find(key => searchKey.includes(key) || key.includes(searchKey));
        if (spec) {
          const specData = specsDatabase[spec];
          return { ...specData, summary: `${specData.make} ${specData.model}: ${specData.engine}, ${specData.horsepower}, 0-60 in ${specData.acceleration}.` };
        }
        return { error: "Vehicle specs not found", summary: `No specs for "${vehicleName}". Try Ferrari SF90, Lamborghini Aventador, McLaren 720S, Bugatti Chiron, or Porsche 911.` };
      }

      case "getWeatherInfo": {
        const { location } = args;
        const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain"];
        return { location, temperature: `${Math.floor(Math.random() * 30) + 60}°F`, conditions: conditions[Math.floor(Math.random() * conditions.length)], note: "Simulated data" };
      }

      case "getCarJoke": {
        const jokes = [
          "Why did the exotic car break up with the sedan? It said their relationship had no spark plugs!",
          "What do you call a Lamborghini that's been in an accident? A Lamb-bore-gini!",
          "Why don't Ferraris ever get lost? Because they always follow the red line!",
          "What's a McLaren's favorite music? Heavy metal... and carbon fiber!",
          "Why did the Bugatti go to therapy? It had too many speed issues!"
        ];
        return { joke: jokes[Math.floor(Math.random() * jokes.length)] };
      }

      case "logFeedback": {
        const { feedbackType, keywords, userQuery, rariResponse, context } = args;
        // Note: For feedback, we still use a user context, but it's acceptable to skip team context here
        const { data: firstUser } = await supabase.from('profiles').select('id').limit(1).single();
        await supabase.from('rari_feedback').insert({
          user_id: firstUser?.id || 'unknown',
          feedback_type: feedbackType || 'feature_request',
          keywords: keywords ? keywords.split(',').map((k: string) => k.trim()) : [],
          user_query: userQuery,
          rari_response: rariResponse,
          context: context ? JSON.parse(context) : null
        });
        return { success: true, summary: "Feedback logged. Is there anything else I can help with?" };
      }

      case "featureComingSoon": {
        const { featureName, userRequest } = args;
        const { data: firstUser } = await supabase.from('profiles').select('id').limit(1).single();
        await supabase.from('rari_feedback').insert({ user_id: firstUser?.id || 'unknown', feedback_type: 'feature_request', keywords: [featureName], user_query: userRequest, rari_response: `Feature coming soon: ${featureName}`, context: { requested_feature: featureName } });
        return { feature: featureName, status: 'coming_soon', summary: `${featureName} is coming soon! I've logged your request.` };
      }

      default:
        const { data: firstUser } = await supabase.from('profiles').select('id').limit(1).single();
        await supabase.from('rari_feedback').insert({ user_id: firstUser?.id || 'unknown', feedback_type: 'not_working', keywords: [functionName], user_query: JSON.stringify(args), context: { function_name: functionName, args } });
        return { error: `Capability not available yet`, summary: `That feature isn't available yet, but I've logged it.` };
    }
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    return { error: error instanceof Error ? error.message : 'Function execution failed' };
  }
}
