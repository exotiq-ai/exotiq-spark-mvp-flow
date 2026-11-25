import { normalizePhone } from './validationSchemas';

/**
 * HQ Rental Software's customer export → exotiq customers.
 *
 * HQ column              → customers column
 * Label                  → full_name (all-lowercase / all-capitals names get capitalised)
 * Email Address          → email (lowercased, spaces removed; rows without one are skipped: the column is NOT NULL)
 * Phone Number           → phone (digits, with + kept for international numbers)
 * Street, Street 2, City, State, Zip, Country → address (one line, comma-separated)
 * Driver License Number  → drivers_license (upper-cased)
 * Expiration Date        → license_expiry (YYYY-MM-DD; Excel serials, dates and MM/DD/YYYY text)
 * Reservation Count      → notes ("HQ Rental: N past reservations"); exotiq counts its own bookings
 * File Upload            → not imported (the export carries only a count, not the files)
 *
 * Every customer is active and tagged HQ_IMPORT_TAG. Customers are unique by email, so rows sharing an
 * email become one customer: the row with most reservations (the first on a tie), with the other people
 * on that email listed in its notes.
 */

export const HQ_IMPORT_TAG = 'HQ import';

const COLUMNS = {
  name: 'Label',
  email: 'Email Address',
  phone: 'Phone Number',
  street: 'Street',
  street2: 'Street 2',
  city: 'City',
  state: 'State',
  zip: 'Zip',
  country: 'Country',
  licence: 'Driver License Number',
  expiry: 'Expiration Date',
  files: 'File Upload',
  reservations: 'Reservation Count',
} as const;

const REQUIRED_COLUMNS: string[] = [COLUMNS.name, COLUMNS.email];
const SUPPORTING_COLUMNS = Object.values(COLUMNS).filter(c => !REQUIRED_COLUMNS.includes(c));

const key = (header: string) => header.trim().toLowerCase().replace(/\s+/g, ' ');

/** HQ columns from the required set that these headers lack. */
export function missingHqColumns(headers: string[]): string[] {
  const present = new Set(headers.map(key));
  return REQUIRED_COLUMNS.filter(c => !present.has(key(c)));
}

/** True when the headers are HQ Rental's customer export: its Label and Email columns plus two more of its own. */
export function isHqCustomerExport(headers: string[]): boolean {
  const present = new Set(headers.map(key));
  if (missingHqColumns(headers).length > 0) return false;
  return SUPPORTING_COLUMNS.filter(c => present.has(key(c))).length >= 2;
}

const text = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[‎‏‪-‮⁦-⁩]/g, '').trim();
};

const isoDate = (y: number, m: number, d: number): string | null => {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
};

/** An HQ date as YYYY-MM-DD: an Excel day serial (how .xlsx files arrive), a Date, YYYY-MM-DD or US M/D/YYYY text. */
export function parseHqDate(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    // Excel's 1900 date system: day 1 is 1900-01-01, counted from 1899-12-30 because of its 1900 leap-year bug.
    const ms = Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = text(value);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return isoDate(Number(m[3]), Number(m[1]), Number(m[2]));
  return null;
}

/** Capitalise a name typed all-lowercase or all-capitals; a name with any mixed case is kept as typed. */
export function fixNameCase(name: string): string {
  const s = name.trim().replace(/\s+/g, ' ');
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export interface HqMappedCustomer {
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  drivers_license: string | null;
  license_expiry: string | null;
  notes: string | null;
  customer_status: 'active';
  tags: string[];
  [field: string]: unknown;
}

export interface HqImportReport {
  /** Non-blank rows in the file. */
  rows: number;
  /** Customers the import will create (one per email). */
  customers: number;
  /** Rows folded into another row's customer because they share its email. */
  mergedRows: number;
  /** Rows left out because they have no email, for the operator to add by hand. */
  skippedNoEmail: { name: string; phone: string | null }[];
  /** Customers whose licence expiry is before today. */
  expiredLicences: number;
}

export interface HqCustomerImport {
  customers: HqMappedCustomer[];
  report: HqImportReport;
}

interface HqPerson {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  licence: string | null;
  expiry: string | null;
  reservations: number | null;
}

const plural = (n: number) => `${n} past reservation${n === 1 ? '' : 's'}`;

function readRow(row: Record<string, unknown>, lookup: Map<string, string>): HqPerson | null {
  const get = (column: string) => {
    const header = lookup.get(key(column));
    return header === undefined ? '' : text(row[header]);
  };
  const raw = (column: string) => {
    const header = lookup.get(key(column));
    return header === undefined ? undefined : row[header];
  };
  if (Object.values(COLUMNS).every(c => get(c) === '')) return null;

  const stateZip = [get(COLUMNS.state), get(COLUMNS.zip)].filter(Boolean).join(' ');
  const address = [get(COLUMNS.street), get(COLUMNS.street2), get(COLUMNS.city), stateZip, get(COLUMNS.country)]
    .filter(Boolean)
    .join(', ');
  const count = Number.parseInt(get(COLUMNS.reservations), 10);
  return {
    name: fixNameCase(get(COLUMNS.name)),
    email: get(COLUMNS.email).replace(/\s+/g, '').toLowerCase(),
    phone: normalizePhone(get(COLUMNS.phone)) || null,
    address: address || null,
    licence: get(COLUMNS.licence).toUpperCase() || null,
    expiry: parseHqDate(raw(COLUMNS.expiry)),
    reservations: Number.isNaN(count) ? null : count,
  };
}

function otherPersonLine(p: HqPerson): string {
  const parts = [
    p.phone ? `phone ${p.phone}` : '',
    p.licence ? `licence ${p.licence}` : '',
    p.reservations ? plural(p.reservations) : '',
  ].filter(Boolean);
  return `Also on this email in HQ Rental: ${p.name}${parts.length ? ` (${parts.join('; ')})` : ''}.`;
}

/** Map the rows of an HQ customer export (keyed by its headers) to exotiq customers, with a count of what happened. */
export function mapHqCustomers(rows: Record<string, unknown>[], today: Date = new Date()): HqCustomerImport {
  const lookup = new Map<string, string>();
  for (const row of rows) for (const header of Object.keys(row)) if (!lookup.has(key(header))) lookup.set(key(header), header);

  const people = rows.map(r => readRow(r, lookup)).filter((p): p is HqPerson => p !== null);
  const skippedNoEmail = people.filter(p => !p.email).map(p => ({ name: p.name, phone: p.phone }));

  const byEmail = new Map<string, HqPerson[]>();
  for (const p of people) {
    if (!p.email) continue;
    const group = byEmail.get(p.email);
    if (group) group.push(p);
    else byEmail.set(p.email, [p]);
  }

  const todayIso = today.toISOString().slice(0, 10);
  const placed: { at: number; customer: HqMappedCustomer }[] = [];
  for (const group of byEmail.values()) {
    const keeper = group.reduce((best, p) => ((p.reservations ?? 0) > (best.reservations ?? 0) ? p : best));
    const notes = [
      keeper.reservations !== null ? `HQ Rental: ${plural(keeper.reservations)}.` : '',
      ...group.filter(p => p !== keeper).map(otherPersonLine),
    ].filter(Boolean);
    placed.push({ at: people.indexOf(group[0]), customer: {
      full_name: keeper.name,
      email: keeper.email,
      phone: keeper.phone,
      address: keeper.address,
      drivers_license: keeper.licence,
      license_expiry: keeper.expiry,
      notes: notes.length ? notes.join('\n') : null,
      customer_status: 'active',
      tags: [HQ_IMPORT_TAG],
    } });
  }
  // Keep the file's order: each customer sits where its email first appears.
  const customers = placed.sort((a, b) => a.at - b.at).map(p => p.customer);

  const withEmail = people.length - skippedNoEmail.length;
  return {
    customers,
    report: {
      rows: people.length,
      customers: customers.length,
      mergedRows: withEmail - customers.length,
      skippedNoEmail,
      expiredLicences: customers.filter(c => c.license_expiry !== null && c.license_expiry < todayIso).length,
    },
  };
}
