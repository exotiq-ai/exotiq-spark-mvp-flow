import { describe, expect, it } from 'vitest';
import { vehicleSchema } from '@/lib/validationSchemas';

// Found in production (2026-11-13): Add Vehicle answered "Validation Error: Expected number, received null"
// when the Year box was left blank. The form treats Year as optional and sends null, and the column is nullable.
const base = { name: 'Sprinter 14 Pax', make: 'Mercedes', model: 'Sprinter', current_rate: 1800 };

describe('vehicle form input', () => {
  it('accepts a vehicle with no year, as the Add Vehicle form sends it', () => {
    const parsed = vehicleSchema.safeParse({ ...base, year: null, license_plate: null, vin: null, color: 'Black', status: 'available', default_mileage_limit: null, mileage_overage_rate: 4.5, location_id: null });
    expect(parsed.success).toBe(true);
    expect(vehicleSchema.safeParse(base).success).toBe(true);
  });
  it('still checks a year that is given', () => {
    expect(vehicleSchema.safeParse({ ...base, year: 2024 }).success).toBe(true);
    expect(vehicleSchema.safeParse({ ...base, year: 1800 }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, year: 2024.5 }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, year: new Date().getFullYear() + 2 }).success).toBe(false);
  });
  it('still requires the fields the form marks as required', () => {
    expect(vehicleSchema.safeParse({ ...base, name: '' }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, current_rate: null }).success).toBe(false);
  });
});
