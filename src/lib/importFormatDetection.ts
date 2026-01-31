import { ColumnMapping } from './importUtils';
import { ImportEntityType } from './importSchemas';

export interface DetectedFormat {
  software: string;
  confidence: number;
  suggestedMappings: ColumnMapping[];
  dateFormat: string;
  notes: string[];
  entityType: ImportEntityType | null;
}

interface SoftwareSignature {
  name: string;
  headerPatterns: RegExp[];
  prefixStrip?: string;
  dateFormat: string;
  fieldMappings: Record<string, string>;
  notes: string[];
}

const SOFTWARE_SIGNATURES: SoftwareSignature[] = [
  {
    name: 'Rent Centric',
    headerPatterns: [/^rc_/i, /^rentcentric/i],
    prefixStrip: 'rc_',
    dateFormat: 'MM/DD/YYYY',
    fieldMappings: {
      'rc_id': 'id',
      'rc_customer_id': 'customer_id',
      'rc_customer_name': 'customer_name',
      'rc_customer_email': 'customer_email',
      'rc_customer_phone': 'customer_phone',
      'rc_vehicle_id': 'vehicle_id',
      'rc_vehicle_name': 'vehicle_name',
      'rc_start_date': 'start_date',
      'rc_end_date': 'end_date',
      'rc_pickup_location': 'pickup_location',
      'rc_dropoff_location': 'dropoff_location',
      'rc_daily_rate': 'daily_rate',
      'rc_total': 'total_value',
      'rc_status': 'status',
      'rc_make': 'make',
      'rc_model': 'model',
      'rc_year': 'year',
      'rc_vin': 'vin',
      'rc_plate': 'license_plate',
      'rc_color': 'color',
      'rc_mileage': 'current_mileage',
      'rc_rate': 'current_rate',
    },
    notes: [
      'Rent Centric export detected',
      'Date format: MM/DD/YYYY',
      'Customer IDs will be matched to existing records',
    ],
  },
  {
    name: 'HQ Rental Software',
    headerPatterns: [/^HQ-/i, /^hqrental/i],
    prefixStrip: 'HQ-',
    dateFormat: 'YYYY-MM-DD',
    fieldMappings: {
      'HQ-CustomerID': 'customer_id',
      'HQ-CustomerName': 'customer_name',
      'HQ-Email': 'customer_email',
      'HQ-Phone': 'customer_phone',
      'HQ-VehicleID': 'vehicle_id',
      'HQ-Vehicle': 'vehicle_name',
      'HQ-StartDate': 'start_date',
      'HQ-EndDate': 'end_date',
      'HQ-PickupLoc': 'pickup_location',
      'HQ-DropoffLoc': 'dropoff_location',
      'HQ-DailyRate': 'daily_rate',
      'HQ-TotalAmount': 'total_value',
      'HQ-Status': 'status',
      'HQ-Make': 'make',
      'HQ-Model': 'model',
      'HQ-Year': 'year',
      'HQ-VIN': 'vin',
      'HQ-LicensePlate': 'license_plate',
    },
    notes: [
      'HQ Rental Software export detected',
      'Date format: YYYY-MM-DD',
    ],
  },
  {
    name: 'Navotar',
    headerPatterns: [/^nav_/i, /^navotar/i],
    prefixStrip: 'nav_',
    dateFormat: 'DD/MM/YYYY',
    fieldMappings: {
      'nav_booking_id': 'id',
      'nav_renter_name': 'customer_name',
      'nav_renter_email': 'customer_email',
      'nav_renter_phone': 'customer_phone',
      'nav_car_id': 'vehicle_id',
      'nav_car_name': 'vehicle_name',
      'nav_pickup_date': 'start_date',
      'nav_return_date': 'end_date',
      'nav_pickup_branch': 'pickup_location',
      'nav_return_branch': 'dropoff_location',
      'nav_rate_per_day': 'daily_rate',
      'nav_total_amount': 'total_value',
      'nav_booking_status': 'status',
      'nav_manufacturer': 'make',
      'nav_model': 'model',
      'nav_year': 'year',
      'nav_vin_number': 'vin',
      'nav_reg_number': 'license_plate',
    },
    notes: [
      'Navotar export detected',
      'Date format: DD/MM/YYYY (European)',
      'Branch names will be matched to locations',
    ],
  },
  {
    name: 'Fleet Complete',
    headerPatterns: [/^fc_/i, /^fleetcomplete/i],
    prefixStrip: 'fc_',
    dateFormat: 'MM/DD/YYYY',
    fieldMappings: {
      'fc_vehicle_id': 'vehicle_id',
      'fc_unit_name': 'name',
      'fc_make': 'make',
      'fc_model': 'model',
      'fc_year': 'year',
      'fc_vin': 'vin',
      'fc_license': 'license_plate',
      'fc_odometer': 'current_mileage',
      'fc_status': 'status',
    },
    notes: [
      'Fleet Complete export detected',
      'Primarily vehicle/fleet data',
    ],
  },
  {
    name: 'TSD Rental',
    headerPatterns: [/^tsd_/i, /reservation_id/i],
    dateFormat: 'MM/DD/YYYY HH:mm',
    fieldMappings: {
      'reservation_id': 'id',
      'customer_first_name': 'customer_name',
      'customer_last_name': 'customer_name',
      'customer_email': 'customer_email',
      'customer_mobile': 'customer_phone',
      'vehicle_class': 'vehicle_name',
      'pickup_datetime': 'start_date',
      'return_datetime': 'end_date',
      'pickup_location_name': 'pickup_location',
      'return_location_name': 'dropoff_location',
      'daily_rate_amount': 'daily_rate',
      'total_charges': 'total_value',
      'reservation_status': 'status',
    },
    notes: [
      'TSD Rental export detected',
      'First/Last name will be combined',
      'DateTime format includes time',
    ],
  },
];

/**
 * Detect the source software format from headers and sample data
 */
export function detectImportFormat(
  headers: string[],
  sampleRows: Record<string, unknown>[] = []
): DetectedFormat {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  let bestMatch: { signature: SoftwareSignature; score: number } | null = null;

  for (const signature of SOFTWARE_SIGNATURES) {
    let matchCount = 0;
    let totalPatterns = signature.headerPatterns.length;

    for (const header of headers) {
      for (const pattern of signature.headerPatterns) {
        if (pattern.test(header)) {
          matchCount++;
          break;
        }
      }
    }

    // Also check field mappings
    const mappingKeys = Object.keys(signature.fieldMappings).map(k => k.toLowerCase());
    for (const header of lowerHeaders) {
      if (mappingKeys.includes(header)) {
        matchCount++;
      }
    }

    const score = matchCount / Math.max(headers.length, totalPatterns);
    
    if (score > 0.1 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { signature, score };
    }
  }

  if (bestMatch && bestMatch.score >= 0.15) {
    const { signature, score } = bestMatch;
    const confidence = Math.min(Math.round(score * 100 * 2), 98);

    // Build suggested mappings
    const suggestedMappings: ColumnMapping[] = [];
    
    for (const header of headers) {
      const lowerHeader = header.toLowerCase();
      const mappedField = signature.fieldMappings[header] || 
                          signature.fieldMappings[lowerHeader];
      
      if (mappedField) {
        suggestedMappings.push({
          sourceColumn: header,
          targetField: mappedField,
          confidence: 95,
          sampleValues: sampleRows.slice(0, 3).map(row => String(row[header] || '')),
        });
      }
    }

    // Detect entity type from mappings
    let entityType: ImportEntityType | null = null;
    const targetFields = suggestedMappings.map(m => m.targetField);
    
    if (targetFields.some(f => ['start_date', 'end_date', 'daily_rate', 'total_value'].includes(f))) {
      entityType = 'bookings';
    } else if (targetFields.some(f => ['vin', 'license_plate', 'make', 'model'].includes(f))) {
      entityType = 'vehicles';
    } else if (targetFields.some(f => ['customer_email', 'full_name', 'drivers_license'].includes(f))) {
      entityType = 'customers';
    }

    return {
      software: signature.name,
      confidence,
      suggestedMappings,
      dateFormat: signature.dateFormat,
      notes: signature.notes,
      entityType,
    };
  }

  // No match - return generic format
  return {
    software: 'Generic',
    confidence: 0,
    suggestedMappings: [],
    dateFormat: 'auto',
    notes: ['Standard CSV/Excel format'],
    entityType: null,
  };
}

/**
 * Normalize a header by stripping known prefixes
 */
export function normalizeHeader(header: string, software: string): string {
  const signature = SOFTWARE_SIGNATURES.find(s => s.name === software);
  
  if (signature?.prefixStrip) {
    const prefix = signature.prefixStrip.toLowerCase();
    if (header.toLowerCase().startsWith(prefix)) {
      return header.substring(signature.prefixStrip.length);
    }
  }
  
  return header;
}

/**
 * Get supported software list for UI display
 */
export function getSupportedSoftwareList(): string[] {
  return SOFTWARE_SIGNATURES.map(s => s.name);
}

/**
 * Parse date according to detected format
 */
export function parseDateWithFormat(dateString: string, format: string): Date | null {
  if (!dateString) return null;
  
  try {
    // Handle common formats
    if (format === 'MM/DD/YYYY' || format === 'auto') {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    
    if (format === 'DD/MM/YYYY') {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    
    if (format === 'YYYY-MM-DD') {
      return new Date(dateString);
    }
    
    // Fallback to native parsing
    return new Date(dateString);
  } catch {
    return null;
  }
}
