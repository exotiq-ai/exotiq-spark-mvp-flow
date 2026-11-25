import { describe, expect, it } from 'vitest';
import {
  HQ_IMPORT_TAG,
  fixNameCase,
  isHqCustomerExport,
  mapHqCustomers,
  missingHqColumns,
  parseHqDate,
} from '@/lib/hqRentalCustomers';
import { transformRows, validateRows, suggestColumnMappings } from '@/lib/importUtils';

// The column headers of HQ Rental Software's customer export. Every value below is made up.
const HQ_HEADERS = [
  'Label', 'Email Address', 'Phone Number', 'Street', 'Street 2', 'City', 'State', 'Zip', 'Country',
  'Driver License Number', 'Expiration Date', 'File Upload', 'Reservation Count',
];

function hqRow(values: Partial<Record<(typeof HQ_HEADERS)[number], unknown>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const h of HQ_HEADERS) row[h] = values[h];
  return row;
}

const TODAY = new Date('2026-11-25T12:00:00Z');

describe('HQ Rental customer export: recognising the file', () => {
  it('recognises the HQ headers, whatever their case or padding', () => {
    expect(isHqCustomerExport(HQ_HEADERS)).toBe(true);
    expect(isHqCustomerExport(HQ_HEADERS.map(h => ` ${h.toUpperCase()} `))).toBe(true);
  });

  it('does not take an exotiq template or another system for HQ', () => {
    expect(isHqCustomerExport(['full_name', 'email', 'phone', 'drivers_license'])).toBe(false);
    expect(isHqCustomerExport(['Name', 'Email Address', 'Phone Number'])).toBe(false);
    expect(isHqCustomerExport(['Label', 'Colour', 'Size'])).toBe(false);
  });

  it('names the HQ columns a file is missing', () => {
    expect(missingHqColumns(HQ_HEADERS)).toEqual([]);
    expect(missingHqColumns(['Label', 'Phone Number'])).toEqual(['Email Address']);
  });
});

describe('HQ Rental customer export: values', () => {
  it('reads Excel date serials, real dates and US-style text dates as YYYY-MM-DD', () => {
    expect(parseHqDate(46022)).toBe('2025-12-31');
    expect(parseHqDate(new Date('2028-09-11T00:00:00Z'))).toBe('2028-09-11');
    expect(parseHqDate('09/11/2028')).toBe('2028-09-11');
    expect(parseHqDate('9/1/2028')).toBe('2028-09-01');
    expect(parseHqDate('2028-09-11')).toBe('2028-09-11');
    expect(parseHqDate('')).toBeNull();
    expect(parseHqDate(undefined)).toBeNull();
    expect(parseHqDate('not a date')).toBeNull();
  });

  it('fixes names typed all-lowercase or all-capitals and leaves mixed case alone', () => {
    expect(fixNameCase('jane doe')).toBe('Jane Doe');
    expect(fixNameCase('JANE  DOE')).toBe('Jane Doe');
    expect(fixNameCase("mary-jane o'neil")).toBe("Mary-Jane O'Neil");
    expect(fixNameCase('Ronald McTest')).toBe('Ronald McTest');
    expect(fixNameCase('Ana de la Prueba')).toBe('Ana de la Prueba');
    expect(fixNameCase('  Sam  ')).toBe('Sam');
  });
});

describe('HQ Rental customer export: mapping rows to customers', () => {
  it('maps one HQ row to an exotiq customer', () => {
    const { customers } = mapHqCustomers([
      hqRow({
        Label: 'jane doe', 'Email Address': ' Jane.Doe@Example.COM ', 'Phone Number': '‪(555) 010-0001‬',
        Street: '1 Test St', 'Street 2': 'Apt 2', City: 'Testville', State: 'FL', Zip: '33000', Country: 'United States',
        'Driver License Number': 'd123456789012', 'Expiration Date': 47000, 'File Upload': '1 images', 'Reservation Count': '3',
      }),
    ], TODAY);
    expect(customers).toHaveLength(1);
    expect(customers[0]).toEqual({
      full_name: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '5550100001',
      address: '1 Test St, Apt 2, Testville, FL 33000, United States',
      drivers_license: 'D123456789012',
      license_expiry: '2028-09-04',
      notes: 'HQ Rental: 3 past reservations.',
      customer_status: 'active',
      tags: [HQ_IMPORT_TAG],
    });
  });

  it('keeps an international phone with its + and leaves missing parts out of the address', () => {
    const { customers } = mapHqCustomers([
      hqRow({ Label: 'Pat Example', 'Email Address': 'pat@example.com', 'Phone Number': '+44 7700 900 000', City: 'London', Country: 'United Kingdom', 'Reservation Count': '1' }),
    ], TODAY);
    expect(customers[0].phone).toBe('+447700900000');
    expect(customers[0].address).toBe('London, United Kingdom');
    expect(customers[0].license_expiry).toBeNull();
    expect(customers[0].drivers_license).toBeNull();
    expect(customers[0].notes).toBe('HQ Rental: 1 past reservation.');
  });

  it('removes stray spaces inside an email address', () => {
    const { customers } = mapHqCustomers([hqRow({ Label: 'Lee Example', 'Email Address': 'lee @example .com' })], TODAY);
    expect(customers[0].email).toBe('lee@example.com');
  });

  it('skips rows without an email and lists them for the operator', () => {
    const { customers, report } = mapHqCustomers([
      hqRow({ Label: 'Has Email', 'Email Address': 'has@example.com' }),
      hqRow({ Label: 'Phone Only', 'Phone Number': '5550100002' }),
      hqRow({ Label: 'Nothing At All' }),
    ], TODAY);
    expect(customers.map(c => c.full_name)).toEqual(['Has Email']);
    expect(report.skippedNoEmail).toEqual([
      { name: 'Phone Only', phone: '5550100002' },
      { name: 'Nothing At All', phone: null },
    ]);
  });

  it('keeps one customer per email: the row with most reservations, the other people in its notes', () => {
    const { customers, report } = mapHqCustomers([
      hqRow({ Label: 'First Booker', 'Email Address': 'shared@example.com', 'Phone Number': '5550100003', 'Reservation Count': '1' }),
      hqRow({ Label: 'Other Person', 'Email Address': 'other@example.com', 'Reservation Count': '1' }),
      hqRow({ Label: 'Main Booker', 'Email Address': 'SHARED@example.com', 'Phone Number': '5550100004', 'Driver License Number': 'X1', 'Reservation Count': '5' }),
      hqRow({ Label: 'Friend Driver', 'Email Address': 'shared@example.com', 'Driver License Number': 'y2', 'Reservation Count': '' }),
    ], TODAY);
    expect(customers.map(c => c.full_name)).toEqual(['Main Booker', 'Other Person']);
    expect(customers[0].phone).toBe('5550100004');
    expect(customers[0].notes).toBe([
      'HQ Rental: 5 past reservations.',
      'Also on this email in HQ Rental: First Booker (phone 5550100003; 1 past reservation).',
      'Also on this email in HQ Rental: Friend Driver (licence Y2).',
    ].join('\n'));
    expect(report.mergedRows).toBe(2);
  });

  it('keeps the first row when shared-email rows have the same number of reservations', () => {
    const { customers } = mapHqCustomers([
      hqRow({ Label: 'Alpha Tie', 'Email Address': 'tie@example.com', 'Reservation Count': '2' }),
      hqRow({ Label: 'Beta Tie', 'Email Address': 'tie@example.com', 'Reservation Count': '2' }),
    ], TODAY);
    expect(customers.map(c => c.full_name)).toEqual(['Alpha Tie']);
  });

  it('ignores blank rows and counts what it did', () => {
    const { report } = mapHqCustomers([
      hqRow({ Label: 'Valid One', 'Email Address': 'one@example.com', 'Expiration Date': 45000 }),
      hqRow({}),
      hqRow({ Label: 'Valid Two', 'Email Address': 'two@example.com', 'Expiration Date': '12/31/2030' }),
      hqRow({ Label: 'Valid Two Again', 'Email Address': 'two@example.com' }),
      hqRow({ Label: 'No Email' }),
    ], TODAY);
    expect(report).toEqual({
      rows: 4,
      customers: 2,
      mergedRows: 1,
      skippedNoEmail: [{ name: 'No Email', phone: null }],
      expiredLicences: 1,
    });
  });
});

describe('HQ Rental customer export: through the import wizard', () => {
  it('maps itself in the column step and validates, tags included', () => {
    const { customers } = mapHqCustomers([
      hqRow({ Label: 'Wizard Test', 'Email Address': 'wizard@example.com', 'Phone Number': '555-010-0005', 'Expiration Date': 47000 }),
    ], TODAY);
    const headers = Object.keys(customers[0]);
    const mappings = suggestColumnMappings(headers, 'customers', customers);
    const mapped = mappings.filter(m => m.sourceColumn);
    expect(mapped.map(m => m.targetField).sort()).toEqual([...headers].sort());
    for (const m of mapped) expect(m.sourceColumn).toBe(m.targetField);
    const result = validateRows(transformRows(customers, mappings), 'customers');
    expect(result.invalidRows).toEqual([]);
    expect(result.validRows[0]).toMatchObject({ email: 'wizard@example.com', tags: [HQ_IMPORT_TAG], license_expiry: '2028-09-04' });
  });
});

describe('customer import validation', () => {
  // customers.email is NOT NULL in the database: a phone-only row used to pass the preview and then
  // fail its whole batch of 50 at insert.
  it('requires an email, because the database does', () => {
    const result = validateRows([{ full_name: 'Phone Only', phone: '5550100006' }], 'customers');
    expect(result.validRows).toHaveLength(0);
    expect(result.invalidRows[0].errors[0].message).toMatch(/email/i);
  });

  it('accepts tags as a comma-separated cell', () => {
    const result = validateRows([{ full_name: 'Tag Test', email: 'tag@example.com', tags: 'VIP, repeat ,' }], 'customers');
    expect(result.validRows[0].tags).toEqual(['VIP', 'repeat']);
  });
});
