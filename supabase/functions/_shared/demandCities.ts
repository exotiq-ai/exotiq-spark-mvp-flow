/**
 * Shared market + seasonal-event registry for the demand forecast engine.
 *
 * Server-side source of truth. The client mirrors the city list in
 * `src/lib/demandCities.ts`; the server validates every incoming slug against
 * this registry and never trusts client-supplied coordinates.
 */

export interface DemandCity {
  value: string;
  label: string;
  promptName: string;
  lat: number;
  lon: number;
  radiusKm: number;
  isDefault?: boolean;
}

export const DEMAND_CITIES: DemandCity[] = [
  { value: 'miami', label: 'Miami, FL', promptName: 'Miami, Florida', lat: 25.7617, lon: -80.1918, radiusKm: 50, isDefault: true },
  { value: 'tampa', label: 'Tampa, FL', promptName: 'Tampa / St. Petersburg, Florida', lat: 27.9506, lon: -82.4572, radiusKm: 60 },
  { value: 'orlando', label: 'Orlando, FL', promptName: 'Orlando, Florida', lat: 28.5383, lon: -81.3792, radiusKm: 60 },
  { value: 'scottsdale', label: 'Scottsdale, AZ', promptName: 'Scottsdale, Arizona', lat: 33.4942, lon: -111.9261, radiusKm: 50 },
  { value: 'phoenix', label: 'Phoenix, AZ', promptName: 'Phoenix, Arizona', lat: 33.4484, lon: -112.0740, radiusKm: 50 },
  { value: 'denver', label: 'Denver, CO', promptName: 'Denver, Colorado', lat: 39.7392, lon: -104.9903, radiusKm: 50 },
  { value: 'los-angeles', label: 'Los Angeles, CA', promptName: 'Los Angeles, California', lat: 34.0522, lon: -118.2437, radiusKm: 60 },
  { value: 'las-vegas', label: 'Las Vegas, NV', promptName: 'Las Vegas, Nevada', lat: 36.1699, lon: -115.1398, radiusKm: 50 },
  { value: 'new-york', label: 'New York, NY', promptName: 'New York City, New York', lat: 40.7128, lon: -74.0060, radiusKm: 50 },
  { value: 'chicago', label: 'Chicago, IL', promptName: 'Chicago, Illinois', lat: 41.8781, lon: -87.6298, radiusKm: 50 },
  { value: 'dallas', label: 'Dallas, TX', promptName: 'Dallas, Texas', lat: 32.7767, lon: -96.7970, radiusKm: 50 },
  { value: 'atlanta', label: 'Atlanta, GA', promptName: 'Atlanta, Georgia', lat: 33.7490, lon: -84.3880, radiusKm: 50 },
];

export const DEFAULT_CITY = 'miami';

export const resolveCity = (value?: unknown): DemandCity => {
  const slug = typeof value === 'string' ? value.trim().toLowerCase().slice(0, 40) : '';
  return DEMAND_CITIES.find((c) => c.value === slug)
    ?? DEMAND_CITIES.find((c) => c.value === DEFAULT_CITY)!;
};

export const EVENT_CATEGORIES = [
  'concerts',
  'sports',
  'conferences',
  'festivals',
  'performing-arts',
  'expos',
  'community',
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number];

export interface PeakSeason {
  name: string;
  /** MM-DD */
  start: string;
  /** MM-DD — may be earlier than start when the season wraps the new year */
  end: string;
  city: string; // city slug or 'all'
  category: EventCategory;
  attendance: number;
  surge: number;
  description: string;
}

export const PEAK_SEASONS: PeakSeason[] = [
  // ---- Miami ----
  { name: 'Art Basel Miami', start: '12-01', end: '12-08', city: 'miami', category: 'festivals', attendance: 83000, surge: 1.35, description: 'International art fair attracting collectors and celebrities' },
  { name: 'Miami Boat Show', start: '02-12', end: '02-16', city: 'miami', category: 'expos', attendance: 100000, surge: 1.30, description: 'Largest boat and marine show in the world' },
  { name: 'Ultra Music Festival', start: '03-28', end: '03-30', city: 'miami', category: 'festivals', attendance: 170000, surge: 1.35, description: 'Premier electronic music festival' },
  { name: 'Miami Grand Prix', start: '05-02', end: '05-04', city: 'miami', category: 'sports', attendance: 250000, surge: 1.40, description: 'Formula 1 race at Miami International Autodrome' },
  { name: 'Miami Open Tennis', start: '03-17', end: '03-30', city: 'miami', category: 'sports', attendance: 300000, surge: 1.25, description: 'ATP/WTA combined Masters 1000 event' },
  { name: 'Miami Swim Week', start: '06-01', end: '06-08', city: 'miami', category: 'expos', attendance: 30000, surge: 1.20, description: 'Fashion industry swimwear showcase' },
  { name: 'Spring Break Miami', start: '03-10', end: '03-25', city: 'miami', category: 'community', attendance: 500000, surge: 1.25, description: 'Peak tourism season for South Florida' },

  // ---- Tampa / St. Petersburg ----
  { name: 'Gasparilla Pirate Festival', start: '01-24', end: '01-26', city: 'tampa', category: 'festivals', attendance: 300000, surge: 1.35, description: 'Tampa\'s signature invasion parade and waterfront festival' },
  { name: 'Firestone Grand Prix of St. Petersburg', start: '02-27', end: '03-01', city: 'tampa', category: 'sports', attendance: 150000, surge: 1.35, description: 'IndyCar season-opening street race on the St. Pete waterfront' },
  { name: 'Florida State Fair', start: '02-05', end: '02-16', city: 'tampa', category: 'expos', attendance: 480000, surge: 1.15, description: 'Twelve-day state fair at the Florida State Fairgrounds' },
  { name: 'Florida Strawberry Festival', start: '02-26', end: '03-08', city: 'tampa', category: 'festivals', attendance: 550000, surge: 1.15, description: 'Plant City festival drawing major regional and touring acts' },
  { name: 'Gasparilla Distance Classic', start: '02-21', end: '02-22', city: 'tampa', category: 'sports', attendance: 30000, surge: 1.10, description: 'Bayshore Boulevard race weekend' },
  { name: 'Buccaneers Home Season', start: '09-07', end: '01-04', city: 'tampa', category: 'sports', attendance: 65000, surge: 1.20, description: 'NFL home games at Raymond James Stadium' },
  { name: 'Tampa Bay Boat Show', start: '09-12', end: '09-14', city: 'tampa', category: 'expos', attendance: 25000, surge: 1.10, description: 'Marine expo at the Tampa Convention Center' },
  { name: 'Clearwater Beach Peak Season', start: '02-01', end: '04-15', city: 'tampa', category: 'community', attendance: 0, surge: 1.20, description: 'Gulf-coast snowbird and spring travel peak' },

  // ---- Orlando ----
  { name: 'IAAPA Expo', start: '11-17', end: '11-21', city: 'orlando', category: 'expos', attendance: 42000, surge: 1.30, description: 'Global attractions industry trade show at the Orange County Convention Center' },
  { name: 'MegaCon Orlando', start: '05-21', end: '05-24', city: 'orlando', category: 'expos', attendance: 160000, surge: 1.20, description: 'Largest fan convention in the Southeast' },
  { name: 'Electric Daisy Carnival Orlando', start: '11-07', end: '11-09', city: 'orlando', category: 'festivals', attendance: 100000, surge: 1.30, description: 'Major EDM festival at Tinker Field' },
  { name: 'Rolex 24 at Daytona', start: '01-22', end: '01-25', city: 'orlando', category: 'sports', attendance: 100000, surge: 1.30, description: 'Endurance racing classic an hour from Orlando' },
  { name: 'Daytona 500 Week', start: '02-12', end: '02-15', city: 'orlando', category: 'sports', attendance: 250000, surge: 1.30, description: 'NASCAR season opener drawing Central Florida-wide demand' },
  { name: 'Daytona Bike Week', start: '02-27', end: '03-08', city: 'orlando', category: 'community', attendance: 400000, surge: 1.20, description: 'Ten-day motorcycle rally with regional spillover' },
  { name: 'Citrus Bowl & Pop-Tarts Bowl', start: '12-27', end: '01-02', city: 'orlando', category: 'sports', attendance: 120000, surge: 1.30, description: 'College bowl games at Camping World Stadium' },
  { name: 'Epcot Food & Wine Festival', start: '08-28', end: '11-22', city: 'orlando', category: 'festivals', attendance: 0, surge: 1.10, description: 'Extended Walt Disney World festival season' },
  { name: 'Halloween Horror Nights', start: '08-29', end: '11-02', city: 'orlando', category: 'festivals', attendance: 0, surge: 1.15, description: 'Universal Orlando peak evening attendance season' },
  { name: 'Orlando Spring Break Peak', start: '03-07', end: '04-12', city: 'orlando', category: 'community', attendance: 0, surge: 1.25, description: 'Theme park spring break capacity peak' },

  // ---- Scottsdale / Phoenix ----
  { name: 'Barrett-Jackson Auction', start: '01-18', end: '01-26', city: 'scottsdale', category: 'expos', attendance: 300000, surge: 1.35, description: 'Largest collector car auction in the world' },
  { name: 'WM Phoenix Open', start: '02-03', end: '02-09', city: 'scottsdale', category: 'sports', attendance: 700000, surge: 1.40, description: 'Highest-attended golf tournament globally' },
  { name: 'Scottsdale Arabian Horse Show', start: '02-13', end: '02-23', city: 'scottsdale', category: 'expos', attendance: 50000, surge: 1.20, description: 'Premier equestrian event with wealthy attendees' },
  { name: 'Spring Training Baseball', start: '02-22', end: '03-25', city: 'scottsdale', category: 'sports', attendance: 200000, surge: 1.20, description: '15 MLB teams train in the Cactus League' },
  { name: 'Scottsdale Arts Festival', start: '03-07', end: '03-09', city: 'scottsdale', category: 'festivals', attendance: 40000, surge: 1.15, description: 'Juried fine art show in downtown Scottsdale' },

  // ---- National (all markets) ----
  { name: 'Christmas & New Years', start: '12-20', end: '01-03', city: 'all', category: 'community', attendance: 0, surge: 1.45, description: 'Peak holiday travel season' },
  { name: 'Super Bowl Weekend', start: '02-05', end: '02-12', city: 'all', category: 'sports', attendance: 100000, surge: 1.50, description: 'Biggest single sporting event in the US' },
  { name: 'Presidents Day Weekend', start: '02-14', end: '02-17', city: 'all', category: 'community', attendance: 0, surge: 1.15, description: 'Long weekend holiday travel' },
  { name: 'Memorial Day Weekend', start: '05-23', end: '05-26', city: 'all', category: 'community', attendance: 0, surge: 1.25, description: 'Start of summer travel season' },
  { name: 'Independence Day', start: '07-01', end: '07-06', city: 'all', category: 'community', attendance: 0, surge: 1.30, description: 'Peak summer holiday period' },
  { name: 'Labor Day Weekend', start: '08-29', end: '09-01', city: 'all', category: 'community', attendance: 0, surge: 1.20, description: 'End of summer travel weekend' },
  { name: 'Thanksgiving Week', start: '11-24', end: '11-30', city: 'all', category: 'community', attendance: 0, surge: 1.30, description: 'Major holiday travel period' },
  { name: 'Summer Peak', start: '06-15', end: '08-15', city: 'all', category: 'community', attendance: 0, surge: 1.15, description: 'General summer tourism season' },
];

export interface ResolvedSeason extends PeakSeason {
  /** Concrete ISO start date (YYYY-MM-DD) for the requested window */
  startDate: string;
  /** Concrete ISO end date (YYYY-MM-DD) for the requested window */
  endDate: string;
}

const isoDate = (year: number, monthDay: string) => `${year}-${monthDay}`;

/**
 * Expands recurring MM-DD seasons into concrete dates for every year touched by
 * the requested window, correctly handling seasons that wrap the new year
 * (e.g. 12-20 -> 01-03) and multi-year ranges.
 */
export function getRelevantPeakSeasons(
  citySlug: string,
  rangeStart: string,
  rangeEnd: string,
): ResolvedSeason[] {
  const startYear = Number(rangeStart.slice(0, 4));
  const endYear = Number(rangeEnd.slice(0, 4));
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return [];

  const resolved: ResolvedSeason[] = [];
  const seen = new Set<string>();

  for (let year = startYear - 1; year <= endYear + 1; year++) {
    for (const season of PEAK_SEASONS) {
      if (season.city !== 'all' && season.city !== citySlug) continue;

      const wraps = season.end < season.start;
      const startDate = isoDate(year, season.start);
      const endDate = isoDate(wraps ? year + 1 : year, season.end);

      // Inclusive overlap test on real ISO dates
      if (endDate < rangeStart || startDate > rangeEnd) continue;

      const key = `${season.name}|${startDate}`;
      if (seen.has(key)) continue;
      seen.add(key);

      resolved.push({ ...season, startDate, endDate });
    }
  }

  return resolved;
}
