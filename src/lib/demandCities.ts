/**
 * Canonical market registry for the MotorIQ demand forecast engine.
 *
 * This list is the single source of truth for the client. The edge function
 * (`supabase/functions/_shared/demandCities.ts`) keeps a mirrored registry so
 * the server can validate any incoming city slug — never trust the client list
 * alone.
 */

export interface DemandCity {
  value: string;
  label: string;
  /** Short market name used in AI prompts, e.g. "Tampa, Florida" */
  promptName: string;
  lat: number;
  lon: number;
  /** Default search radius in km around the city centroid */
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

export const DEFAULT_DEMAND_CITY =
  DEMAND_CITIES.find((c) => c.isDefault)?.value ?? DEMAND_CITIES[0].value;

export const getDemandCity = (value?: string | null): DemandCity | undefined =>
  DEMAND_CITIES.find((c) => c.value === value);

/**
 * Best-effort mapping from a free-text tenant location (city / address string)
 * to a supported market, so the forecast defaults to the tenant's own city.
 */
export const matchDemandCity = (input?: string | null): DemandCity | undefined => {
  if (!input) return undefined;
  const haystack = input.toLowerCase();
  return DEMAND_CITIES.find((c) => {
    const cityName = c.label.split(',')[0].toLowerCase();
    return haystack.includes(cityName) || haystack.includes(c.value.replace('-', ' '));
  });
};
