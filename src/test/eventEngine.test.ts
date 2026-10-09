// Tests for the event demand engine (run by `npm test` via vitest).
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  CALENDAR_META,
  SEGMENTS,
  classifyVehicleSegment,
  cleanUrls,
  combineUplifts,
  durationFactor,
  effectiveScale,
  isPricingEligible,
  marketMultiplier,
  scaleFromAttendance,
  segmentImpactFor,
  segmentMultiplier,
  windowSegmentMultipliers,
  type Segment,
} from "../../supabase/functions/_shared/eventTaxonomy.ts";
import { PEAK_SEASONS, getRelevantPeakSeasons } from "../../supabase/functions/_shared/demandCities.ts";
import { MARKET_VENUES, matchVenue } from "../../supabase/functions/_shared/demandVenues.ts";
import { CALENDAR_ALIASES, impactTier } from "../../supabase/functions/_shared/eventTaxonomy.ts";
import { calendarEvents, calendarNamesWithAliases, isDuplicateName, mergeSnapshotEvents, sanitizeAiEvent, looksSameEvent } from "../../supabase/functions/_shared/eventEngine.ts";
import { resolveCity } from "../../supabase/functions/_shared/demandCities.ts";
import { applyVerification, markScheduleConflicts, finalizeEvent } from "../../supabase/functions/_shared/eventEngine.ts";
import { dateVariants, isSafeUrl, pageConfirmsEvent, pageText, verifyEvents } from "../../supabase/functions/_shared/eventVerify.ts";
import { CALENDAR_SOURCES, EVIDENCE_WEIGHT, MAX_UPLIFT, evidenceFor, weightImpact } from "../../supabase/functions/_shared/eventTaxonomy.ts";

const top = (m: Record<Segment, number>): Segment =>
  [...SEGMENTS].sort((a, b) => m[b] - m[a])[0];

test("owner's examples: who each event moves", () => {
  // Miami crypto conference: high-traffic for exotics.
  const crypto = segmentImpactFor("hnw-business", "national");
  assert.equal(top(crypto), "exotic");
  assert.ok(crypto.exotic - 1 > 1.5 * (crypto.sports - 1), "exotics should clearly lead sports cars");

  // Music festival: heavier on SUVs.
  const fest = segmentImpactFor("festival-group", "national");
  assert.equal(top(fest), "suv");
  assert.ok(fest.suv > fest.exotic);

  // Art Basel: market-wide peak season, every segment well above baseline.
  const basel = PEAK_SEASONS.find((s) => s.name === "Art Basel Miami")!;
  const meta = CALENDAR_META[basel.name];
  const impact = segmentImpactFor(meta.audience, meta.scale, basel.surge);
  for (const seg of SEGMENTS) assert.ok(impact[seg] >= 1.3, `${seg} should be in peak (${impact[seg]})`);
  assert.equal(top(impact), "exotic"); // still leads, but nobody is left behind

  // Motorsport: exotics and sports cars lead, SUVs trail.
  const gp = segmentImpactFor("motorsport-auto", "global");
  assert.equal(top(gp), "exotic");
  assert.ok(gp.sports > gp.suv);
});

test("vehicle segments match the real fleet's top models", () => {
  const cases: Array<[string, string, Segment]> = [
    ["Lamborghini", "Urus", "suv"],
    ["Lamborghini", "Urus S", "suv"],
    ["Lamborghini", "Huracan EVO Spyder", "exotic"],
    ["Lamborghini", "Revuelto", "exotic"],
    ["Rolls-Royce", "Cullinan", "suv"],
    ["Rolls-Royce", "Cullinan Black Badge", "suv"],
    ["Rolls-Royce", "Ghost", "luxury"],
    ["Rolls-Royce", "Wraith", "luxury"],
    ["Rolls-Royce", "Dawn", "luxury"],
    ["Cadillac", "Escalade", "suv"],
    ["Cadillac", "Escalade ESV", "suv"],
    ["Ferrari", "488 Spider", "exotic"],
    ["Ferrari", "Roma", "exotic"],
    ["McLaren", "720S Spider", "exotic"],
    ["Mercedes-Benz", "AMG G63 G-Wagon SUV", "suv"],
    ["Mercedes-Benz", "G550", "suv"],
    ["Mercedes-Benz", "G63", "suv"],
    ["Mercedes-Benz", "Maybach GLS 600", "suv"],
    ["Mercedes-Benz", "AMG GLE 53", "suv"],
    ["Mercedes-Benz", "S580", "luxury"],
    ["Mercedes-Benz", "Maybach S580", "luxury"],
    ["Chevrolet", "Corvette Z06", "sports"],
    ["Chevrolet", "Corvette Stingray", "sports"],
    ["Chevrolet", "Corvette C8", "sports"],
    ["Porsche", "911 Turbo S", "exotic"],
    ["Porsche", "911 Carrera S", "sports"],
    ["Porsche", "Cayenne", "suv"],
    ["Land Rover", "Range Rover", "suv"],
    ["Land Rover", "Velar", "suv"],
    ["BMW", "M3 Competition", "sports"],
    ["BMW", "M4 Competition", "sports"],
    ["BMW", "M8 Competition", "sports"],
    ["BMW", "X7", "suv"],
    ["BMW", "i8 Roadster", "sports"],
    ["Aston Martin", "Vantage", "exotic"],
    ["Aston Martin", "DB12", "exotic"],
    ["Audi", "R8 V10 Plus", "exotic"],
    ["Audi", "R8 Spyder", "exotic"],
    ["Bentley", "Bentayga", "suv"],
    ["Bentley", "Continental GT", "luxury"],
    ["Bugatti", "Chiron Sport", "exotic"],
    ["Maserati", "MC20", "exotic"],
    ["Cadillac", "Escalade V", "suv"],
  ];
  const wrong = cases.filter(([mk, md, want]) => classifyVehicleSegment(mk, md) !== want)
    .map(([mk, md, want]) => `${mk} ${md}: want ${want}, got ${classifyVehicleSegment(mk, md)}`);
  assert.deepEqual(wrong, []);
});

test("multiple events combine with diminishing weight and a cap", () => {
  assert.equal(combineUplifts([0.2]), 0.2);
  assert.ok(Math.abs(combineUplifts([0.2, 0.2]) - 0.27) < 1e-9);
  assert.ok(combineUplifts([0.5, 0.5, 0.5, 0.5]) <= 0.6);
  assert.equal(combineUplifts([]), 0);
});

test("unconfirmed AI events never move a price; anchored ones do", () => {
  assert.equal(isPricingEligible({ source: "calendar" }), true);
  assert.equal(isPricingEligible({ source: "ai" }), false);
  assert.equal(isPricingEligible({ source: "ai", venueMatched: true }), false, "venue match without a source is not enough");
  assert.equal(isPricingEligible({ source: "ai", venueMatched: true, sourceUrls: ["https://www.redrocksonline.com/e/1"] }), true);
  assert.equal(isPricingEligible({ source: "ai", sourceUrls: ["https://a.com/x", "https://www.a.com/y"] }), false, "same site twice is one source");
  assert.equal(isPricingEligible({ source: "ai", sourceUrls: ["https://a.com/x", "https://b.com/y"] }), true);

  const ev = [{ date: "2026-11-01", segmentImpact: { exotic: 1.3, suv: 1.3, sports: 1.3, luxury: 1.3 }, pricingEligible: false }];
  assert.equal(segmentMultiplier(ev, "exotic"), 1);
});

test("window multipliers are the peak day, not the sum of the window", () => {
  const events = [
    { date: "2026-11-02", endDate: "2026-11-03", segmentImpact: { exotic: 1.2, suv: 1.1, sports: 1.1, luxury: 1.1 } },
    { date: "2026-11-20", endDate: "2026-11-21", segmentImpact: { exotic: 1.2, suv: 1.1, sports: 1.1, luxury: 1.1 } },
  ];
  const w = windowSegmentMultipliers(events, "2026-11-01", "2026-11-30");
  assert.equal(w.exotic, 1.2);
  assert.equal(w.suv, 1.1);
  assert.ok(marketMultiplier(w) < 1.2);
});

test("every curated calendar entry carries audience and scale", () => {
  const missing = PEAK_SEASONS.filter((s) => !CALENDAR_META[s.name]).map((s) => s.name);
  assert.deepEqual(missing, []);
  const extra = Object.keys(CALENDAR_META).filter((n) => !PEAK_SEASONS.some((s) => s.name === n));
  assert.deepEqual(extra, [], "meta entries without a calendar entry");
});

test("Denver is covered: calendar anchors and Red Rocks as a venue", () => {
  const winter = getRelevantPeakSeasons("denver", "2027-01-12", "2027-01-20").map((s) => s.name);
  assert.ok(winter.includes("National Western Stock Show"));
  assert.ok(winter.includes("Denver Ski Season Peak"));
  const summer = getRelevantPeakSeasons("denver", "2026-07-01", "2026-07-10").map((s) => s.name);
  assert.ok(summer.includes("Red Rocks Concert Season"));
  assert.ok(summer.includes("Cherry Creek Arts Festival"));

  for (const raw of ["Red Rocks Amphitheatre", "Red Rocks", "Red Rocks Amphitheatre, Morrison, CO", "red rocks amphitheater"]) {
    assert.equal(matchVenue("denver", raw)?.name, "Red Rocks Amphitheatre", raw);
  }
  assert.equal(matchVenue("denver", "Hard Rock Stadium"), null, "another market's venue must not match");
  assert.equal(matchVenue("miami", "Hard Rock Stadium")?.name, "Hard Rock Stadium");
});

test("every market has a venue list", () => {
  for (const slug of ["miami", "tampa", "orlando", "scottsdale", "phoenix", "denver", "los-angeles", "las-vegas", "new-york", "chicago", "dallas", "atlanta"]) {
    assert.ok((MARKET_VENUES[slug] ?? []).length >= 8, `${slug} venues`);
  }
});

test("helpers", () => {
  assert.equal(scaleFromAttendance(500), "local");
  assert.equal(scaleFromAttendance(25_000), "regional");
  assert.equal(scaleFromAttendance(80_000), "national");
  assert.equal(scaleFromAttendance(300_000), "global");
  assert.deepEqual(cleanUrls(["https://a.com/x", "javascript:alert(1)", 5, "https://a.com/x", "ftp://x"]), ["https://a.com/x"]);
});

test("routine single-night events stay small; multi-day draws matter", () => {
  // The model called an NHL game "national"; attendance (18k) caps it at regional, one night halves it.
  const scale = effectiveScale("national", 18_000);
  assert.equal(scale, "regional");
  const game = segmentImpactFor("sports-fans", scale, null, durationFactor("2026-10-10", "2026-10-10"));
  for (const seg of SEGMENTS) assert.ok(game[seg] < 1.08, `NHL game ${seg} ${game[seg]}`);

  // A Red Rocks night (9.5k): about 2-3%.
  const rr = segmentImpactFor("festival-group", effectiveScale("regional", 9_500), null, durationFactor("2026-10-10"));
  for (const seg of SEGMENTS) assert.ok(rr[seg] < 1.04, `Red Rocks ${seg} ${rr[seg]}`);
  assert.ok(rr.suv > rr.exotic);

  // A 3-day festival of 90k is a real event: SUVs clearly lifted.
  const fest = segmentImpactFor("festival-group", effectiveScale("national", 90_000), null, durationFactor("2026-11-06", "2026-11-08"));
  assert.ok(fest.suv >= 1.25 && fest.suv > fest.exotic);

  // Unknown attendance never earns more than "regional".
  assert.equal(effectiveScale("global", 0), "regional");
  assert.equal(effectiveScale("local", 500_000), "local", "never raised above the claim");
});

test("tiers hide the noise: a routine game is routine, a Grand Prix is major", () => {
  const game = segmentImpactFor("sports-fans", "regional", null, 0.5);
  assert.equal(impactTier(game), "routine");
  const gp = segmentImpactFor("motorsport-auto", "global", 1.4);
  assert.equal(impactTier(gp), "major");
});

test("AI duplicates of curated events are caught through aliases", () => {
  const cal = calendarEvents("miami", "2026-11-25", "2026-12-10");
  const names = calendarNamesWithAliases(cal);
  assert.ok(isDuplicateName("Miami Art Week", names));
  assert.ok(isDuplicateName("Art Basel Miami Beach 2026", names));
  assert.ok(!isDuplicateName("Wekfest Miami", names));
  const nat = calendarNamesWithAliases(calendarEvents("denver", "2026-11-20", "2026-11-30"));
  assert.ok(isDuplicateName("Thanksgiving holiday weekend", nat));
  assert.ok(!isDuplicateName("Macy's Thanksgiving Day Parade", nat), "a distinct Thanksgiving event is kept");
  for (const name of Object.keys(CALENDAR_ALIASES)) {
    assert.ok(PEAK_SEASONS.some((s) => s.name === name), `alias key without calendar entry: ${name}`);
  }
});

test("sanitizing a model result: computed numbers, anchored status, bad input rejected", () => {
  const denver = resolveCity("denver");
  const good = sanitizeAiEvent({
    name: "Rise Against", venue: "Red Rocks Amphitheatre", date: "2026-10-12", endDate: "2026-10-12",
    category: "concerts", audience: "festival-group", scale: "national", attendance: 9500,
    impactScore: 99, sourceUrls: ["https://www.redrocksonline.com/events/"],
  }, denver, "2026-10-09", "2027-01-07")!;
  assert.equal(good.scale, "local", "9.5k attendance caps the claimed national scale");
  assert.equal(good.pricingEligible, true);
  assert.equal(good.tier, "routine");
  assert.ok(good.impactScore < 70, "the model's own impactScore (99) is ignored");

  const unanchored = sanitizeAiEvent({ name: "Pop-up thing", date: "2026-10-12", category: "community", attendance: 5000 }, denver, "2026-10-09", "2027-01-07")!;
  assert.equal(unanchored.pricingEligible, false);

  assert.equal(sanitizeAiEvent({ name: "Old", date: "2025-01-01" }, denver, "2026-10-09", "2027-01-07"), null);
  assert.equal(sanitizeAiEvent({ name: "", date: "2026-10-12" }, denver, "2026-10-09", "2027-01-07"), null);
  assert.equal(sanitizeAiEvent("nonsense", denver, "2026-10-09", "2027-01-07"), null);
});

test("snapshot merge keeps recent events a noisy run missed, drops stale and past ones", () => {
  const now = new Date("2026-10-10T03:00:00Z");
  const denver = resolveCity("denver");
  const mk = (name: string, date: string, seenAt?: string) => ({
    ...sanitizeAiEvent({ name, venue: "Ball Arena", date, category: "sports", attendance: 18000, sourceUrls: ["https://ballarena.com/x"] }, denver, "2026-10-01", "2027-01-07")!,
    seenAt,
  });
  const prev = [
    mk("Game A", "2026-10-20", "2026-10-08T03:00:00Z"),   // seen 2 days ago: kept
    mk("Game B", "2026-10-21", "2026-09-20T03:00:00Z"),   // not seen for 3 weeks: dropped
    mk("Game C", "2026-10-05", "2026-10-09T03:00:00Z"),   // already happened: dropped
    mk("Game D", "2026-10-22", "2026-10-09T03:00:00Z"),   // also found tonight: no duplicate
  ];
  const fresh = [mk("Game D", "2026-10-22"), mk("Game E", "2026-10-23")];
  const merged = mergeSnapshotEvents(prev, fresh, now).map((e) => e.name).sort();
  assert.deepEqual(merged, ["Game A", "Game D", "Game E"]);
});

test("the same event under a different name is not kept twice; different events are", () => {
  const miami = resolveCity("miami");
  const mk = (name: string, date: string, endDate: string, venue = "Mana Wynwood") =>
    sanitizeAiEvent({ name, venue, date, endDate, category: "festivals", attendance: 40000, sourceUrls: ["https://a.com/x"] }, miami, "2026-10-01", "2027-01-07")!;
  const old = mk("III Points Music Festival", "2026-10-16", "2026-10-17");
  const fresh = mk("III Points 2026", "2026-10-16", "2026-10-18");
  assert.ok(looksSameEvent(fresh, old, new Set(["miami", "florida"])));
  const merged = mergeSnapshotEvents([{ ...old, seenAt: "2026-10-09T03:00:00Z" }], [fresh], new Date("2026-10-10T03:00:00Z"), "Miami, Florida");
  assert.deepEqual(merged.map((e) => e.name), ["III Points 2026"]);

  // Different events on overlapping days stay separate; a city word alone never merges two events.
  const a = mk("Miami Carnival Parade & Fete", "2026-10-11", "2026-10-11", "Central Broward Park");
  const b = mk("Miami Dolphins vs Cincinnati Bengals", "2026-10-11", "2026-10-11", "Hard Rock Stadium");
  assert.ok(!looksSameEvent(a, b, new Set(["miami", "florida"])));
});

test("client constants mirror the server's (src/lib/eventImpact.ts)", async () => {
  const client = await import("../lib/eventImpact");
  const server = await import("../../supabase/functions/_shared/eventTaxonomy.ts");
  assert.deepEqual(client.AUDIENCE_WEIGHTS, server.AUDIENCE_WEIGHTS);
  assert.deepEqual(client.SCALE_UPLIFT, server.SCALE_UPLIFT);
  for (const g of client.AUDIENCE_GROUPS) for (const a of g.audiences) assert.ok(server.isAudience(a), a);
  const grouped = new Set(client.AUDIENCE_GROUPS.flatMap((g: { audiences: string[] }) => g.audiences));
  for (const a of server.AUDIENCES) assert.ok(grouped.has(a), `audience without a filter group: ${a}`);
});

const miamiCity = resolveCity("miami");
const rawEvent = (o: Record<string, unknown>) => sanitizeAiEvent({
  name: "Test Event", venue: "Kaseya Center", date: "2026-10-12", endDate: "2026-10-12", category: "concerts",
  audience: "festival-group", scale: "regional", attendance: 15000, sourceUrls: ["https://www.kaseyacenter.com/events"], ...o,
}, miamiCity, "2026-10-01", "2027-01-07")!;

test("caps are conservative until calibrated: Grand Prix exotics stay within +35%", () => {
  assert.equal(MAX_UPLIFT, 0.35);
  const gp = PEAK_SEASONS.find((s) => s.name === "Miami Grand Prix")!;
  const meta = CALENDAR_META[gp.name];
  const impact = segmentImpactFor(meta.audience, meta.scale, gp.surge);
  for (const seg of SEGMENTS) assert.ok(impact[seg] <= 1.35 + 1e-9, `${seg} ${impact[seg]}`);
  assert.ok(impact.exotic > impact.suv, "who comes still differentiates the segments");
});

test("evidence ladder: curated, verified, listed, unconfirmed and their weights", () => {
  assert.equal(evidenceFor({ source: "calendar" }), "curated");
  assert.equal(evidenceFor({ source: "ai", pageStatus: "confirmed", sourceUrls: ["https://a.com/x"] }), "verified");
  assert.equal(evidenceFor({ source: "ai", venueMatched: true, sourceUrls: ["https://a.com/x"], pageStatus: "unreachable" }), "listed");
  assert.equal(evidenceFor({ source: "ai", venueMatched: true, sourceUrls: ["https://a.com/x"], pageStatus: "no-match" }), "listed");
  assert.equal(evidenceFor({ source: "ai", venueMatched: false, sourceUrls: ["https://a.com/x"] }), "unconfirmed");
  assert.equal(evidenceFor({ source: "ai", venueMatched: true, sourceUrls: [] }), "unconfirmed");
  assert.equal(evidenceFor({ source: "ai", venueMatched: true, sourceUrls: ["https://a.com/x"], conflict: true }), "unconfirmed");
  assert.equal(evidenceFor({ source: "ai", pageStatus: "confirmed", conflict: true }), "verified", "a confirming page settles a conflict");
  assert.deepEqual(EVIDENCE_WEIGHT, { curated: 1, verified: 1, listed: 0.5, unconfirmed: 0 });

  const base = segmentImpactFor("festival-group", "national", null, 1);
  const half = weightImpact(base, 0.5);
  assert.ok(Math.abs((half.suv - 1) - (base.suv - 1) / 2) < 0.002);
  assert.deepEqual(weightImpact(base, 0), { exotic: 1, sports: 1, luxury: 1, suv: 1 });
});

test("an event's pricing effect follows its evidence; its potential effect does not", () => {
  const listed = rawEvent({});
  assert.equal(listed.evidence, "listed");
  const verified = finalizeEvent({ ...listed, pageStatus: "confirmed" });
  assert.equal(verified.evidence, "verified");
  assert.ok(verified.segmentImpact.suv > listed.segmentImpact.suv);
  assert.deepEqual(verified.potentialImpact, listed.potentialImpact);
  const unconfirmed = rawEvent({ venue: "Somewhere Unlisted", sourceUrls: [] });
  assert.equal(unconfirmed.evidence, "unconfirmed");
  assert.equal(unconfirmed.pricingEligible, false);
  assert.deepEqual(unconfirmed.segmentImpact, { exotic: 1, sports: 1, luxury: 1, suv: 1 });
  assert.ok(unconfirmed.potentialImpact.suv > 1, "still shown with what it would be worth if confirmed");
});

test("page check: finds the event near its date in the ways sites write dates", () => {
  assert.ok(dateVariants("2026-10-09").includes("oct 9") && dateVariants("2026-10-09").includes("10/9/2026") && dateVariants("2026-10-09").includes("october 09"));
  const html = `<html><script>var x=1</script><body><div class="e"><h3>Rise Against</h3><span>Mon, Oct 12</span></div>
    <div class="e"><h3>Other Band</h3><span>Tue, Oct 13</span></div></body></html>`;
  const text = pageText(html);
  assert.ok(pageConfirmsEvent(text, "Rise Against", "2026-10-12", "2026-10-12"));
  assert.ok(!pageConfirmsEvent(text, "Rise Against", "2026-10-13", "2026-10-13"), "right band, wrong date is not a confirmation");
  assert.ok(!pageConfirmsEvent(text, "Shaboozey", "2026-10-12", "2026-10-12"));
  // dense listing: an event whose own date is farther than a neighbour's is not confirmed by the neighbour's date
  const dense = pageText("<li>Oct 12 Rise Against</li><li>Oct 13 Other Band</li><li>Oct 14 Third Band</li>");
  assert.ok(pageConfirmsEvent(dense, "Other Band", "2026-10-13", "2026-10-13"));
  assert.ok(!pageConfirmsEvent(dense, "Other Band", "2026-10-12", "2026-10-12"));
  assert.ok(!pageConfirmsEvent(dense, "Third Band", "2026-10-13", "2026-10-13"));
  assert.ok(pageConfirmsEvent(pageText("<p>Sunday 11 October: Miami Dolphins vs Cincinnati Bengals</p>"), "Miami Dolphins vs. Cincinnati Bengals", "2026-10-11", "2026-10-11"));
  // multi-day run: any day of the run counts
  assert.ok(pageConfirmsEvent(pageText("<p>III Points Festival October 17</p>"), "III Points Music Festival", "2026-10-16", "2026-10-18"));
});

test("page fetching is safe by construction", () => {
  for (const bad of ["http://a.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://[::1]/x", "https://svc.internal/x", "https://user:pw@a.com/x", "ftp://a.com", "javascript:alert(1)", "https://nodots/x"]) {
    assert.equal(isSafeUrl(bad), false, bad);
  }
  assert.equal(isSafeUrl("https://www.redrocksonline.com/events/"), true);
});

test("verifyEvents fetches each shared page once and labels every event", async () => {
  let fetches = 0;
  const pages: Record<string, string | null> = {
    "https://venue.com/cal": pageText("<li>Mon, Oct 12 <h3>Rise Against</h3></li><li>Mon, Oct 26 <h3>Evanescence</h3></li>"),
    "https://blocked.com/x": null,
  };
  const evs = [
    { name: "Rise Against", date: "2026-10-12", endDate: "2026-10-12", sourceUrls: ["https://venue.com/cal"] },
    { name: "Evanescence", date: "2026-10-26", endDate: "2026-10-26", sourceUrls: ["https://venue.com/cal"] },
    { name: "Ghost Show", date: "2026-10-30", endDate: "2026-10-30", sourceUrls: ["https://venue.com/cal"] },
    { name: "Blocked Show", date: "2026-10-30", endDate: "2026-10-30", sourceUrls: ["https://blocked.com/x"] },
    { name: "No Source", date: "2026-10-30", endDate: "2026-10-30", sourceUrls: [] },
  ];
  const out = await verifyEvents(evs, { fetchText: async (u) => { fetches++; return pages[u] ?? null; } });
  assert.deepEqual(out.map((o) => o.status), ["confirmed", "confirmed", "no-match", "unreachable", "no-source"]);
  assert.equal(fetches, 2, "two distinct pages, fetched once each");
});

test("venue capacity bounds a single-day event and fills a missing estimate", () => {
  const big = rawEvent({ attendance: 60000 });                         // an arena (Kaseya ~19.6K) cannot hold 60K
  assert.equal(big.attendance, 19600);
  assert.equal(big.attendanceBasis, "capacity");
  const unknown = rawEvent({ attendance: 0 });
  assert.equal(unknown.attendance, 19600);
  const normal = rawEvent({ attendance: 15000 });
  assert.equal(normal.attendance, 15000);
  assert.equal(normal.attendanceBasis, "estimate");
  const multi = rawEvent({ attendance: 90000, endDate: "2026-10-14", venue: "Miami Beach Convention Center" });
  assert.equal(multi.attendance, 90000, "multi-day and convention-center events are not capped by a seat count");
});

test("the Dolphins case: two home games days apart cannot both stand unless a page confirms one", () => {
  const stadium = (name: string, date: string, extra: Record<string, unknown> = {}) =>
    rawEvent({ name, date, endDate: date, venue: "Hard Rock Stadium", category: "sports", audience: "sports-fans", attendance: 65000, sourceUrls: ["https://www.ticketmaster.com/hard-rock-stadium"], ...extra });
  const a = stadium("Miami Dolphins vs. Los Angeles Chargers", "2026-10-09");
  const b = stadium("Miami Dolphins vs. Cincinnati Bengals", "2026-10-11");
  const c = stadium("New England Patriots vs. Miami Dolphins", "2026-11-01");
  // neither confirmed: both flagged
  let out = markScheduleConflicts([a, b, c], "miami");
  assert.deepEqual(out.map((e) => e.evidence), ["unconfirmed", "unconfirmed", "listed"]);
  // the page confirms the Bengals game: only the other stays flagged
  const verified = applyVerification([a, b, c], [{ status: "no-match" }, { status: "confirmed" }, { status: "unreachable" }]);
  out = markScheduleConflicts(verified, "miami");
  assert.deepEqual(out.map((e) => e.evidence), ["unconfirmed", "verified", "listed"]);
  // arena games on consecutive nights are normal and are never flagged
  const heat1 = rawEvent({ name: "Heat vs Nets", date: "2026-10-14", endDate: "2026-10-14", category: "sports", attendance: 19600 });
  const heat2 = rawEvent({ name: "Heat vs Bulls", date: "2026-10-15", endDate: "2026-10-15", category: "sports", attendance: 19600 });
  assert.deepEqual(markScheduleConflicts([heat1, heat2], "miami").map((e) => e.evidence), ["listed", "listed"]);
});

test("client classifier matches the server's on the fleet's models", async () => {
  const client = await import("../lib/eventImpact");
  const pairs: Array<[string, string]> = [
    ["Lamborghini","Urus"],["Lamborghini","Huracan EVO Spyder"],["Rolls-Royce","Cullinan"],["Rolls Royce","Dawn"],["Rolls-Royce","Ghost"],["Cadillac","Escalade ESV"],
    ["Ferrari","488 Spider"],["Ferrari","Purosangue"],["McLaren","720S"],["Mercedes-Benz","AMG G63"],["Mercedes-Benz","S580"],["Mercedes-Benz","AMG GLE63s"],
    ["Mercedes-Benz","C63s"],["Chevrolet","Corvette Z06"],["Porsche","911 Turbo S"],["Porsche","Cayenne"],["Porsche","Taycan Turbo S"],["Land Rover","Velar"],
    ["BMW","M4 Competition"],["BMW","X7"],["BMW","XM"],["BMW","i8 Roadster"],["Aston Martin","DBX707"],["Aston Martin","Vantage"],["Audi","R8 V10 Plus"],
    ["Bentley","Bentayga"],["Bentley","Continental GT"],["Bugatti","Chiron Sport"],["Maserati","MC20"],["Tesla","Cybertruck"],["Toyota","Sienna"],["Ford","Bronco"],
    ["Nissan","GT-R R35"],["Jaguar","F-Type"],["Honda","Accord"],["Mercedes-AMG","One"],["Mercedes-Benz","Maybach S580"],["Dodge","Durango SRT Hellcat"],
  ];
  const diffs = pairs.filter(([a, b]) => client.classifyVehicleSegmentClient(a, b) !== classifyVehicleSegment(a, b));
  assert.deepEqual(diffs, []);
});

test("snapshot merge never carries forward events written under older rules", () => {
  const now = new Date("2026-10-10T03:00:00Z");
  const fresh = rawEvent({ name: "Fresh Show", date: "2026-10-20", endDate: "2026-10-20" });
  const legacy = { ...rawEvent({ name: "Old Rules Show", date: "2026-10-21", endDate: "2026-10-21" }), seenAt: "2026-10-09T03:00:00Z" } as Record<string, unknown>;
  delete legacy.evidence; delete legacy.potentialImpact;
  const current = { ...rawEvent({ name: "Recent Show", date: "2026-10-22", endDate: "2026-10-22" }), seenAt: "2026-10-09T03:00:00Z" };
  const merged = mergeSnapshotEvents([legacy as never, current], [fresh], now, "Miami, Florida").map((e) => e.name).sort();
  assert.deepEqual(merged, ["Fresh Show", "Recent Show"]);
});

test("curated events carry an official site, and a window check accepts any day inside the window", () => {
  const ev = calendarEvents("miami", "2026-11-25", "2026-12-10").find((e) => e.name === "Art Basel Miami")!;
  assert.deepEqual(ev.sourceUrls, ["https://www.artbasel.com/miami-beach"]);
  // official page says Dec 4-6; our window is Dec 1-8: confirmed when any day inside matches
  const page = pageText("<h1>Art Basel Miami Beach</h1><p>December 4 – 6, 2026 · Miami Beach Convention Center</p>");
  assert.ok(pageConfirmsEvent(page, "Art Basel Miami", ev.date, ev.endDate, true));
  assert.ok(!pageConfirmsEvent(page, "Art Basel Miami", ev.date, ev.endDate, false), "the strict check (first/last day only) would wrongly reject it");
  const moved = pageText("<h1>Art Basel Miami Beach</h1><p>March 4 – 6, 2027</p>");
  assert.ok(!pageConfirmsEvent(moved, "Art Basel Miami", ev.date, ev.endDate, true), "dates outside our window do not confirm");
  for (const name of Object.keys(CALENDAR_SOURCES)) assert.ok(PEAK_SEASONS.some((s) => s.name === name), `source without a calendar entry: ${name}`);
  for (const url of Object.values(CALENDAR_SOURCES)) assert.ok(isSafeUrl(url), url);
});
