import { ImportEntityType, getImportSchema } from './importSchemas';

// Sample data for templates
const vehicleSampleData = [
  {
    name: '2024 BMW M4 Competition',
    make: 'BMW',
    model: 'M4 Competition',
    year: '2024',
    license_plate: 'EXO-1234',
    vin: 'WBAPH5C55BA123456',
    current_rate: '450',
    status: 'available',
    location: 'Miami Airport',
    color: 'Black Sapphire',
    mileage: '5200'
  },
  {
    name: '2023 Porsche 911 Turbo S',
    make: 'Porsche',
    model: '911 Turbo S',
    year: '2023',
    license_plate: 'EXO-5678',
    vin: 'WP0AD2A99PS123789',
    current_rate: '850',
    status: 'available',
    location: 'Fort Lauderdale',
    color: 'GT Silver',
    mileage: '8400'
  },
  {
    name: '2024 Mercedes-AMG GT',
    make: 'Mercedes-Benz',
    model: 'AMG GT',
    year: '2024',
    license_plate: 'EXO-9012',
    vin: 'WDDYJ7JA6EA012345',
    current_rate: '550',
    status: 'maintenance',
    location: 'Miami Beach',
    color: 'Obsidian Black',
    mileage: '3100'
  }
];

const customerSampleData = [
  {
    full_name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '+1 (305) 555-1234',
    address: '123 Ocean Drive, Miami Beach, FL 33139',
    drivers_license: 'S123-456-78-901',
    license_expiry: '2026-12-31',
    date_of_birth: '1985-03-15',
    insurance_provider: 'State Farm',
    insurance_policy: 'POL-SF-123456',
    insurance_expiry: '2025-06-30',
    notes: 'VIP customer, prefers convertibles',
    customer_status: 'active'
  },
  {
    full_name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    phone: '+1 (786) 555-5678',
    address: '456 Brickell Ave, Miami, FL 33131',
    drivers_license: 'J789-012-34-567',
    license_expiry: '2027-08-15',
    date_of_birth: '1990-07-22',
    insurance_provider: 'Geico',
    insurance_policy: 'POL-GE-789012',
    insurance_expiry: '2025-09-15',
    notes: 'Corporate account - ABC Corp',
    customer_status: 'active'
  }
];

const bookingSampleData = [
  {
    customer_name: 'John Smith',
    customer_email: 'john.smith@email.com',
    customer_phone: '+1 (305) 555-1234',
    vehicle_name: '2024 BMW M4 Competition',
    start_date: '2025-02-01',
    end_date: '2025-02-05',
    pickup_location: 'Miami Airport',
    dropoff_location: 'Miami Airport',
    daily_rate: '450',
    total_value: '1800',
    status: 'confirmed',
    notes: 'Airport pickup requested'
  },
  {
    customer_name: 'Sarah Johnson',
    customer_email: 'sarah.j@email.com',
    customer_phone: '+1 (786) 555-5678',
    vehicle_name: '2023 Porsche 911 Turbo S',
    start_date: '2025-02-10',
    end_date: '2025-02-14',
    pickup_location: 'Fort Lauderdale',
    dropoff_location: 'Miami Beach',
    daily_rate: '850',
    total_value: '3400',
    status: 'pending',
    notes: ''
  }
];

const locationSampleData = [
  {
    name: 'Miami Airport',
    address: '2100 NW 42nd Ave',
    city: 'Miami',
    state: 'FL',
    zip_code: '33142',
    country: 'USA',
    phone: '+1 (305) 555-0100',
    email: 'mia@exotiq.com',
    timezone: 'America/New_York'
  },
  {
    name: 'Fort Lauderdale',
    address: '100 Terminal Drive',
    city: 'Fort Lauderdale',
    state: 'FL',
    zip_code: '33315',
    country: 'USA',
    phone: '+1 (954) 555-0200',
    email: 'fll@exotiq.com',
    timezone: 'America/New_York'
  }
];

// Get sample data by entity type
function getSampleData(entityType: ImportEntityType): Record<string, string>[] {
  const sampleData: Record<ImportEntityType, Record<string, string>[]> = {
    vehicles: vehicleSampleData,
    customers: customerSampleData,
    bookings: bookingSampleData,
    locations: locationSampleData
  };
  return sampleData[entityType];
}

// Generate CSV content for a template
export function generateTemplateCSV(entityType: ImportEntityType): string {
  const schema = getImportSchema(entityType);
  const sampleData = getSampleData(entityType);
  
  // Get all field names for headers
  const headers = schema.fields.map(f => f.name);
  
  // Create CSV content
  const rows = [
    headers.join(','),
    ...sampleData.map(row => 
      headers.map(h => {
        const value = row[h] || '';
        // Escape values with commas or quotes
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
export function downloadTemplate(entityType: ImportEntityType): void {
  const schema = getImportSchema(entityType);
  const csvContent = generateTemplateCSV(entityType);
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${entityType}_import_template.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Get template info for UI display
export function getTemplateInfo(entityType: ImportEntityType) {
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
    sampleRowCount: getSampleData(entityType).length
  };
}

// Get all available templates
export function getAllTemplates() {
  return [
    getTemplateInfo('vehicles'),
    getTemplateInfo('customers'),
    getTemplateInfo('bookings'),
    getTemplateInfo('locations')
  ];
}
