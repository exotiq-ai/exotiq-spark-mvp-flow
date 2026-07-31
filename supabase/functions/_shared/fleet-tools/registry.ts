// Canonical FleetCopilot tool catalog.
//
// One source of truth for every capability Rari exposes, regardless of surface:
//   - elevenlabs-tools   (voice webhook)
//   - rari-mcp-server    (MCP / auto-discovered tools)
//   - fleet-copilot-chat (in-app text chat function calling)
//
// Adding a capability = add a `case` in executor.ts + an entry here.
// No surface should carry its own tool list again.

export type ToolCategory =
  | 'fleet'
  | 'bookings'
  | 'customers'
  | 'money'
  | 'pricing'
  | 'operations'
  | 'insights'
  | 'meta';

export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface FleetToolDefinition {
  /** Exact dispatch name understood by executeFunction(). */
  name: string;
  category: ToolCategory;
  description: string;
  params: ToolParam[];
  /** false => mutates data; surfaces should require confirmation. */
  readOnly: boolean;
}

const p = (
  name: string,
  type: ToolParam['type'],
  description: string,
  opts: Partial<ToolParam> = {},
): ToolParam => ({ name, type, description, ...opts });

const TIMEFRAME = p('timeframe', 'string', 'Rental window to measure: today, week, month, year, or all', {
  enum: ['today', 'week', 'month', 'year', 'all'],
});
const LOCATION = p('location', 'string', 'Filter to a single location/market');
const LIMIT = p('limit', 'number', 'Maximum number of records to return');

export const FLEET_TOOLS: FleetToolDefinition[] = [
  // ---------------- fleet ----------------
  {
    name: 'get_fleet_vehicles',
    category: 'fleet',
    description: 'List vehicles in the fleet, optionally filtered by status or location.',
    params: [
      p('status', 'string', 'available, booked, maintenance, or retired', {
        enum: ['available', 'booked', 'maintenance', 'retired'],
      }),
      LOCATION,
      LIMIT,
    ],
    readOnly: true,
  },
  {
    name: 'get_vehicle_status',
    category: 'fleet',
    description: 'Current operational status of one vehicle (available, on rent, out of service).',
    params: [p('vehicle', 'string', 'Vehicle name, make/model, or plate', { required: true })],
    readOnly: true,
  },
  {
    name: 'getVehicleDetails',
    category: 'fleet',
    description: 'Full detail record for a single vehicle including rates and utilisation.',
    params: [p('vehicle', 'string', 'Vehicle name, make/model, or plate', { required: true })],
    readOnly: true,
  },
  {
    name: 'getVehicleSpecs',
    category: 'fleet',
    description: 'Manufacturer specifications for a vehicle in the fleet.',
    params: [p('vehicle', 'string', 'Vehicle name or make/model', { required: true })],
    readOnly: true,
  },
  {
    name: 'getIdleVehicles',
    category: 'fleet',
    description: 'Vehicles with no upcoming or recent bookings that are sitting idle.',
    params: [p('days', 'number', 'Idle threshold in days'), LOCATION],
    readOnly: true,
  },
  {
    name: 'getFleetMetrics',
    category: 'fleet',
    description: 'Fleet-wide headline metrics: size, utilisation, availability, revenue.',
    params: [TIMEFRAME, LOCATION],
    readOnly: true,
  },
  {
    name: 'getLocationMetrics',
    category: 'fleet',
    description: 'Per-location performance breakdown.',
    params: [LOCATION, TIMEFRAME],
    readOnly: true,
  },
  {
    name: 'compareLocations',
    category: 'fleet',
    description: 'Side-by-side comparison of two or more locations.',
    params: [TIMEFRAME],
    readOnly: true,
  },

  // ---------------- bookings ----------------
  {
    name: 'get_bookings',
    category: 'bookings',
    description: 'List bookings filtered by status and timeframe (measured on the rental window).',
    params: [
      p('status', 'string', 'pending, requested, confirmed, active, completed, or cancelled'),
      TIMEFRAME,
      LIMIT,
    ],
    readOnly: true,
  },
  {
    name: 'searchBookings',
    category: 'bookings',
    description: 'Free-text search across bookings by customer, vehicle, or reference.',
    params: [p('query', 'string', 'Search text', { required: true }), LIMIT],
    readOnly: true,
  },
  {
    name: 'get_booking_by_reference',
    category: 'bookings',
    description: 'Look up one booking by its human reference (e.g. BK-01234).',
    params: [p('reference', 'string', 'Booking reference', { required: true })],
    readOnly: true,
  },
  {
    name: 'get_todays_schedule',
    category: 'bookings',
    description: "Today's pickups, returns and vehicles currently on rent.",
    params: [LOCATION],
    readOnly: true,
  },
  {
    name: 'checkAvailability',
    category: 'bookings',
    description: 'Check whether a vehicle (or the fleet) is free for a date range.',
    params: [
      p('vehicle', 'string', 'Vehicle name or make/model'),
      p('startDate', 'string', 'ISO start date', { required: true }),
      p('endDate', 'string', 'ISO end date', { required: true }),
      LOCATION,
    ],
    readOnly: true,
  },
  {
    name: 'getMultiLocationAvailability',
    category: 'bookings',
    description: 'Availability for a date range grouped by location.',
    params: [
      p('startDate', 'string', 'ISO start date', { required: true }),
      p('endDate', 'string', 'ISO end date', { required: true }),
    ],
    readOnly: true,
  },
  {
    name: 'create_booking_hold',
    category: 'bookings',
    description: 'Place a provisional hold on a vehicle for a date range. Mutates data.',
    params: [
      p('vehicle', 'string', 'Vehicle name or make/model', { required: true }),
      p('startDate', 'string', 'ISO start date', { required: true }),
      p('endDate', 'string', 'ISO end date', { required: true }),
      p('customer', 'string', 'Customer name or email'),
    ],
    readOnly: false,
  },
  {
    name: 'get_recent_activity',
    category: 'bookings',
    description: 'Recent activity feed across bookings and fleet events.',
    params: [LIMIT],
    readOnly: true,
  },

  // ---------------- customers ----------------
  {
    name: 'search_customer',
    category: 'customers',
    description: 'Find a customer by name, email, or phone.',
    params: [p('query', 'string', 'Search text', { required: true })],
    readOnly: true,
  },
  {
    name: 'getCustomerProfile',
    category: 'customers',
    description: 'Full customer profile with booking history.',
    params: [p('customer', 'string', 'Customer name or email', { required: true })],
    readOnly: true,
  },
  {
    name: 'getCustomerLifetimeValue',
    category: 'customers',
    description: 'Lifetime value and booking totals for a customer.',
    params: [p('customer', 'string', 'Customer name or email', { required: true })],
    readOnly: true,
  },
  {
    name: 'getCustomerSegments',
    category: 'customers',
    description: 'Customers grouped into VIP, high value, active, warm, at risk, new.',
    params: [
      p('segment', 'string', 'Segment filter', {
        enum: ['all', 'vip', 'high_value', 'active', 'warm', 'at_risk', 'new'],
      }),
      LOCATION,
      LIMIT,
    ],
    readOnly: true,
  },

  // ---------------- money ----------------
  {
    name: 'getRevenueAnalysis',
    category: 'money',
    description: 'Revenue for a timeframe, attributed to when the rental occurs.',
    params: [TIMEFRAME, LOCATION],
    readOnly: true,
  },
  {
    name: 'getPaymentSummary',
    category: 'money',
    description: 'Payments collected, pending and outstanding.',
    params: [TIMEFRAME],
    readOnly: true,
  },
  {
    name: 'getOutstandingBalances',
    category: 'money',
    description: 'Bookings with money still owed.',
    params: [LIMIT],
    readOnly: true,
  },
  {
    name: 'getVehicleProfitLoss',
    category: 'money',
    description: 'Profit and loss for a single vehicle.',
    params: [p('vehicle', 'string', 'Vehicle name or make/model', { required: true }), TIMEFRAME],
    readOnly: true,
  },
  {
    name: 'getFleetProfitLoss',
    category: 'money',
    description: 'Profit and loss across the whole fleet.',
    params: [TIMEFRAME, LOCATION],
    readOnly: true,
  },
  {
    name: 'getTopPerformers',
    category: 'money',
    description: 'Highest revenue-generating vehicles.',
    params: [TIMEFRAME, LIMIT, LOCATION],
    readOnly: true,
  },

  // ---------------- pricing ----------------
  {
    name: 'getPricingRecommendation',
    category: 'pricing',
    description: 'Suggested daily rate for a vehicle based on utilisation and demand.',
    params: [p('vehicle', 'string', 'Vehicle name or make/model', { required: true })],
    readOnly: true,
  },
  {
    name: 'getFleetPricingOverview',
    category: 'pricing',
    description: 'Rate positioning across the fleet with under/over-priced flags.',
    params: [LOCATION],
    readOnly: true,
  },
  {
    name: 'getDemandForecast',
    category: 'pricing',
    description: 'Forecast demand for an upcoming window.',
    params: [LOCATION, TIMEFRAME],
    readOnly: true,
  },
  {
    name: 'getEventImpact',
    category: 'pricing',
    description: 'Impact of local events/peak season on demand and rates.',
    params: [LOCATION],
    readOnly: true,
  },

  // ---------------- operations ----------------
  {
    name: 'getUpcomingMaintenance',
    category: 'operations',
    description: 'Scheduled and overdue maintenance.',
    params: [LIMIT, LOCATION],
    readOnly: true,
  },
  {
    name: 'get_open_work_orders',
    category: 'operations',
    description: 'Open work orders and vehicles currently out of service.',
    params: [LIMIT],
    readOnly: true,
  },
  {
    name: 'getDamageReports',
    category: 'operations',
    description: 'Recent damage reports and claims.',
    params: [LIMIT],
    readOnly: true,
  },
  {
    name: 'getVaultDocuments',
    category: 'operations',
    description: "Documents stored for the team's vehicles and entities.",
    params: [p('vehicle', 'string', 'Filter to one vehicle'), LIMIT],
    readOnly: true,
  },

  // ---------------- insights ----------------
  {
    name: 'getRariInsights',
    category: 'insights',
    description: 'Current AI-generated insights and priority actions for this fleet.',
    params: [LIMIT],
    readOnly: true,
  },
  {
    name: 'ask_fleet',
    category: 'insights',
    description:
      'Answer a free-form natural-language question about this fleet (revenue, P&L, bookings, idle vehicles, payments, customers, pricing, maintenance, locations). Use this when no specific tool clearly matches the question.',
    params: [
      p('question', 'string', 'The question exactly as the user asked it', { required: true }),
      TIMEFRAME,
      LOCATION,
    ],
    readOnly: true,
  },


  // ---------------- meta ----------------
  {
    name: 'logFeedback',
    category: 'meta',
    description: 'Record user feedback about the assistant. Mutates data.',
    params: [p('feedback', 'string', 'What the user said', { required: true })],
    readOnly: false,
  },
  // Deliberately not exposed: `featureComingSoon` (false affordance on a live
  // tenant account) and `getCarJoke` (burns a voice turn). Their executor cases
  // remain but are unreachable because dispatch is gated on this registry.

];

export const FLEET_TOOL_NAMES: string[] = FLEET_TOOLS.map((t) => t.name);

const BY_NAME = new Map(FLEET_TOOLS.map((t) => [t.name, t]));

export function getFleetTool(name: string): FleetToolDefinition | undefined {
  return BY_NAME.get(name);
}

export function isKnownFleetTool(name: string): boolean {
  return BY_NAME.has(name);
}

/** JSON Schema for one tool — used by MCP and by chat function calling. */
export function toJsonSchema(tool: FleetToolDefinition): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const param of tool.params) {
    properties[param.name] = {
      type: param.type,
      description: param.description,
      ...(param.enum ? { enum: param.enum } : {}),
    };
    if (param.required) required.push(param.name);
  }
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
}

/** MCP `tools/list` payload. */
export function toMcpTools() {
  return FLEET_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toJsonSchema(tool),
    annotations: { readOnlyHint: tool.readOnly },
  }));
}

/** OpenAI-style function definitions for chat completions tool calling. */
export function toOpenAIFunctions() {
  return FLEET_TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toJsonSchema(tool),
    },
  }));
}
