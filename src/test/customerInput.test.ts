import { describe, expect, it } from 'vitest';
import { cleanCustomerInput, customerSchema, normalizePhone } from '@/lib/validationSchemas';

// Found on the rehearsal (2026-11-01): the Add Customer dialog announced success after a failed save, because
// the form accepted "555-555-0100" while the schema wanted digits only, and an empty date reached Postgres as "".
describe('customer form input', () => {
  it('normalises the phone formats the form accepts into what the schema and the database expect', () => {
    expect(normalizePhone('+1 (555) 000-0000')).toBe('+15550000000');
    expect(normalizePhone('555-555-0100')).toBe('5555550100');
    expect(normalizePhone('  +44 20 7946 0958 ')).toBe('+442079460958');
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
    for (const raw of ['+1 (555) 000-0000', '555-555-0100']) expect(customerSchema.shape.phone.safeParse(normalizePhone(raw)).success).toBe(true);
  });
  it('sends an empty date as null and leaves a real date alone', () => {
    const cleaned = cleanCustomerInput({ full_name: 'Rehearsal Test', email: 'x@example.com', phone: '555-555-0100', date_of_birth: '', license_expiry: '2028-09-11', insurance_expiry: '' });
    expect(cleaned.date_of_birth).toBeNull();
    expect(cleaned.insurance_expiry).toBeNull();
    expect(cleaned.license_expiry).toBe('2028-09-11');
    expect(cleaned.phone).toBe('5555550100');
    expect(cleaned.full_name).toBe('Rehearsal Test');
  });
  it('still validates after cleaning (null dates are not strings, so the insert carries them, not the schema)', () => {
    const cleaned = cleanCustomerInput({ full_name: 'Rehearsal Test', email: 'x@example.com', phone: '+1 (555) 000-0000', date_of_birth: '' });
    const parsed = customerSchema.safeParse(cleaned);
    expect(parsed.success).toBe(true);
  });
});
