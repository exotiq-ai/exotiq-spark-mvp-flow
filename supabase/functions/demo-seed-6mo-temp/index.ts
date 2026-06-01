// One-off internal seeder for hello@exotiq.ai demo account.
// Generates 6 months of forward bookings anchored to live PredictHQ event demand
// for Miami + Scottsdale. Tagged with [DEMO-6MO-FWD] for rollback.
// DELETE THIS FUNCTION AFTER USE.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TEAM_ID = "c1de6533-ab44-4973-a123-007a8007b5ba";
const USER_ID = "99d902d4-5878-4b59-a108-142bafb1c862";
const MIAMI_LOC = "a1b2c3d4-5678-9012-3456-789012345678";
const SCOTTSDALE_LOC = "2bea8e66-6d89-442e-8974-9e1440c56e6b";
const TAG = "[DEMO-6MO-FWD]";

// Safety: callable only with shared secret
const INVOKE_TOKEN = "seed-6mo-2026";

const FIRST_NAMES = ["Alexander","Sophia","Marcus","Isabella","James","Olivia","William","Emma","Benjamin","Charlotte","Lucas","Amelia","Henry","Mia","Sebastian","Harper","Daniel","Evelyn","Matthew","Abigail","David","Emily","Joseph","Elizabeth","Samuel","Sofia","Carter","Avery","Owen","Ella","Wyatt","Scarlett","John","Grace","Jack","Chloe","Luke","Victoria","Jayden","Riley","Gabriel","Aria","Anthony","Lily","Isaac","Aubrey","Grayson","Zoey","Julian","Hannah","Levi","Lillian","Christopher","Addison","Joshua","Eleanor","Andrew","Natalie","Lincoln","Luna","Mateo","Savannah","Ryan","Brooklyn","Jaxon","Leah","Nathan","Zoe","Aaron","Stella","Isaiah","Hazel","Thomas","Ellie","Charles","Paisley","Caleb","Audrey","Josiah","Skylar","Christian","Violet","Hunter","Claire","Eli","Bella","Jonathan","Aurora","Connor","Lucy","Landon","Anna","Adrian","Samantha","Asher","Caroline","Cameron","Genesis","Leo","Aaliyah","Theodore","Kennedy","Jeremiah"];
const LAST_NAMES = ["Chen","Rodriguez","Patel","Thompson","Anderson","Martinez","Robinson","Clark","Walker","Hall","Young","King","Wright","Lopez","Hill","Scott","Green","Adams","Baker","Gonzalez","Nelson","Carter","Mitchell","Perez","Roberts","Turner","Phillips","Campbell","Parker","Evans","Edwards","Collins","Stewart","Sanchez","Morris","Rogers","Reed","Cook","Morgan","Bell","Murphy","Bailey","Rivera","Cooper","Richardson","Cox","Howard","Ward","Torres","Peterson","Gray","Ramirez","Brooks","Sanders","Price","Bennett","Wood","Barnes","Ross","Henderson","Coleman","Jenkins","Perry","Powell","Long","Patterson","Hughes","Flores","Washington","Butler","Simmons","Foster","Bryant","Alexander","Russell","Griffin","Diaz","Hayes","Wellington","Sterling","Ashford","Kingsley","Whitmore","Sinclair","Beaumont","Carrington"];
const COMPANIES = ["Apex Capital","Meridian Holdings","Sterling Wealth","Crown Equity","Vanguard Partners","Pinnacle Group","Summit Ventures","Atlas Investments","Onyx Holdings","Cobalt Equity"];
const SOURCES = ["direct","direct","direct","direct","turo","referral","website"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number) { return Math.random() * (max - min) + min; }

function tierFor(rate: number) {
  if (rate >= 4500) return "hypercar";
  if (rate >= 2000) return "ultra";
  if (rate >= 1000) return "exotic";
  return "luxury";
}
const UTIL_TARGET: Record<string, number> = { hypercar: 0.08, ultra: 0.20, exotic: 0.37, luxury: 0.52 };
const UTIL_RANGE: Record<string, [number, number]> = {
  hypercar: [0.04, 0.10],
  ultra: [0.15, 0.25],
  exotic: [0.30, 0.45],
  luxury: [0.45, 0.60],
};
const LEN_RANGE: Record<string, [number, number]> = {
  hypercar: [1, 2],
  ultra: [2, 4],
  exotic: [2, 5],
  luxury: [3, 7],
};

// Geonames IDs: Miami=4164138, Scottsdale=5313457
const MARKET_GEO: Record<string, { lat: number; lon: number; radius: number }> = {
  miami: { lat: 25.7617, lon: -80.1918, radius: 35 },
  scottsdale: { lat: 33.4942, lon: -111.9261, radius: 35 },
};

async function fetchEvents(market: string, start: string, end: string, apiKey: string) {
  const geo = MARKET_GEO[market];
  const all: any[] = [];
  // Paginate via offset; PredictHQ caps limit at 50 for many tiers
  for (let offset = 0; offset < 300; offset += 50) {
    const params = new URLSearchParams();
    params.append("active.gte", start);
    params.append("active.lte", end);
    params.append("within", `${geo.radius}km@${geo.lat},${geo.lon}`);
    params.append("category", "concerts,sports,conferences,festivals,performing-arts,expos,community");
    params.append("sort", "-rank");
    params.append("limit", "50");
    params.append("offset", String(offset));
    const r = await fetch(`https://api.predicthq.com/v1/events?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!r.ok) {
      console.warn(`PredictHQ ${market} offset=${offset}: ${r.status} ${await r.text()}`);
      break;
    }
    const data = await r.json();
    const page = data.results || [];
    all.push(...page);
    if (page.length < 50) break;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-invoke-token") !== INVOKE_TOKEN) {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const apiKey = Deno.env.get("PREDICTHQ_API_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Load fleet
    const { data: vehicles, error: vErr } = await supabase
      .from("vehicles")
      .select("id, make, model, year, current_rate, name")
      .eq("team_id", TEAM_ID)
      .is("archived_at", null)
      .is("trashed_at", null);
    if (vErr) throw vErr;
    const fleet = (vehicles || []).filter(v => v.current_rate && Number(v.current_rate) > 0);

    // 2. Load existing future bookings to avoid conflicts
    const today = new Date(); today.setHours(0,0,0,0);
    const horizon = new Date(today); horizon.setMonth(horizon.getMonth() + 6);
    const { data: existing } = await supabase
      .from("bookings")
      .select("vehicle_id, start_date, end_date, status")
      .eq("team_id", TEAM_ID)
      .gte("end_date", today.toISOString())
      .not("status", "in", "(cancelled,declined)");
    const occupied: Record<string, Array<[number, number]>> = {};
    for (const b of existing || []) {
      const s = new Date(b.start_date).getTime();
      const e = new Date(b.end_date).getTime();
      (occupied[b.vehicle_id] = occupied[b.vehicle_id] || []).push([s - 86400000, e + 86400000]);
    }

    // 3. Fetch events for each market (single call per market across full window)
    const startStr = today.toISOString().slice(0,10);
    const endStr = horizon.toISOString().slice(0,10);
    const [miamiEvents, scottsdaleEvents] = await Promise.all([
      fetchEvents("miami", startStr, endStr, apiKey),
      fetchEvents("scottsdale", startStr, endStr, apiKey),
    ]);

    // 4. Build per-market daily demand weight (date -> weight)
    function buildCurve(events: any[]): Record<string, number> {
      const curve: Record<string, number> = {};
      for (const ev of events) {
        const d = (ev.start || "").slice(0, 10);
        if (!d) continue;
        const rank = ev.rank || 30;
        const att = Math.min((ev.predicted_attendance || 1000) / 5000, 20);
        const weight = (rank / 50) * (1 + att);
        // event-day + 2 days before & after (people arrive early / stay after)
        for (let offset = -2; offset <= 2; offset++) {
          const dt = new Date(d); dt.setDate(dt.getDate() + offset);
          const key = dt.toISOString().slice(0, 10);
          const decay = 1 - Math.abs(offset) * 0.25;
          curve[key] = (curve[key] || 0) + weight * decay;
        }
      }
      return curve;
    }
    const curves = { miami: buildCurve(miamiEvents), scottsdale: buildCurve(scottsdaleEvents) };

    // 5. Build weighted date pool for each market over 6 months
    const totalDays = Math.floor((horizon.getTime() - today.getTime()) / 86400000);
    function weightedDates(market: "miami" | "scottsdale") {
      const curve = curves[market];
      const out: { date: Date; weight: number }[] = [];
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(today); d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        const dow = d.getDay();
        // Weekend baseline
        const weekendBoost = (dow === 5 || dow === 6 || dow === 0) ? 1.5 : 1.0;
        const eventBoost = 1 + (curve[key] || 0);
        out.push({ date: new Date(d), weight: weekendBoost * eventBoost });
      }
      return out;
    }
    const pools = { miami: weightedDates("miami"), scottsdale: weightedDates("scottsdale") };

    function sampleDate(pool: { date: Date; weight: number }[]): Date {
      const total = pool.reduce((s, p) => s + p.weight, 0);
      let r = Math.random() * total;
      for (const p of pool) { r -= p.weight; if (r <= 0) return new Date(p.date); }
      return new Date(pool[pool.length - 1].date);
    }

    function isConflict(vid: string, s: number, e: number) {
      for (const [os, oe] of occupied[vid] || []) {
        if (s < oe && e > os) return true;
      }
      return false;
    }

    // 6. Pick reusable existing customers
    const { data: existingCustomers } = await supabase
      .from("customers")
      .select("id, full_name, email, phone")
      .eq("team_id", TEAM_ID)
      .limit(200);

    // 7. Create ~35 new customers
    const newCustomers: any[] = [];
    for (let i = 0; i < 35; i++) {
      const fn = rand(FIRST_NAMES);
      const ln = rand(LAST_NAMES);
      const isCorp = Math.random() < 0.25;
      const name = isCorp ? `${fn} ${ln} (${rand(COMPANIES)})` : `${fn} ${ln}`;
      newCustomers.push({
        user_id: USER_ID,
        team_id: TEAM_ID,
        full_name: name,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}${randInt(10,999)}@${rand(["gmail.com","outlook.com","icloud.com","yahoo.com"])}`,
        phone: `+1${randInt(200,999)}${randInt(200,999)}${randInt(1000,9999)}`,
        customer_status: Math.random() < 0.15 ? "vip" : "active",
        notes: `${TAG} Generated for demo`,
        tags: isCorp ? ["corporate"] : (Math.random() < 0.2 ? ["vip"] : []),
      });
    }
    const { data: insertedCustomers, error: cErr } = await supabase
      .from("customers").insert(newCustomers).select("id, full_name, email, phone");
    if (cErr) throw cErr;

    const customerPool = [...(existingCustomers || []), ...(insertedCustomers || [])];

    // 8. Generate bookings per vehicle
    const bookingsToInsert: any[] = [];
    let miamiCount = 0, scottsdaleCount = 0;
    const utilAchieved: Record<string, { rentedDays: number; vehicles: number }> = {
      hypercar: {rentedDays:0,vehicles:0}, ultra:{rentedDays:0,vehicles:0}, exotic:{rentedDays:0,vehicles:0}, luxury:{rentedDays:0,vehicles:0}
    };

    for (const v of fleet) {
      const rate = Number(v.current_rate);
      const tier = tierFor(rate);
      const [lo, hi] = UTIL_RANGE[tier];
      const targetUtil = randFloat(lo, hi);
      const targetDays = Math.round(totalDays * targetUtil);
      utilAchieved[tier].vehicles++;

      const [minLen, maxLen] = LEN_RANGE[tier];
      let rentedDays = 0;
      let attempts = 0;
      const maxAttempts = 60;

      while (rentedDays < targetDays && attempts < maxAttempts) {
        attempts++;
        // Balance markets ~50/50: bias by current global skew
        const total = miamiCount + scottsdaleCount;
        const miamiShare = total === 0 ? 0.5 : miamiCount / total;
        const market: "miami" | "scottsdale" = (Math.random() < (miamiShare < 0.5 ? 0.6 : 0.4)) ? "miami" : "scottsdale";

        const startDate = sampleDate(pools[market]);
        startDate.setHours(randInt(9, 17), 0, 0, 0);
        const len = randInt(minLen, maxLen);
        const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + len);
        const s = startDate.getTime(), e = endDate.getTime();

        if (isConflict(v.id, s, e)) continue;
        if (endDate > horizon) continue;

        // Lock in
        (occupied[v.id] = occupied[v.id] || []).push([s - 86400000, e + 86400000]);
        rentedDays += len;
        if (market === "miami") miamiCount++; else scottsdaleCount++;
        utilAchieved[tier].rentedDays += len;

        const customer = rand(customerPool);
        const dailyRate = Math.round(rate * randFloat(0.95, 1.05));
        const totalValue = dailyRate * len;
        const deposit = Math.round(totalValue * 0.3);
        const balance = totalValue - deposit;
        const daysAhead = (s - today.getTime()) / 86400000;
        // Status mix: nearer = more confirmed
        let status: string;
        const r = Math.random();
        if (daysAhead < 14) status = r < 0.75 ? "confirmed" : "pending";
        else if (daysAhead < 60) status = r < 0.70 ? "confirmed" : "pending";
        else status = r < 0.65 ? "confirmed" : "pending";

        const locId = market === "miami" ? MIAMI_LOC : SCOTTSDALE_LOC;
        const locName = market === "miami" ? "Miami Beach" : "Scottsdale";

        bookingsToInsert.push({
          user_id: USER_ID,
          team_id: TEAM_ID,
          vehicle_id: v.id,
          vehicle_name: v.name || `${v.year} ${v.make} ${v.model}`,
          customer_id: customer.id,
          customer_name: customer.full_name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          pickup_location: locName,
          dropoff_location: locName,
          pickup_location_id: locId,
          dropoff_location_id: locId,
          daily_rate: dailyRate,
          total_value: totalValue,
          deposit_amount: deposit,
          balance_due: balance,
          status,
          payment_status: status === "confirmed" ? "deposit_paid" : "pending",
          rental_duration_type: "multiday",
          booking_source: rand(SOURCES),
          confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
          notes: `${TAG} ${tier} · ${market}`,
        });
      }
    }

    // 9. Insert bookings in batches
    const insertedBookings: any[] = [];
    for (let i = 0; i < bookingsToInsert.length; i += 100) {
      const batch = bookingsToInsert.slice(i, i + 100);
      const { data, error } = await supabase.from("bookings").insert(batch).select("id, deposit_amount, customer_id, status, created_at");
      if (error) throw error;
      insertedBookings.push(...(data || []));
    }

    // 10. Insert deposit payments for confirmed bookings only
    const payments = insertedBookings
      .filter(b => b.status === "confirmed")
      .map(b => ({
        user_id: USER_ID,
        team_id: TEAM_ID,
        booking_id: b.id,
        customer_id: b.customer_id,
        payment_type: "deposit",
        amount: b.deposit_amount,
        payment_method: "card",
        payment_status: "succeeded",
        transaction_date: b.created_at,
        notes: TAG,
      }));
    for (let i = 0; i < payments.length; i += 100) {
      const batch = payments.slice(i, i + 100);
      const { error } = await supabase.from("payments").insert(batch);
      if (error) throw error;
    }

    const summary = {
      ok: true,
      newCustomers: insertedCustomers?.length || 0,
      bookingsInserted: insertedBookings.length,
      paymentsInserted: payments.length,
      marketSplit: { miami: miamiCount, scottsdale: scottsdaleCount },
      utilization: Object.fromEntries(
        Object.entries(utilAchieved).map(([t, v]) => [
          t,
          { vehicles: v.vehicles, avgUtilPct: v.vehicles ? Math.round(((v.rentedDays / v.vehicles) / totalDays) * 1000) / 10 : 0 }
        ])
      ),
      events: { miami: miamiEvents.length, scottsdale: scottsdaleEvents.length },
      horizonDays: totalDays,
    };
    return new Response(JSON.stringify(summary, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err), stack: (err as any)?.stack }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
