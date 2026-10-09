/**
 * Major venues per market. The event search looks at these venues' upcoming schedules
 * FIRST (a Red Rocks headliner never appears in a generic "events in Denver" search),
 * and an AI-found event that names one of them counts as anchored for pricing.
 *
 * Names are the ones the venues use publicly; naming rights change, so matching is
 * token-based and tolerant (see `matchVenue`). Extend freely: nothing else depends on the list.
 */

export type VenueKind = 'amphitheater' | 'arena' | 'stadium' | 'convention' | 'racetrack' | 'theater' | 'ballpark' | 'festival-grounds' | 'resort';

export interface Venue {
  name: string;
  kind: VenueKind;
  /** Approximate seated/standing capacity for a typical event (rounded, from public venue information). */
  capacity?: number;
  /** Alternate names used to match AI output. */
  aka?: string[];
}

export const MARKET_VENUES: Record<string, Venue[]> = {
  miami: [
    { name: 'Hard Rock Stadium', kind: 'stadium', aka: ['Miami International Autodrome'] },
    { name: 'Kaseya Center', kind: 'arena', aka: ['FTX Arena', 'American Airlines Arena'] },
    { name: 'loanDepot park', kind: 'ballpark', aka: ['Marlins Park'] },
    { name: 'Miami Beach Convention Center', kind: 'convention' },
    { name: 'Bayfront Park', kind: 'festival-grounds', aka: ['Bayfront Park Amphitheater'] },
    { name: 'Adrienne Arsht Center', kind: 'theater' },
    { name: 'The Fillmore Miami Beach', kind: 'theater', aka: ['Fillmore Miami Beach'] },
    { name: 'Faena Forum', kind: 'theater' },
    { name: 'Homestead-Miami Speedway', kind: 'racetrack' },
    { name: 'Miami Marine Stadium', kind: 'amphitheater' },
    { name: 'Mana Wynwood', kind: 'festival-grounds', aka: ['Mana Wynwood Convention Center'] },
    { name: 'Watsco Center', kind: 'arena' },
  ],
  tampa: [
    { name: 'Raymond James Stadium', kind: 'stadium' },
    { name: 'Amalie Arena', kind: 'arena' },
    { name: 'Tampa Convention Center', kind: 'convention' },
    { name: 'Steinbrenner Field', kind: 'ballpark' },
    { name: 'MidFlorida Credit Union Amphitheatre', kind: 'amphitheater', aka: ['Florida State Fairgrounds'] },
    { name: 'Hard Rock Event Center', kind: 'arena', aka: ['Seminole Hard Rock Tampa'] },
    { name: 'Ruth Eckerd Hall', kind: 'theater' },
    { name: 'Tropicana Field', kind: 'ballpark' },
    { name: 'Straz Center', kind: 'theater' },
  ],
  orlando: [
    { name: 'Kia Center', kind: 'arena', aka: ['Amway Center'] },
    { name: 'Camping World Stadium', kind: 'stadium', aka: ['Citrus Bowl'] },
    { name: 'Orange County Convention Center', kind: 'convention' },
    { name: 'Dr. Phillips Center', kind: 'theater' },
    { name: 'Inter&Co Stadium', kind: 'stadium', aka: ['Exploria Stadium', 'Orlando City Stadium'] },
    { name: 'Daytona International Speedway', kind: 'racetrack' },
    { name: 'Tinker Field', kind: 'festival-grounds' },
    { name: 'Walt Disney World', kind: 'resort' },
    { name: 'Universal Orlando', kind: 'resort' },
  ],
  scottsdale: [
    { name: 'TPC Scottsdale', kind: 'stadium' },
    { name: 'WestWorld of Scottsdale', kind: 'festival-grounds', aka: ['WestWorld'] },
    { name: 'Scottsdale Stadium', kind: 'ballpark' },
    { name: 'Salt River Fields at Talking Stick', kind: 'ballpark' },
    { name: 'Talking Stick Resort Amphitheatre', kind: 'amphitheater' },
    { name: 'Scottsdale Fashion Square', kind: 'resort' },
    { name: 'State Farm Stadium', kind: 'stadium' },
    { name: 'Footprint Center', kind: 'arena' },
    { name: 'Phoenix Raceway', kind: 'racetrack' },
  ],
  phoenix: [
    { name: 'State Farm Stadium', kind: 'stadium', aka: ['Glendale'] },
    { name: 'Footprint Center', kind: 'arena' },
    { name: 'Chase Field', kind: 'ballpark' },
    { name: 'Phoenix Convention Center', kind: 'convention' },
    { name: 'Talking Stick Resort Amphitheatre', kind: 'amphitheater' },
    { name: 'Desert Diamond Arena', kind: 'arena' },
    { name: 'Phoenix Raceway', kind: 'racetrack' },
    { name: 'TPC Scottsdale', kind: 'stadium' },
    { name: 'Arizona Federal Theatre', kind: 'theater' },
  ],
  denver: [
    { name: 'Red Rocks Amphitheatre', kind: 'amphitheater', aka: ['Red Rocks', 'Morrison'] },
    { name: 'Ball Arena', kind: 'arena' },
    { name: 'Empower Field at Mile High', kind: 'stadium', aka: ['Mile High'] },
    { name: 'Coors Field', kind: 'ballpark' },
    { name: 'Fiddler\'s Green Amphitheatre', kind: 'amphitheater' },
    { name: 'Mission Ballroom', kind: 'theater' },
    { name: 'Fillmore Auditorium', kind: 'theater' },
    { name: 'Colorado Convention Center', kind: 'convention', aka: ['Bellco Theatre'] },
    { name: 'Dick\'s Sporting Goods Park', kind: 'stadium' },
    { name: 'Denver Performing Arts Complex', kind: 'theater' },
    { name: 'National Western Complex', kind: 'festival-grounds' },
  ],
  'los-angeles': [
    { name: 'SoFi Stadium', kind: 'stadium' },
    { name: 'Crypto.com Arena', kind: 'arena', aka: ['Staples Center'] },
    { name: 'Intuit Dome', kind: 'arena' },
    { name: 'Hollywood Bowl', kind: 'amphitheater' },
    { name: 'Dodger Stadium', kind: 'ballpark' },
    { name: 'Rose Bowl', kind: 'stadium' },
    { name: 'Kia Forum', kind: 'arena', aka: ['The Forum'] },
    { name: 'Los Angeles Convention Center', kind: 'convention' },
    { name: 'BMO Stadium', kind: 'stadium' },
    { name: 'Long Beach Grand Prix', kind: 'racetrack' },
  ],
  'las-vegas': [
    { name: 'Allegiant Stadium', kind: 'stadium' },
    { name: 'T-Mobile Arena', kind: 'arena' },
    { name: 'Sphere', kind: 'arena' },
    { name: 'Las Vegas Convention Center', kind: 'convention' },
    { name: 'Las Vegas Motor Speedway', kind: 'racetrack' },
    { name: 'Venetian Expo', kind: 'convention', aka: ['Venetian'] },
    { name: 'Caesars Forum', kind: 'convention' },
    { name: 'Mandalay Bay Events Center', kind: 'arena', aka: ['Mandalay Bay'] },
    { name: 'MGM Grand Garden Arena', kind: 'arena' },
    { name: 'Las Vegas Strip Circuit', kind: 'racetrack', aka: ['Las Vegas Grand Prix'] },
  ],
  'new-york': [
    { name: 'Madison Square Garden', kind: 'arena' },
    { name: 'MetLife Stadium', kind: 'stadium' },
    { name: 'Barclays Center', kind: 'arena' },
    { name: 'Yankee Stadium', kind: 'ballpark' },
    { name: 'Citi Field', kind: 'ballpark' },
    { name: 'Javits Center', kind: 'convention' },
    { name: 'USTA Billie Jean King National Tennis Center', kind: 'stadium', aka: ['US Open'] },
    { name: 'UBS Arena', kind: 'arena' },
    { name: 'Radio City Music Hall', kind: 'theater' },
    { name: 'Lincoln Center', kind: 'theater' },
  ],
  chicago: [
    { name: 'United Center', kind: 'arena' },
    { name: 'Soldier Field', kind: 'stadium' },
    { name: 'Wrigley Field', kind: 'ballpark' },
    { name: 'Rate Field', kind: 'ballpark', aka: ['Guaranteed Rate Field'] },
    { name: 'McCormick Place', kind: 'convention' },
    { name: 'Grant Park', kind: 'festival-grounds', aka: ['Lollapalooza'] },
    { name: 'Huntington Bank Pavilion', kind: 'amphitheater' },
    { name: 'Navy Pier', kind: 'festival-grounds' },
    { name: 'Chicago Theatre', kind: 'theater' },
  ],
  dallas: [
    { name: 'AT&T Stadium', kind: 'stadium', aka: ['Arlington'] },
    { name: 'American Airlines Center', kind: 'arena' },
    { name: 'Globe Life Field', kind: 'ballpark' },
    { name: 'Kay Bailey Hutchison Convention Center', kind: 'convention', aka: ['Dallas Convention Center'] },
    { name: 'Texas Motor Speedway', kind: 'racetrack' },
    { name: 'Fair Park', kind: 'festival-grounds', aka: ['State Fair of Texas', 'Cotton Bowl'] },
    { name: 'Dickies Arena', kind: 'arena' },
    { name: 'Dos Equis Pavilion', kind: 'amphitheater' },
    { name: 'Dallas Market Center', kind: 'convention' },
  ],
  atlanta: [
    { name: 'Mercedes-Benz Stadium', kind: 'stadium' },
    { name: 'State Farm Arena', kind: 'arena' },
    { name: 'Truist Park', kind: 'ballpark' },
    { name: 'Georgia World Congress Center', kind: 'convention' },
    { name: 'Lakewood Amphitheatre', kind: 'amphitheater', aka: ['Cellairis Amphitheatre'] },
    { name: 'Atlanta Motor Speedway', kind: 'racetrack' },
    { name: 'Road Atlanta', kind: 'racetrack' },
    { name: 'Piedmont Park', kind: 'festival-grounds' },
    { name: 'Fox Theatre', kind: 'theater' },
    { name: 'Gateway Center Arena', kind: 'arena' },
  ],
};

/**
 * Approximate capacities, rounded. They cap a single-day event's estimated attendance (an arena show cannot draw 40,000)
 * and stand in when an estimate is missing. Convention centers, resorts and festival grounds are left out on purpose:
 * their draw is not a seat count. Verify before quoting externally.
 */
const CAPACITY: Record<string, number> = {
  // Miami
  'Hard Rock Stadium': 65000, 'Kaseya Center': 19600, 'loanDepot park': 36500, 'Bayfront Park': 10000, 'The Fillmore Miami Beach': 2700,
  'Homestead-Miami Speedway': 65000, 'Watsco Center': 8000,
  // Tampa
  'Raymond James Stadium': 65600, 'Amalie Arena': 19000, 'Steinbrenner Field': 11000, 'MidFlorida Credit Union Amphitheatre': 20000, 'Ruth Eckerd Hall': 2200,
  // Orlando
  'Kia Center': 20000, 'Camping World Stadium': 60000, 'Inter&Co Stadium': 25500, 'Daytona International Speedway': 101500,
  // Scottsdale / Phoenix
  'State Farm Stadium': 63400, 'Footprint Center': 17000, 'Chase Field': 48700, 'Talking Stick Resort Amphitheatre': 20000,
  'Phoenix Raceway': 41000, 'Scottsdale Stadium': 12000, 'Salt River Fields at Talking Stick': 11000,
  // Denver
  'Red Rocks Amphitheatre': 9500, 'Ball Arena': 19500, 'Empower Field at Mile High': 76100, 'Coors Field': 50100,
  "Fiddler's Green Amphitheatre": 18000, 'Mission Ballroom': 3950, 'Fillmore Auditorium': 3900, "Dick's Sporting Goods Park": 18000,
  // Los Angeles
  'SoFi Stadium': 70200, 'Crypto.com Arena': 19000, 'Intuit Dome': 18000, 'Hollywood Bowl': 17500, 'Dodger Stadium': 56000,
  'Rose Bowl': 89700, 'Kia Forum': 17500, 'BMO Stadium': 22000,
  // Las Vegas
  'Allegiant Stadium': 65000, 'T-Mobile Arena': 20000, 'Sphere': 18000, 'MGM Grand Garden Arena': 16800, 'Mandalay Bay Events Center': 12000,
  'Las Vegas Motor Speedway': 142000,
  // New York
  'Madison Square Garden': 19500, 'MetLife Stadium': 82500, 'Barclays Center': 17700, 'Yankee Stadium': 46500, 'Citi Field': 41900,
  'UBS Arena': 17000, 'Radio City Music Hall': 5900,
  // Chicago
  'United Center': 20900, 'Soldier Field': 61500, 'Wrigley Field': 41600, 'Rate Field': 40000, 'Huntington Bank Pavilion': 30000,
  // Dallas
  'AT&T Stadium': 80000, 'American Airlines Center': 19200, 'Globe Life Field': 40300, 'Texas Motor Speedway': 135000,
  'Dickies Arena': 14000, 'Dos Equis Pavilion': 20000,
  // Atlanta
  'Mercedes-Benz Stadium': 71000, 'State Farm Arena': 18100, 'Truist Park': 41100, 'Lakewood Amphitheatre': 19000,
  'Atlanta Motor Speedway': 71000, 'Fox Theatre': 4600,
};
for (const list of Object.values(MARKET_VENUES)) for (const v of list) if (CAPACITY[v.name]) v.capacity = CAPACITY[v.name];

const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);

/**
 * Does an AI-supplied venue string refer to one of the market's known venues?
 * True when all significant tokens of a known name (or alias) appear in the string, or the
 * other way round, so "Red Rocks Amphitheatre, Morrison CO" and "Red Rocks" both match.
 */
export function matchVenue(citySlug: string, raw: unknown): Venue | null {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return null;
  const t = new Set(tokens(text));
  if (t.size === 0) return null;
  for (const v of MARKET_VENUES[citySlug] ?? []) {
    for (const name of [v.name, ...(v.aka ?? [])]) {
      const nt = tokens(name);
      if (nt.length === 0) continue;
      const fwd = nt.every((w) => t.has(w));
      const back = [...t].every((w) => nt.includes(w)) && t.size >= 2;
      if (fwd || back) return v;
    }
  }
  return null;
}

/** Venue lines for the search prompt. */
export function venuePromptList(citySlug: string): string {
  return (MARKET_VENUES[citySlug] ?? []).map((v) => `- ${v.name} (${v.kind})`).join('\n');
}
