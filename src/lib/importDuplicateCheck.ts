import { supabase } from '@/integrations/supabase/client';
import { ImportEntityType } from './importSchemas';

/**
 * Represents a duplicate match found during import
 */
export interface DuplicateMatch {
  importRowIndex: number;
  importRowNumber: number; // Human-readable row number (includes header)
  importData: Record<string, unknown>;
  existingRecord: Record<string, unknown>;
  existingId: string;
  matchField: string;
  matchValue: string;
  resolution?: 'skip' | 'overwrite' | 'merge';
}

/**
 * Result of duplicate detection check
 */
export interface DuplicateCheckResult {
  duplicates: DuplicateMatch[];
  newRecords: { index: number; data: Record<string, unknown> }[];
  summary: {
    total: number;
    duplicates: number;
    new: number;
  };
}

/**
 * Configuration for which fields to check for duplicates per entity type
 */
const UNIQUE_FIELDS: Record<ImportEntityType, { field: string; label: string }[]> = {
  vehicles: [
    { field: 'vin', label: 'VIN' },
    { field: 'license_plate', label: 'License Plate' }
  ],
  customers: [
    { field: 'email', label: 'Email' }
  ],
  bookings: [], // Bookings typically don't have unique constraints
  locations: [
    { field: 'name', label: 'Location Name' }
  ]
};

/**
 * Checks imported rows against existing database records for duplicates
 * Uses batch queries to minimize database calls
 */
export async function checkForDuplicates(
  rows: Record<string, unknown>[],
  entityType: ImportEntityType,
  teamId: string
): Promise<DuplicateCheckResult> {
  const uniqueFields = UNIQUE_FIELDS[entityType];
  
  // If no unique fields for this entity type, all records are new
  if (uniqueFields.length === 0) {
    return {
      duplicates: [],
      newRecords: rows.map((data, index) => ({ index, data })),
      summary: {
        total: rows.length,
        duplicates: 0,
        new: rows.length
      }
    };
  }

  const duplicates: DuplicateMatch[] = [];
  const checkedIndices = new Set<number>();

  // Check each unique field
  for (const { field, label } of uniqueFields) {
    // Collect all values for this field from import rows
    const valuesToCheck: { value: string; rowIndex: number }[] = [];
    
    rows.forEach((row, index) => {
      // Skip if already marked as duplicate
      if (checkedIndices.has(index)) return;
      
      const value = row[field];
      if (value !== null && value !== undefined && value !== '') {
        valuesToCheck.push({
          value: String(value).trim().toLowerCase(),
          rowIndex: index
        });
      }
    });

    if (valuesToCheck.length === 0) continue;

    // Batch query for existing records
    const uniqueValues = [...new Set(valuesToCheck.map(v => v.value))];
    
    // Query in batches of 100 to avoid query limits
    const batchSize = 100;
    const existingRecordsMap = new Map<string, Record<string, unknown>>();

    for (let i = 0; i < uniqueValues.length; i += batchSize) {
      const batch = uniqueValues.slice(i, i + batchSize);
      
      // Use ilike for case-insensitive matching
      const { data: existingRecords } = await supabase
        .from(entityType)
        .select('*')
        .eq('team_id', teamId)
        .in(field, batch);

      if (existingRecords) {
        existingRecords.forEach(record => {
          const recordValue = String(record[field] || '').trim().toLowerCase();
          existingRecordsMap.set(recordValue, record);
        });
      }
    }

    // Match import rows to existing records
    for (const { value, rowIndex } of valuesToCheck) {
      const existingRecord = existingRecordsMap.get(value);
      
      if (existingRecord) {
        duplicates.push({
          importRowIndex: rowIndex,
          importRowNumber: rowIndex + 2, // +1 for 0-index, +1 for header row
          importData: rows[rowIndex],
          existingRecord,
          existingId: existingRecord.id as string,
          matchField: label,
          matchValue: String(rows[rowIndex][field])
        });
        checkedIndices.add(rowIndex);
      }
    }
  }

  // Collect new records (not duplicates)
  const newRecords = rows
    .map((data, index) => ({ index, data }))
    .filter(({ index }) => !checkedIndices.has(index));

  return {
    duplicates,
    newRecords,
    summary: {
      total: rows.length,
      duplicates: duplicates.length,
      new: newRecords.length
    }
  };
}

/**
 * Applies resolutions to duplicates and returns records ready for import
 */
export async function applyDuplicateResolutions(
  duplicates: DuplicateMatch[],
  newRecords: { index: number; data: Record<string, unknown> }[],
  entityType: ImportEntityType,
  teamId: string,
  userId: string
): Promise<{
  toInsert: Record<string, unknown>[];
  toUpdate: { id: string; data: Record<string, unknown> }[];
  skipped: number;
}> {
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
  let skipped = 0;

  // Process duplicates based on their resolution
  for (const dup of duplicates) {
    switch (dup.resolution) {
      case 'skip':
        skipped++;
        break;
        
      case 'overwrite':
        // Replace existing record entirely with import data
        toUpdate.push({
          id: dup.existingId,
          data: {
            ...dup.importData,
            user_id: userId,
            team_id: teamId,
            updated_at: new Date().toISOString()
          }
        });
        break;
        
      case 'merge':
        // Only update fields that are empty in existing record
        const mergedData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(dup.importData)) {
          const existingValue = dup.existingRecord[key];
          // Only update if existing is null/undefined/empty and import has value
          if (
            (existingValue === null || existingValue === undefined || existingValue === '') &&
            value !== null && value !== undefined && value !== ''
          ) {
            mergedData[key] = value;
          }
        }
        
        if (Object.keys(mergedData).length > 0) {
          toUpdate.push({
            id: dup.existingId,
            data: {
              ...mergedData,
              updated_at: new Date().toISOString()
            }
          });
        }
        break;
        
      default:
        // No resolution set - skip by default
        skipped++;
    }
  }

  // Add all new records
  for (const { data } of newRecords) {
    toInsert.push({
      ...data,
      user_id: userId,
      team_id: teamId
    });
  }

  return { toInsert, toUpdate, skipped };
}

/**
 * Links booking imports to existing customers and vehicles
 */
export async function linkBookingsToExistingRecords(
  rows: Record<string, unknown>[],
  teamId: string
): Promise<Record<string, unknown>[]> {
  // Fetch all customers for this team
  const { data: customers } = await supabase
    .from('customers')
    .select('id, email, full_name, phone')
    .eq('team_id', teamId);

  // Fetch all vehicles for this team
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, name, vin, license_plate, make, model, year')
    .eq('team_id', teamId);

  // Create lookup maps for faster matching
  const customerByEmail = new Map<string, string>();
  const customerByPhone = new Map<string, string>();
  const customerByName = new Map<string, string>();
  
  customers?.forEach(c => {
    if (c.email) customerByEmail.set(c.email.toLowerCase(), c.id);
    if (c.phone) customerByPhone.set(normalizePhone(c.phone), c.id);
    if (c.full_name) customerByName.set(c.full_name.toLowerCase(), c.id);
  });

  const vehicleByVin = new Map<string, string>();
  const vehicleByPlate = new Map<string, string>();
  const vehicleByName = new Map<string, string>();
  
  vehicles?.forEach(v => {
    if (v.vin) vehicleByVin.set(v.vin.toUpperCase(), v.id);
    if (v.license_plate) vehicleByPlate.set(v.license_plate.toUpperCase(), v.id);
    if (v.name) vehicleByName.set(v.name.toLowerCase(), v.id);
    // Also create combined name
    const combinedName = `${v.year} ${v.make} ${v.model}`.toLowerCase();
    vehicleByName.set(combinedName, v.id);
  });

  return rows.map(row => {
    const linkedRow = { ...row };

    // Try to link customer
    let customerId: string | undefined;
    
    if (row.customer_email) {
      customerId = customerByEmail.get(String(row.customer_email).toLowerCase());
    }
    if (!customerId && row.customer_phone) {
      customerId = customerByPhone.get(normalizePhone(String(row.customer_phone)));
    }
    if (!customerId && row.customer_name) {
      customerId = customerByName.get(String(row.customer_name).toLowerCase());
    }
    
    if (customerId) {
      linkedRow.customer_id = customerId;
    }

    // Try to link vehicle
    let vehicleId: string | undefined;
    
    if (row.vin) {
      vehicleId = vehicleByVin.get(String(row.vin).toUpperCase());
    }
    if (!vehicleId && row.license_plate) {
      vehicleId = vehicleByPlate.get(String(row.license_plate).toUpperCase());
    }
    if (!vehicleId && row.vehicle_name) {
      vehicleId = vehicleByName.get(String(row.vehicle_name).toLowerCase());
    }
    
    if (vehicleId) {
      linkedRow.vehicle_id = vehicleId;
    }

    return linkedRow;
  });
}

/**
 * Normalizes phone number for comparison
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Gets a human-readable summary of duplicate check results
 */
export function getDuplicateSummaryText(result: DuplicateCheckResult): string {
  if (result.duplicates.length === 0) {
    return `All ${result.summary.total} records are new and ready to import.`;
  }
  
  return `Found ${result.summary.duplicates} potential duplicate${result.summary.duplicates > 1 ? 's' : ''} out of ${result.summary.total} records. ${result.summary.new} new record${result.summary.new !== 1 ? 's' : ''} ready to import.`;
}
