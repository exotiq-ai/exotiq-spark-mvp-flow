export const syntheticContext = Object.freeze({
  subject: 'agent-test-renter',
  customerId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000002',
  vehicleId: '00000000-0000-4000-8000-000000000003',
  bookingId: '00000000-0000-4000-8000-000000000004',
  otherCustomerId: '00000000-0000-4000-8000-000000000005',
  otherTenantId: '00000000-0000-4000-8000-000000000006',
  operator: 'agent-test-miami', timezone: 'America/New_York', currency: 'USD',
});

export type UpstreamFault = 'success' | 'timeout' | 'unavailable' | 'schema-disagreement' | 'unknown';
/** Offline fixture only. Responses never prove live availability or SQL safety. */
export function createUpstreamFixture(fault: UpstreamFault) {
  let calls = 0;
  return {
    calls: () => calls,
    fetch: async () => {
      calls++;
      if (fault === 'timeout') throw new DOMException('agent-test upstream timed out', 'TimeoutError');
      if (fault === 'unavailable') throw new Error('agent-test upstream unavailable');
      if (fault === 'schema-disagreement') return Response.json({ availability: [] });
      if (fault === 'unknown') return Response.json({ status: 'UNKNOWN', reason: 'upstream_unavailable' }, { status: 503 });
      return Response.json({ status: 'AVAILABLE', vehicle_id: syntheticContext.vehicleId, timezone: syntheticContext.timezone });
    },
  };
}
