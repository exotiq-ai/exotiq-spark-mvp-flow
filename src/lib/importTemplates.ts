import { ImportEntityType, getImportSchema } from './importSchemas';

// ─────────────────────────────────────────────────────────────────
// Region-aware sample data. Falls back to US when a country has no
// localised set yet. Add a new country by appending a record here.
// ─────────────────────────────────────────────────────────────────

type Row = Record<string, string>;
type CountrySamples = Record<ImportEntityType, Row[]>;

const US_SAMPLES: CountrySamples = {
  vehicles: [
    { name: '2024 BMW M4 Competition', make: 'BMW', model: 'M4 Competition', year: '2024', license_plate: 'EXO-1234', vin: 'WBAPH5C55BA123456', current_rate: '450', status: 'available', location: 'Miami Airport', color: 'Black Sapphire', mileage: '5200' },
    { name: '2023 Porsche 911 Turbo S', make: 'Porsche', model: '911 Turbo S', year: '2023', license_plate: 'EXO-5678', vin: 'WP0AD2A99PS123789', current_rate: '850', status: 'available', location: 'Fort Lauderdale', color: 'GT Silver', mileage: '8400' },
    { name: '2024 Mercedes-AMG GT', make: 'Mercedes-Benz', model: 'AMG GT', year: '2024', license_plate: 'EXO-9012', vin: 'WDDYJ7JA6EA012345', current_rate: '550', status: 'maintenance', location: 'Miami Beach', color: 'Obsidian Black', mileage: '3100' },
  ],
  customers: [
    { full_name: 'John Smith', email: 'john.smith@email.com', phone: '+1 (305) 555-1234', address: '123 Ocean Drive, Miami Beach, FL 33139', drivers_license: 'S123-456-78-901', license_expiry: '2026-12-31', date_of_birth: '1985-03-15', insurance_provider: 'State Farm', insurance_policy: 'POL-SF-123456', insurance_expiry: '2025-06-30', notes: 'VIP customer, prefers convertibles', customer_status: 'active' },
    { full_name: 'Sarah Johnson', email: 'sarah.j@email.com', phone: '+1 (786) 555-5678', address: '456 Brickell Ave, Miami, FL 33131', drivers_license: 'J789-012-34-567', license_expiry: '2027-08-15', date_of_birth: '1990-07-22', insurance_provider: 'Geico', insurance_policy: 'POL-GE-789012', insurance_expiry: '2025-09-15', notes: 'Corporate account - ABC Corp', customer_status: 'active' },
  ],
  bookings: [
    { customer_name: 'John Smith', customer_email: 'john.smith@email.com', customer_phone: '+1 (305) 555-1234', vehicle_name: '2024 BMW M4 Competition', start_date: '2025-02-01', end_date: '2025-02-05', pickup_location: 'Miami Airport', dropoff_location: 'Miami Airport', daily_rate: '450', total_value: '1800', status: 'confirmed', notes: 'Airport pickup requested' },
    { customer_name: 'Sarah Johnson', customer_email: 'sarah.j@email.com', customer_phone: '+1 (786) 555-5678', vehicle_name: '2023 Porsche 911 Turbo S', start_date: '2025-02-10', end_date: '2025-02-14', pickup_location: 'Fort Lauderdale', dropoff_location: 'Miami Beach', daily_rate: '850', total_value: '3400', status: 'pending', notes: '' },
  ],
  locations: [
    { name: 'Miami Airport', address: '2100 NW 42nd Ave', city: 'Miami', state: 'FL', zip_code: '33142', country: 'USA', phone: '+1 (305) 555-0100', email: 'mia@exotiq.com', timezone: 'America/New_York' },
    { name: 'Fort Lauderdale', address: '100 Terminal Drive', city: 'Fort Lauderdale', state: 'FL', zip_code: '33315', country: 'USA', phone: '+1 (954) 555-0200', email: 'fll@exotiq.com', timezone: 'America/New_York' },
  ],
};

const GB_SAMPLES: CountrySamples = {
  vehicles: [
    { name: 'Rolls-Royce Cullinan', make: 'Rolls-Royce', model: 'Cullinan', year: '2024', license_plate: 'LB24 RRC', vin: 'SCA665C50RU200001', current_rate: '£2500/day', status: 'active', location: 'London, UK', color: 'Black', mileage: '4200', image: 'rolls-royce_cullinan_black.jpeg' },
    { name: 'Bentley Bentayga', make: 'Bentley', model: 'Bentayga', year: '2023', license_plate: 'LB23 BNT', vin: 'SJAAC2ZV6PC900111', current_rate: '£1850/day', status: 'active', location: 'London, UK', color: 'Grey', mileage: '6800', image: 'bentley_bentayga_grey.jpeg' },
    { name: 'Ferrari Roma Spider', make: 'Ferrari', model: 'Roma Spider', year: '2024', license_plate: 'LB24 FRS', vin: 'ZFF99NLA0R0300222', current_rate: '£2500/day', status: 'active', location: 'London, UK', color: 'Rosso Corsa', mileage: '1900', image: 'ferrari_roma_spider_red.jpeg' },
  ],
  customers: [
    { full_name: 'James Whitmore', email: 'james@whitmore.co.uk', phone: '+44 20 7946 0123', address: '12 Berkeley Square, Mayfair, London W1J 6BR', drivers_license: 'WHITM801135JM9AB', license_expiry: '2030-06-30', date_of_birth: '1980-11-13', insurance_provider: 'Admiral', insurance_policy: 'ADM-2024-77821', insurance_expiry: '2026-04-15', notes: 'Prefers chauffeured collection', customer_status: 'active' },
    { full_name: 'Priya Patel', email: 'priya.patel@gmail.com', phone: '+44 7700 900456', address: '3 Knightsbridge, London SW1X 7LX', drivers_license: 'PATEL901225PR9CD', license_expiry: '2029-12-22', date_of_birth: '1990-12-25', insurance_provider: 'Direct Line', insurance_policy: 'DL-118822', insurance_expiry: '2026-09-01', notes: '', customer_status: 'active' },
  ],
  bookings: [
    { customer_name: 'James Whitmore', customer_email: 'james@whitmore.co.uk', customer_phone: '+44 20 7946 0123', vehicle_name: 'Rolls-Royce Cullinan', start_date: '2026-07-12', end_date: '2026-07-15', pickup_location: 'Mayfair', dropoff_location: 'Heathrow T5', daily_rate: '£2500', total_value: '£7500', status: 'confirmed', notes: 'Wedding hire — white-glove handover' },
    { customer_name: 'Priya Patel', customer_email: 'priya.patel@gmail.com', customer_phone: '+44 7700 900456', vehicle_name: 'Ferrari Roma Spider', start_date: '2026-08-01', end_date: '2026-08-03', pickup_location: 'Knightsbridge', dropoff_location: 'Knightsbridge', daily_rate: '£2500', total_value: '£5000', status: 'pending', notes: '' },
  ],
  locations: [
    { name: 'Mayfair Showroom', address: '12 Berkeley Square', city: 'London', state: 'Greater London', zip_code: 'W1J 6BR', country: 'United Kingdom', phone: '+44 20 7946 0100', email: 'mayfair@exotiq.co.uk', timezone: 'Europe/London' },
    { name: 'Heathrow T5', address: 'Terminal 5, Heathrow Airport', city: 'London', state: 'Greater London', zip_code: 'TW6 2GA', country: 'United Kingdom', phone: '+44 20 7946 0200', email: 'lhr@exotiq.co.uk', timezone: 'Europe/London' },
  ],
};

const SAMPLES_BY_COUNTRY: Record<string, CountrySamples> = {
  US: US_SAMPLES,
  GB: GB_SAMPLES,
};

function getSampleData(entityType: ImportEntityType, countryCode?: string): Row[] {
  const code = (countryCode || 'US').toUpperCase();
  const set = SAMPLES_BY_COUNTRY[code] ?? US_SAMPLES;
  return set[entityType];
}

// Generate CSV content for a template
export function generateTemplateCSV(entityType: ImportEntityType, countryCode?: string): string {
  const schema = getImportSchema(entityType);
  const sampleData = getSampleData(entityType, countryCode);

  // Union of schema fields + any sample-only columns (e.g. `image` for vehicles)
  const headerSet = new Set<string>(schema.fields.map(f => f.name));
  sampleData.forEach(row => Object.keys(row).forEach(k => headerSet.add(k)));
  const headers = Array.from(headerSet);

  const rows = [
    headers.join(','),
    ...sampleData.map(row =>
      headers.map(h => {
        const value = row[h] ?? '';
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ];

  return rows.join('\n');
}

// Download template as CSV file
export function downloadTemplate(entityType: ImportEntityType, countryCode?: string): void {
  const csvContent = generateTemplateCSV(entityType, countryCode);

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  const suffix = countryCode ? `_${countryCode.toLowerCase()}` : '';
  link.download = `${entityType}_import_template${suffix}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Get template info for UI display
export function getTemplateInfo(entityType: ImportEntityType, countryCode?: string) {
  const schema = getImportSchema(entityType);
  const requiredFields = schema.fields.filter(f => f.required);
  const optionalFields = schema.fields.filter(f => !f.required);

  return {
    entityType,
    displayName: schema.displayName,
    description: schema.description,
    requiredFields: requiredFields.map(f => ({
      name: f.name,
      label: f.label,
      description: f.description,
      example: f.example
    })),
    optionalFields: optionalFields.map(f => ({
      name: f.name,
      label: f.label,
      description: f.description,
      example: f.example
    })),
    sampleRowCount: getSampleData(entityType, countryCode).length
  };
}

// Get all available templates
export function getAllTemplates(countryCode?: string) {
  return [
    getTemplateInfo('vehicles', countryCode),
    getTemplateInfo('customers', countryCode),
    getTemplateInfo('bookings', countryCode),
    getTemplateInfo('locations', countryCode),
  ];
}
