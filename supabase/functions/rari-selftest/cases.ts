// @ts-nocheck
// Case list for the Rari E2E harness — one entry per registry tool, plus the
// natural-language routing cases and the failure cases.
//
// Placeholders are substituted per tenant at run time:
//   {{vehicle}}     a real vehicle phrase from the tenant (e.g. "Ferrari 488")
//   {{vehicleWord}} a single distinctive token from that vehicle
//   {{customer}}    a real customer first name from the tenant
//   {{bookingRef}}  a real BK- reference from the tenant
//   {{location}}    a real location string from the tenant
//   {{start}}/{{end}} ISO dates a week out

export interface ToolCase {
  tool: string;
  args: Record<string, unknown>;
  /** Skip when the tenant has no data of this kind. */
  needs?: ('vehicle' | 'customer' | 'bookingRef' | 'location')[];
  expectError?: boolean;
  expectSummaryContains?: string;
  /** Mutating — only runs on the designated test tenant, then is cleaned up. */
  mutating?: boolean;
  label?: string;
}

/** Happy-path coverage: every one of the 37 registry tools. */
export const TOOL_CASES: ToolCase[] = [
  // ---- fleet ----
  { tool: 'get_fleet_vehicles', args: { limit: 5 } },
  { tool: 'get_fleet_vehicles', args: { status: 'available', limit: 3 } },
  { tool: 'get_vehicle_status', args: { vehicle: '{{vehicle}}' }, needs: ['vehicle'] },
  { tool: 'getVehicleDetails', args: { vehicle: '{{vehicleWord}}' }, needs: ['vehicle'] },
  { tool: 'getVehicleSpecs', args: { vehicle: '{{vehicle}}' }, needs: ['vehicle'] },
  { tool: 'getIdleVehicles', args: { days: 14 } },
  { tool: 'getFleetMetrics', args: { timeframe: 'month' } },
  { tool: 'getFleetMetrics', args: { timeframe: 'today' } },
  { tool: 'getLocationMetrics', args: { location: '{{location}}', timeframe: 'month' }, needs: ['location'] },
  { tool: 'compareLocations', args: { timeframe: 'month' } },

  // ---- bookings ----
  { tool: 'get_bookings', args: { status: 'all', timeframe: 'month', limit: 5 } },
  { tool: 'get_bookings', args: { status: 'confirmed', timeframe: 'all', limit: 3 } },
  { tool: 'searchBookings', args: { query: '{{vehicle}}', limit: 5 }, needs: ['vehicle'] },
  { tool: 'searchBookings', args: { query: '{{customer}}', limit: 5 }, needs: ['customer'] },
  { tool: 'get_booking_by_reference', args: { reference: '{{bookingRef}}' }, needs: ['bookingRef'] },
  { tool: 'get_todays_schedule', args: {} },
  { tool: 'checkAvailability', args: { vehicle: '{{vehicle}}', startDate: '{{start}}', endDate: '{{end}}' }, needs: ['vehicle'] },
  { tool: 'getMultiLocationAvailability', args: { startDate: '{{start}}', endDate: '{{end}}' } },
  {
    tool: 'create_booking_hold',
    args: { vehicle: '{{vehicle}}', startDate: '{{start}}', endDate: '{{end}}', customer: 'Rari Selftest' },
    needs: ['vehicle'],
    mutating: true,
  },
  { tool: 'get_recent_activity', args: { limit: 5 } },

  // ---- customers ----
  { tool: 'search_customer', args: { query: '{{customer}}' }, needs: ['customer'] },
  { tool: 'getCustomerProfile', args: { customer: '{{customer}}' }, needs: ['customer'] },
  { tool: 'getCustomerLifetimeValue', args: { customer: '{{customer}}' }, needs: ['customer'] },
  { tool: 'getCustomerSegments', args: { segment: 'all', limit: 5 } },

  // ---- money ----
  { tool: 'getRevenueAnalysis', args: { timeframe: 'month' } },
  { tool: 'getPaymentSummary', args: { timeframe: 'month' } },
  { tool: 'getOutstandingBalances', args: { limit: 5 } },
  { tool: 'getVehicleProfitLoss', args: { vehicle: '{{vehicle}}', timeframe: 'year' }, needs: ['vehicle'] },
  { tool: 'getFleetProfitLoss', args: { timeframe: 'year' } },
  { tool: 'getTopPerformers', args: { timeframe: 'year', limit: 3 } },

  // ---- pricing ----
  { tool: 'getPricingRecommendation', args: { vehicle: '{{vehicle}}' }, needs: ['vehicle'] },
  { tool: 'getFleetPricingOverview', args: {} },
  { tool: 'getDemandForecast', args: { timeframe: 'month' } },
  { tool: 'getEventImpact', args: {} },

  // ---- operations ----
  { tool: 'getUpcomingMaintenance', args: { limit: 5 } },
  { tool: 'get_open_work_orders', args: { limit: 5 } },
  { tool: 'getDamageReports', args: { limit: 5 } },
  { tool: 'getVaultDocuments', args: { limit: 5 } },

  // ---- insights / meta ----
  { tool: 'getRariInsights', args: { limit: 3 } },
  { tool: 'ask_fleet', args: { question: 'How is my fleet doing this month?', timeframe: 'month' } },
  { tool: 'logFeedback', args: { feedback: 'rari-selftest automated harness' }, mutating: true },
];

/**
 * Question layer — how operators actually ask. Each case asserts the router
 * lands on the right kind of answer rather than fleet-wide metrics.
 */
export interface QuestionCase {
  question: string;
  /** Substrings, any of which proves the right routing. */
  expectAnyOf: string[];
  needs?: ToolCase['needs'];
  label: string;
}

export const QUESTION_CASES: QuestionCase[] = [
  {
    label: 'single-vehicle question routes to vehicle detail',
    question: "what's going on with the {{vehicleWord}}?",
    expectAnyOf: ['{{vehicleWord}}'],
    needs: ['vehicle'],
  },
  {
    label: 'vehicle availability phrasing stays vehicle-scoped',
    question: 'is the {{vehicleWord}} booked right now?',
    expectAnyOf: ['{{vehicleWord}}'],
    needs: ['vehicle'],
  },
  {
    label: 'multi-word vehicle name resolves',
    question: 'tell me about the {{vehicle}}',
    expectAnyOf: ['{{vehicleWord}}'],
    needs: ['vehicle'],
  },
  {
    label: 'customer first name resolves to that customer',
    question: 'what has {{customer}} booked with us?',
    expectAnyOf: ['{{customer}}'],
    needs: ['customer'],
  },
  {
    label: 'money question stays fleet-wide',
    question: 'who owes me money?',
    expectAnyOf: ['owe', 'outstanding', 'balance', 'paid', 'no ', 'nothing'],
  },
  {
    label: 'out-of-service question routes to operations',
    question: "what's out of service right now?",
    expectAnyOf: ['service', 'maintenance', 'work order', 'no ', 'nothing', 'all '],
  },
  {
    label: 'generic performance question stays fleet-wide',
    question: 'how did we do this month?',
    expectAnyOf: ['revenue', 'booking', 'utilization', 'fleet', 'vehicle'],
  },
  {
    label: 'schedule question routes to today',
    question: 'what do I have going on today?',
    expectAnyOf: ['today', 'pickup', 'return', 'nothing', 'no '],
  },
];

/** Failure and refusal cases — no invented data, no crashes. */
export const EDGE_CASES: ToolCase[] = [
  {
    label: 'unknown vehicle',
    tool: 'getVehicleDetails',
    args: { vehicle: 'Zyzzyx Hovercraft 9000' },
    expectError: true,
  },
  {
    label: 'unknown customer',
    tool: 'getCustomerProfile',
    args: { customer: 'Qqxzzy Nonexistent' },
    expectError: true,
  },
  {
    label: 'bad booking reference',
    tool: 'get_booking_by_reference',
    args: { reference: 'BK-00000' },
    expectError: true,
  },
  {
    label: 'empty search term',
    tool: 'searchBookings',
    args: { query: 'zzzzqqqxx', limit: 5 },
  },
];
