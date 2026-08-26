// @ts-nocheck
// Deterministic fixtures for the designated test tenant.
//
// Every row is tagged with SEED_TAG so the harness can re-seed idempotently and
// wipe cleanly. Dates are relative to "now" so timeframe assertions (today /
// week / month / year) mean the same thing on every run.

export const SEED_TAG = 'rari-selftest';

function isoDaysFromNow(days: number, hour = 10): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

const SEED_VEHICLES = [
  { make: 'Ferrari', model: 'Selftest 488', year: 2023, daily_rate: 1200, status: 'available', location: 'Selftest Bay' },
  { make: 'Lamborghini', model: 'Selftest Huracan', year: 2022, daily_rate: 1100, status: 'available', location: 'Selftest Bay' },
  { make: 'Porsche', model: 'Selftest 911', year: 2024, daily_rate: 800, status: 'maintenance', location: 'Selftest Harbor' },
];

export async function seedTestTenant(supabase: any, teamId: string) {
  await unseedTestTenant(supabase, teamId);

  const vehicleRows = SEED_VEHICLES.map((v) => ({
    ...v,
    team_id: teamId,
    notes: SEED_TAG,
  }));

  const { data: vehicles, error: vErr } = await supabase
    .from('vehicles')
    .insert(vehicleRows)
    .select('id, make, model, year');
  if (vErr) throw new Error(`seed vehicles failed: ${vErr.message}`);

  const [v1, v2, v3] = vehicles;

  // Relative-date bookings: one on rent today, one upcoming this week,
  // one completed last month, one completed earlier this year.
  const bookingRows = [
    {
      team_id: teamId, vehicle_id: v1.id, customer_name: 'Selftest Ada Lovelace',
      customer_email: 'ada@rari-selftest.invalid', start_date: isoDaysFromNow(-1),
      end_date: isoDaysFromNow(2), status: 'confirmed', daily_rate: 1200,
      total_value: 3600, pickup_location: 'Selftest Bay', notes: SEED_TAG,
    },
    {
      team_id: teamId, vehicle_id: v2.id, customer_name: 'Selftest Grace Hopper',
      customer_email: 'grace@rari-selftest.invalid', start_date: isoDaysFromNow(4),
      end_date: isoDaysFromNow(6), status: 'pending', daily_rate: 1100,
      total_value: 2200, pickup_location: 'Selftest Bay', notes: SEED_TAG,
    },
    {
      team_id: teamId, vehicle_id: v1.id, customer_name: 'Selftest Alan Turing',
      customer_email: 'alan@rari-selftest.invalid', start_date: isoDaysFromNow(-40),
      end_date: isoDaysFromNow(-37), status: 'completed', daily_rate: 1200,
      total_value: 3600, pickup_location: 'Selftest Bay', notes: SEED_TAG,
    },
    {
      team_id: teamId, vehicle_id: v3.id, customer_name: 'Selftest Katherine Johnson',
      customer_email: 'katherine@rari-selftest.invalid', start_date: isoDaysFromNow(-200),
      end_date: isoDaysFromNow(-196), status: 'completed', daily_rate: 800,
      total_value: 3200, pickup_location: 'Selftest Harbor', notes: SEED_TAG,
    },
  ];

  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .insert(bookingRows)
    .select('id, booking_ref, customer_name');
  if (bErr) throw new Error(`seed bookings failed: ${bErr.message}`);

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
  await supabase.from('bookings').delete().eq('team_id', teamId).eq('notes', SEED_TAG);
  const { data: seeded } = await supabase
    .from('vehicles')
    .select('id')
    .eq('team_id', teamId)
    .eq('notes', SEED_TAG);
  const ids = (seeded || []).map((v: any) => v.id);
  if (ids.length) {
    await supabase.from('bookings').delete().in('vehicle_id', ids);
    await supabase.from('vehicles').delete().in('id', ids);
  }
  return { removed: ids.length };
}
