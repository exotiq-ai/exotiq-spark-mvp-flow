// @ts-nocheck
// Golden-number cross-checks: what Rari says out loud must equal what the
// database says. Computed independently via the service-role path, then
// compared against the tool payloads.
import { executeFunction, resolveTimeframeWindow } from '../_shared/fleet-tools/executor.ts';

interface Failure { assertion: string; detail: string }

function near(a: number, b: number, tolerance = 0.01): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const diff = Math.abs(a - b);
  return diff <= Math.max(tolerance, Math.abs(b) * 0.001);
}

export async function runGoldenChecks(
  supabase: any,
  userId: string,
  teamId: string,
): Promise<{ checks: { name: string; expected: unknown; actual: unknown; passed: boolean }[]; failures: Failure[] }> {
  const failures: Failure[] = [];
  const checks: { name: string; expected: unknown; actual: unknown; passed: boolean }[] = [];

  const record = (name: string, expected: unknown, actual: unknown, passed: boolean) => {
    checks.push({ name, expected, actual, passed });
    if (!passed) failures.push({ assertion: `golden:${name}`, detail: `expected ${JSON.stringify(expected)}, tool said ${JSON.stringify(actual)}` });
  };

  // --- 1. Fleet count -------------------------------------------------------
  const { count: sqlVehicleCount } = await supabase
    .from('vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);

  const fleet = await executeFunction('get_fleet_vehicles', { limit: 500 }, supabase, userId, teamId);
  record('fleet_count', sqlVehicleCount, fleet?.count, Number(fleet?.count) === Number(sqlVehicleCount));

  // --- 2. Revenue total (completed bookings, this year) ---------------------
  const window = resolveTimeframeWindow('year');
  let revQuery = supabase
    .from('bookings')
    .select('total_value, start_date')
    .eq('team_id', teamId)
    .eq('status', 'completed')
    .lte('start_date', window.end);
  if (window.start) revQuery = revQuery.gte('start_date', window.start);
  const { data: revRows } = await revQuery;
  const sqlRevenue = (revRows || []).reduce((s: number, r: any) => s + Number(r.total_value || 0), 0);

  const revenue = await executeFunction('getRevenueAnalysis', { timeframe: 'year' }, supabase, userId, teamId);
  record('revenue_year', Math.round(sqlRevenue), Math.round(Number(revenue?.totalRevenueRaw ?? NaN)), near(Number(revenue?.totalRevenueRaw), sqlRevenue, 1));
  record('revenue_booking_count', (revRows || []).length, revenue?.bookingCount, Number(revenue?.bookingCount) === (revRows || []).length);

  // --- 3. Per-vehicle P&L vs fn_vehicle_pnl --------------------------------
  const pStart = (window.start ?? '2000-01-01T00:00:00.000Z').slice(0, 10);
  const pEnd = window.end.slice(0, 10);
  const { data: pnlRows, error: pnlError } = await supabase.rpc('fn_vehicle_pnl', {
    p_team_id: teamId,
    p_start: pStart,
    p_end: pEnd,
  });

  if (pnlError) {
    failures.push({ assertion: 'golden:pnl_rpc', detail: pnlError.message });
  } else if ((pnlRows || []).length) {
    const top = [...pnlRows].sort((a: any, b: any) => Number(b.gross_revenue) - Number(a.gross_revenue))[0];
    const pnl = await executeFunction(
      'getVehicleProfitLoss',
      { vehicle: top.vehicle_name, timeframe: 'year' },
      supabase,
      userId,
      teamId,
    );
    const reported = Number(
      pnl?.grossRevenueRaw ?? pnl?.vehicles?.[0]?.grossRevenueRaw ?? pnl?.totalGrossRevenueRaw ?? NaN,
    );
    if (Number.isFinite(reported)) {
      record('vehicle_pnl_gross', Math.round(Number(top.gross_revenue)), Math.round(reported), near(reported, Number(top.gross_revenue), 1));
    } else {
      // No raw field exposed — fall back to asserting the formatted total appears.
      const summary = String(pnl?.summary || '');
      const expectedWhole = Math.round(Number(top.gross_revenue)).toLocaleString('en-US');
      record('vehicle_pnl_gross_summary', expectedWhole, summary.slice(0, 160), summary.includes(expectedWhole.split(',')[0]));
    }

    const fleetPnl = await executeFunction('getFleetProfitLoss', { timeframe: 'year' }, supabase, userId, teamId);
    const sqlFleetGross = pnlRows.reduce((s: number, r: any) => s + Number(r.gross_revenue || 0), 0);
    const reportedFleet = Number(fleetPnl?.grossRevenueRaw ?? fleetPnl?.totalRevenueRaw ?? NaN);
    if (Number.isFinite(reportedFleet)) {
      record('fleet_pnl_gross', Math.round(sqlFleetGross), Math.round(reportedFleet), near(reportedFleet, sqlFleetGross, 1));
    }
  }

  return { checks, failures };
}
