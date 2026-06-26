import { z } from 'zod';

// Entity types supported for import
export type ImportEntityType = 'vehicles' | 'customers' | 'bookings' | 'locations';

// Field definition for import mapping
export interface ImportFieldDefinition {
  name: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'email' | 'phone' | 'enum';
  aliases: string[]; // Alternative column names that map to this field
  enumValues?: string[];
  description?: string;
  example?: string;
}

// Entity schema definition
export interface ImportEntitySchema {
  entityType: ImportEntityType;
  displayName: string;
  description: string;
  fields: ImportFieldDefinition[];
  uniqueFields: string[]; // Fields used for duplicate detection
}

// Vehicle import schema
export const vehicleImportSchema: ImportEntitySchema = {
  entityType: 'vehicles',
  displayName: 'Vehicles',
  description: 'Fleet vehicles including cars, trucks, and specialty vehicles',
  uniqueFields: ['vin', 'license_plate'],
  fields: [
    {
      name: 'name',
      label: 'Vehicle Name',
      required: true,
      type: 'string',
      aliases: ['vehicle_name', 'title', 'display_name', 'vehicle'],
      description: 'Display name for the vehicle',
      example: '2024 BMW M4'
    },
    {
      name: 'make',
      label: 'Make',
      required: true,
      type: 'string',
      aliases: ['brand', 'manufacturer', 'vehicle_make', 'car_make'],
      description: 'Vehicle manufacturer',
      example: 'BMW'
    },
    {
      name: 'model',
      label: 'Model',
      required: true,
      type: 'string',
      aliases: ['vehicle_model', 'car_model', 'model_name'],
      description: 'Vehicle model',
      example: 'M4'
    },
    {
      name: 'year',
      label: 'Year',
      required: false,
      type: 'number',
      aliases: ['model_year', 'vehicle_year', 'manufacture_year', 'yr'],
      description: 'Model year (1900-2027)',
      example: '2024'
    },
    {
      name: 'license_plate',
      label: 'License Plate',
      required: false,
      type: 'string',
      aliases: ['plate', 'plate_number', 'registration', 'reg_number', 'tag', 'license'],
      description: 'Vehicle license plate number',
      example: 'ABC1234'
    },
    {
      name: 'vin',
      label: 'VIN',
      required: false,
      type: 'string',
      aliases: ['vehicle_identification_number', 'vin_number', 'chassis_number'],
      description: 'Vehicle Identification Number (17 characters)',
      example: 'WBAPH5C55BA123456'
    },
    {
      name: 'current_rate',
      label: 'Daily Rate',
      required: false,
      type: 'number',
      aliases: ['daily_rate', 'rate', 'price', 'rental_rate', 'price_per_day', 'day_rate'],
      description: 'Daily rental rate in dollars',
      example: '250'
    },
    {
      name: 'status',
      label: 'Status',
      required: false,
      type: 'enum',
      aliases: ['vehicle_status', 'availability', 'state'],
      enumValues: ['available', 'rented', 'maintenance', 'unavailable', 'booked', 'retired'],
      description: 'Current vehicle status (active, in service, rented, etc. accepted)',
      example: 'available'
    },
    {
      name: 'location',
      label: 'Location',
      required: false,
      type: 'string',
      aliases: ['current_location', 'garage', 'lot', 'branch'],
      description: 'Current vehicle location',
      example: 'Miami Airport'
    },
    {
      name: 'color',
      label: 'Color',
      required: false,
      type: 'string',
      aliases: ['exterior_color', 'vehicle_color', 'paint_color'],
      description: 'Vehicle exterior color',
      example: 'Black'
    },
    {
      name: 'mileage',
      label: 'Mileage',
      required: false,
      type: 'number',
      aliases: ['odometer', 'miles', 'current_mileage', 'km', 'kilometers'],
      description: 'Current odometer reading',
      example: '15000'
    },
    {
      // Pseudo-field: not stored on the vehicle row. Collected separately so the
      // importer can surface a "drop these files into Photo Hub" banner when a
      // CSV references local image paths (e.g. exported from a spreadsheet).
      name: 'image',
      label: 'Photo Reference',
      required: false,
      type: 'string',
      aliases: ['photo', 'image_url', 'hero_image', 'photo_path', 'picture', 'thumbnail'],
      description: 'Filename or URL of the vehicle photo. Local paths are surfaced as a Photo Hub upload prompt after import.',
      example: 'rolls-royce_cullinan_black.jpeg'
    }
  ]
};

// Strip currency symbols, thousands separators, and trailing rate units
// ("/day", "/night", "per day", "pd") so values like "£2500/day" coerce cleanly.
const cleanNumeric = (val: unknown): unknown => {
  if (val === null || val === undefined || val === '') return val;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (!str) return null;
  const cleaned = str
    .replace(/[£$€¥₹]/g, '')
    .replace(/,/g, '')
    .replace(/\s*(per\s*(day|night|hour|week|month)|\/\s*(day|night|hr|hour|wk|week|mo|month)|pd|p\/d)\s*$/i, '')
    .trim();
  return cleaned === '' ? null : cleaned;
};

// Vehicle status synonyms → canonical enum. Returns the original value when no
// synonym matches so zod's enum validator can produce a useful error.
const VEHICLE_STATUS_SYNONYMS: Record<string, string> = {
  active: 'available', 'in service': 'available', 'in-service': 'available',
  live: 'available', ready: 'available', listed: 'available',
  'on rent': 'rented', 'rented out': 'rented', 'out on rent': 'rented',
  'in maintenance': 'maintenance', service: 'maintenance', repair: 'maintenance',
  'in repair': 'maintenance', shop: 'maintenance',
  inactive: 'unavailable', 'off road': 'unavailable', 'off-road': 'unavailable',
  'out of service': 'unavailable', sold: 'retired', archived: 'retired',
  'off fleet': 'retired', 'off-fleet': 'retired', decommissioned: 'retired',
};
const normalizeVehicleStatus = (val: unknown): unknown => {
  if (val === null || val === undefined || val === '') return val;
  const key = String(val).trim().toLowerCase();
  return VEHICLE_STATUS_SYNONYMS[key] ?? key;
};

// Customer import schema
export const customerImportSchema: ImportEntitySchema = {
  entityType: 'customers',
  displayName: 'Customers',
  description: 'Customer records including contact and license information',
  uniqueFields: ['email'],
  fields: [
    {
      name: 'full_name',
      label: 'Full Name',
      required: true,
      type: 'string',
      aliases: ['name', 'customer_name', 'client_name', 'renter_name', 'first_last', 'full name'],
      description: 'Customer full name',
      example: 'John Smith'
    },
    {
      name: 'email',
      label: 'Email',
      required: false,
      type: 'email',
      aliases: ['email_address', 'e-mail', 'customer_email', 'contact_email'],
      description: 'Customer email address (email or phone required)',
      example: 'john.smith@email.com'
    },
    {
      name: 'phone',
      label: 'Phone',
      required: false,
      type: 'phone',
      aliases: ['phone_number', 'telephone', 'mobile', 'cell', 'contact_phone', 'cell_phone'],
      description: 'Customer phone number (email or phone required)',
      example: '+1 (305) 555-1234'
    },
    {
      name: 'address',
      label: 'Address',
      required: false,
      type: 'string',
      aliases: ['street_address', 'home_address', 'mailing_address', 'full_address'],
      description: 'Customer mailing address',
      example: '123 Main St, Miami, FL 33101'
    },
    {
      name: 'drivers_license',
      label: 'Driver\'s License',
      required: false,
      type: 'string',
      aliases: ['license_number', 'dl_number', 'dl', 'driving_license', 'license'],
      description: 'Driver\'s license number',
      example: 'D123-456-78-901'
    },
    {
      name: 'license_expiry',
      label: 'License Expiry',
      required: false,
      type: 'date',
      aliases: ['dl_expiry', 'license_expiration', 'dl_exp', 'license_exp_date'],
      description: 'Driver\'s license expiration date',
      example: '2026-12-31'
    },
    {
      name: 'date_of_birth',
      label: 'Date of Birth',
      required: false,
      type: 'date',
      aliases: ['dob', 'birth_date', 'birthday', 'birthdate'],
      description: 'Customer date of birth',
      example: '1990-05-15'
    },
    {
      name: 'insurance_provider',
      label: 'Insurance Provider',
      required: false,
      type: 'string',
      aliases: ['insurer', 'insurance_company', 'insurance'],
      description: 'Insurance company name',
      example: 'State Farm'
    },
    {
      name: 'insurance_policy',
      label: 'Insurance Policy',
      required: false,
      type: 'string',
      aliases: ['policy_number', 'insurance_number', 'policy'],
      description: 'Insurance policy number',
      example: 'POL-12345678'
    },
    {
      name: 'insurance_expiry',
      label: 'Insurance Expiry',
      required: false,
      type: 'date',
      aliases: ['insurance_exp', 'policy_expiry', 'insurance_expiration'],
      description: 'Insurance policy expiration date',
      example: '2025-06-30'
    },
    {
      name: 'notes',
      label: 'Notes',
      required: false,
      type: 'string',
      aliases: ['comments', 'remarks', 'additional_info', 'customer_notes'],
      description: 'Additional notes about the customer',
      example: 'VIP customer, prefers luxury vehicles'
    },
    {
      name: 'customer_status',
      label: 'Status',
      required: false,
      type: 'enum',
      aliases: ['status', 'account_status'],
      enumValues: ['active', 'inactive', 'blacklisted'],
      description: 'Customer account status',
      example: 'active'
    }
  ]
};

// Booking import schema
export const bookingImportSchema: ImportEntitySchema = {
  entityType: 'bookings',
  displayName: 'Bookings',
  description: 'Rental reservations and bookings',
  uniqueFields: [],
  fields: [
    {
      name: 'customer_name',
      label: 'Customer Name',
      required: true,
      type: 'string',
      aliases: ['renter_name', 'client_name', 'name', 'customer'],
      description: 'Customer full name',
      example: 'John Smith'
    },
    {
      name: 'customer_email',
      label: 'Customer Email',
      required: false,
      type: 'email',
      aliases: ['email', 'renter_email', 'client_email'],
      description: 'Customer email for matching',
      example: 'john.smith@email.com'
    },
    {
      name: 'customer_phone',
      label: 'Customer Phone',
      required: false,
      type: 'phone',
      aliases: ['phone', 'renter_phone', 'contact_phone'],
      description: 'Customer phone number',
      example: '+1 (305) 555-1234'
    },
    {
      name: 'vehicle_name',
      label: 'Vehicle',
      required: false,
      type: 'string',
      aliases: ['vehicle', 'car', 'rental_vehicle', 'vehicle_info'],
      description: 'Vehicle name or identifier',
      example: '2024 BMW M4'
    },
    {
      name: 'start_date',
      label: 'Start Date',
      required: true,
      type: 'date',
      aliases: ['pickup_date', 'rental_start', 'from_date', 'begin_date', 'check_out'],
      description: 'Rental start date',
      example: '2025-01-15'
    },
    {
      name: 'end_date',
      label: 'End Date',
      required: true,
      type: 'date',
      aliases: ['return_date', 'rental_end', 'to_date', 'dropoff_date', 'check_in'],
      description: 'Rental end date',
      example: '2025-01-20'
    },
    {
      name: 'pickup_location',
      label: 'Pickup Location',
      required: true,
      type: 'string',
      aliases: ['pickup', 'start_location', 'from_location', 'collection_point'],
      description: 'Vehicle pickup location',
      example: 'Miami Airport'
    },
    {
      name: 'dropoff_location',
      label: 'Dropoff Location',
      required: false,
      type: 'string',
      aliases: ['return_location', 'end_location', 'drop_off', 'return_point'],
      description: 'Vehicle return location',
      example: 'Miami Airport'
    },
    {
      name: 'daily_rate',
      label: 'Daily Rate',
      required: true,
      type: 'number',
      aliases: ['rate', 'price_per_day', 'day_rate', 'rental_rate'],
      description: 'Daily rental rate',
      example: '250'
    },
    {
      name: 'total_value',
      label: 'Total Value',
      required: true,
      type: 'number',
      aliases: ['total', 'total_price', 'total_amount', 'grand_total', 'booking_total'],
      description: 'Total booking value',
      example: '1250'
    },
    {
      name: 'status',
      label: 'Status',
      required: false,
      type: 'enum',
      aliases: ['booking_status', 'reservation_status', 'state'],
      enumValues: ['pending', 'confirmed', 'active', 'completed', 'cancelled'],
      description: 'Booking status',
      example: 'confirmed'
    },
    {
      name: 'notes',
      label: 'Notes',
      required: false,
      type: 'string',
      aliases: ['comments', 'special_requests', 'remarks', 'booking_notes'],
      description: 'Additional booking notes',
      example: 'Airport pickup requested'
    }
  ]
};

// Location import schema
export const locationImportSchema: ImportEntitySchema = {
  entityType: 'locations',
  displayName: 'Locations',
  description: 'Business locations and branches',
  uniqueFields: ['name'],
  fields: [
    {
      name: 'name',
      label: 'Location Name',
      required: true,
      type: 'string',
      aliases: ['location_name', 'branch_name', 'office_name', 'site_name', 'branch'],
      description: 'Location display name',
      example: 'Miami Airport'
    },
    {
      name: 'address',
      label: 'Address',
      required: false,
      type: 'string',
      aliases: ['street_address', 'street', 'location_address'],
      description: 'Street address',
      example: '2100 NW 42nd Ave'
    },
    {
      name: 'city',
      label: 'City',
      required: false,
      type: 'string',
      aliases: ['town', 'municipality'],
      description: 'City name',
      example: 'Miami'
    },
    {
      name: 'state',
      label: 'State',
      required: false,
      type: 'string',
      aliases: ['province', 'region', 'state_code'],
      description: 'State or province',
      example: 'FL'
    },
    {
      name: 'zip_code',
      label: 'ZIP Code',
      required: false,
      type: 'string',
      aliases: ['postal_code', 'zip', 'postcode'],
      description: 'Postal/ZIP code',
      example: '33142'
    },
    {
      name: 'country',
      label: 'Country',
      required: false,
      type: 'string',
      aliases: ['country_code', 'nation'],
      description: 'Country name or code',
      example: 'USA'
    },
    {
      name: 'phone',
      label: 'Phone',
      required: false,
      type: 'phone',
      aliases: ['phone_number', 'telephone', 'contact_phone', 'location_phone'],
      description: 'Location phone number',
      example: '+1 (305) 555-0100'
    },
    {
      name: 'email',
      label: 'Email',
      required: false,
      type: 'email',
      aliases: ['email_address', 'contact_email', 'location_email'],
      description: 'Location email address',
      example: 'miami@exotiq.com'
    },
    {
      name: 'timezone',
      label: 'Timezone',
      required: false,
      type: 'string',
      aliases: ['time_zone', 'tz'],
      description: 'Location timezone',
      example: 'America/New_York'
    }
  ]
};

// Get schema by entity type
export function getImportSchema(entityType: ImportEntityType): ImportEntitySchema {
  const schemas: Record<ImportEntityType, ImportEntitySchema> = {
    vehicles: vehicleImportSchema,
    customers: customerImportSchema,
    bookings: bookingImportSchema,
    locations: locationImportSchema
  };
  return schemas[entityType];
}

// Get all schemas
export function getAllImportSchemas(): ImportEntitySchema[] {
  return [vehicleImportSchema, customerImportSchema, bookingImportSchema, locationImportSchema];
}

// Zod validation schemas for imported data
export const vehicleImportValidation = z.object({
  name: z.string().min(1, 'Vehicle name is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().min(1900, 'Year must be 1900 or later').max(2027, 'Year cannot exceed 2027').optional().nullable().default(null)
  ),
  license_plate: z.string().optional().nullable(),
  vin: z.string().max(17, 'VIN cannot exceed 17 characters').optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val),
  current_rate: z.preprocess(cleanNumeric, z.coerce.number().min(0, 'Rate must be positive').default(0)),
  status: z.preprocess(
    normalizeVehicleStatus,
    z.enum(['available', 'rented', 'maintenance', 'unavailable', 'booked', 'retired']).optional().nullable().default('available')
  ),
  location: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  mileage: z.preprocess(cleanNumeric, z.coerce.number().min(0).optional().nullable()),
  image: z.string().optional().nullable(),
});

export const customerImportValidation = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  drivers_license: z.string().optional().nullable(),
  license_expiry: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  insurance_provider: z.string().optional().nullable(),
  insurance_policy: z.string().optional().nullable(),
  insurance_expiry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customer_status: z.enum(['active', 'inactive', 'blacklisted']).optional().default('active')
}).refine(
  (data) => (data.email && data.email.length > 0) || (data.phone && data.phone.length > 0),
  { message: 'Either email or phone is required', path: ['email'] }
);

export const bookingImportValidation = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_email: z.string().email('Invalid email').optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  vehicle_name: z.string().optional().nullable(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  pickup_location: z.string().min(1, 'Pickup location is required'),
  dropoff_location: z.string().optional().nullable(),
  daily_rate: z.coerce.number().min(0, 'Daily rate must be positive'),
  total_value: z.coerce.number().min(0, 'Total value must be positive'),
  status: z.enum(['pending', 'confirmed', 'active', 'completed', 'cancelled']).optional().default('pending'),
  notes: z.string().optional().nullable()
});

export const locationImportValidation = z.object({
  name: z.string().min(1, 'Location name is required'),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  timezone: z.string().optional().nullable()
});

// Get validation schema by entity type
export function getValidationSchema(entityType: ImportEntityType) {
  const schemas = {
    vehicles: vehicleImportValidation,
    customers: customerImportValidation,
    bookings: bookingImportValidation,
    locations: locationImportValidation
  };
  return schemas[entityType];
}
