// @ts-nocheck
// Deterministic fixtures for the designated test tenant.
//
// Every row is tagged so the harness can re-seed idempotently and wipe
// cleanly: vehicles carry a reserved NAME_PREFIX (the vehicles table has no
// notes column), bookings carry SEED_TAG in `notes`. Dates are relative to
// "now" so timeframe assertions (today / week / month / year) mean the same
// thing on every run.

export const SEED_TAG = 'rari-selftest';
/** Reserved vehicle name prefix — the only safe tag on the vehicles table. */
export const NAME_PREFIX = 'Selftest ';

/**
 * Hard guard: fixtures may ONLY be written to the dedicated harness workspace.
 * Never a real tenant, never the demo account.
 */
export const SELFTEST_TEAM_ID =
  Deno.env.get('RARI_SELFTEST_TEAM_ID') || 'd378546a-29cb-4ed6-81ce-ef768fa3f36f';

function assertSelftestTeam(teamId: string) {
  if (teamId !== SELFTEST_TEAM_ID) {
    throw new Error(
      `refusing to seed: ${teamId} is not the dedicated Rari self-test workspace`,
    );
  }
}

function isoDaysFromNow(days: number, hour = 10): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

const SEED_VEHICLES = [
  { make: 'Ferrari', model: 'Selftest 488', year: 2023, current_rate: 1200, status: 'available', location: 'Selftest Bay', color: 'Rosso Corsa', mileage: 4200 },
  { make: 'Lamborghini', model: 'Selftest Huracan', year: 2022, current_rate: 1100, status: 'available', location: 'Selftest Bay', color: 'Verde Mantis', mileage: 8100 },
  { make: 'Porsche', model: 'Selftest 911', year: 2024, current_rate: 800, status: 'maintenance', location: 'Selftest Harbor', color: 'Chalk', mileage: 1500 },
];

/**
 * Resolves the user the fixtures are written under. Both `vehicles.user_id`
 * and `bookings.user_id` are NOT NULL, so the harness writes as the workspace
 * owner.
 */
async function resolveSeedUser(supabase: any, teamId: string, ownerUserId?: string | null) {
  if (ownerUserId) return ownerUserId;
  const { data: team } = await supabase.from('teams').select('owner_id').eq('id', teamId).maybeSingle();
  if (team?.owner_id) return team.owner_id;
  const { data: member } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .limit(1)
    .maybeSingle();
  if (member?.user_id) return member.user_id;
  throw new Error('seed aborted: no owner or member to attribute fixtures to');
}

export async function seedTestTenant(supabase: any, teamId: string, ownerUserId?: string | null) {
  assertSelftestTeam(teamId);
  const userId = await resolveSeedUser(supabase, teamId, ownerUserId);
  await unseedTestTenant(supabase, teamId);

  const vehicleRows = SEED_VEHICLES.map((v) => ({
    ...v,
    name: `${NAME_PREFIX}${v.make} ${v.model}`,
    team_id: teamId,
    user_id: userId,
  }));

  const { data: vehicles, error: vErr } = await supabase
    .from('vehicles')
    .insert(vehicleRows)
    .select('id, make, model, year, name');
  if (vErr) throw new Error(`seed vehicles failed: ${vErr.message}`);

  const byModel = (fragment: string) => vehicles.find((v: any) => String(v.model).includes(fragment));
  const v1 = byModel('488') ?? vehicles[0];
  const v2 = byModel('Huracan') ?? vehicles[1];
  const v3 = byModel('911') ?? vehicles[2];

  // Relative-date bookings: one on rent today, one upcoming this week,
  // one completed last month, one completed earlier this year.
  const base = { team_id: teamId, user_id: userId, notes: SEED_TAG };
  const bookingRows = [
    {
      ...base, vehicle_id: v1.id, customer_name: 'Selftest Ada Lovelace',
      customer_email: 'ada@rari-selftest.invalid', start_date: isoDaysFromNow(-1),
      end_date: isoDaysFromNow(2), status: 'confirmed', daily_rate: 1200,
      total_value: 3600, pickup_location: 'Selftest Bay',
    },
    {
      ...base, vehicle_id: v2.id, customer_name: 'Selftest Grace Hopper',
      customer_email: 'grace@rari-selftest.invalid', start_date: isoDaysFromNow(4),
      end_date: isoDaysFromNow(6), status: 'pending', daily_rate: 1100,
      total_value: 2200, pickup_location: 'Selftest Bay',
    },
    {
      ...base, vehicle_id: v1.id, customer_name: 'Selftest Alan Turing',
      customer_email: 'alan@rari-selftest.invalid', start_date: isoDaysFromNow(-40),
      end_date: isoDaysFromNow(-37), status: 'completed', daily_rate: 1200,
      total_value: 3600, pickup_location: 'Selftest Bay',
    },
    {
      ...base, vehicle_id: v3.id, customer_name: 'Selftest Katherine Johnson',
      customer_email: 'katherine@rari-selftest.invalid', start_date: isoDaysFromNow(-200),
      end_date: isoDaysFromNow(-196), status: 'completed', daily_rate: 800,
      total_value: 3200, pickup_location: 'Selftest Harbor',
    },
  ];

  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .insert(bookingRows)
    .select('id, booking_ref, customer_name');
  if (bErr) throw new Error(`seed bookings failed: ${bErr.message}`);

  // A customer record so customer-facing tools (LTV, profile, segments) have
  // something deterministic to resolve against.
  const { error: cErr } = await supabase.from('customers').insert({
    team_id: teamId,
    user_id: userId,
    full_name: 'Selftest Ada Lovelace',
    email: 'ada@rari-selftest.invalid',
    notes: SEED_TAG,
  });
  if (cErr && !/duplicate/i.test(cErr.message)) {
    console.warn('[rari-selftest] customer fixture skipped:', cErr.message);
  }

  return {
    vehicles: vehicles.length,
    bookings: bookings.length,
    sampleVehicle: `${v1.make} ${v1.model}`,
    sampleVehicleWord: 'Selftest',
    sampleCustomer: 'Selftest Ada',
    sampleBookingRef: bookings[0]?.booking_ref ?? null,
    location: 'Selftest Bay',
  };
}

export async function unseedTestTenant(supabase: any, teamId: string) {
  assertSelftestTeam(teamId);
  await supabase.from('bookings').delete().eq('team_id', teamId).eq('notes', SEED_TAG);
  await supabase.from('customers').delete().eq('team_id', teamId).eq('notes', SEED_TAG);
  const { data: seeded } = await supabase
    .from('vehicles')
    .select('id')
    .eq('team_id', teamId)
    .like('name', `${NAME_PREFIX}%`);
  const ids = (seeded || []).map((v: any) => v.id);
  if (ids.length) {
    await supabase.from('bookings').delete().in('vehicle_id', ids);
    await supabase.from('vehicles').delete().in('id', ids);
  }
  return { removed: ids.length };
}
