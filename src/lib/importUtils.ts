import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  ImportEntityType, 
  ImportEntitySchema,
  ImportFieldDefinition,
  getAllImportSchemas, 
  getImportSchema,
  getValidationSchema 
} from './importSchemas';

// Types
export interface ParsedFileData {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
  rowCount: number;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  sampleValues: string[];
}

export interface EntityDetectionResult {
  entityType: ImportEntityType;
  confidence: number;
  reasoning: string;
}

export interface ValidationError {
  row: number;
  field: string;
  value: unknown;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validRows: Record<string, unknown>[];
  invalidRows: { row: number; data: Record<string, unknown>; errors: ValidationError[] }[];
}

// Parse file (CSV or Excel)
export async function parseFile(file: File): Promise<ParsedFileData> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return parseCSV(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcel(file);
  } else {
    throw new Error('Unsupported file format. Please upload a CSV or Excel file.');
  }
}

// Parse CSV file
async function parseCSV(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, unknown>[];
        
        resolve({
          headers,
          rows,
          fileName: file.name,
          rowCount: rows.length
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
}

// Parse Excel file
async function parseExcel(file: File): Promise<ParsedFileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
        
        if (jsonData.length < 2) {
          throw new Error('Excel file must have at least a header row and one data row');
        }
        
        const headers = (jsonData[0] as string[]).map(h => String(h).trim());
        const rows = jsonData.slice(1).map(row => {
          const rowData: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            rowData[header] = (row as unknown[])[index];
          });
          return rowData;
        });
        
        resolve({
          headers,
          rows,
          fileName: file.name,
          rowCount: rows.length
        });
      } catch (error) {
        reject(new Error(`Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// Detect entity type from headers
export function detectEntityType(headers: string[]): EntityDetectionResult {
  const schemas = getAllImportSchemas();
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  let bestMatch: EntityDetectionResult = {
    entityType: 'vehicles',
    confidence: 0,
    reasoning: 'Default fallback'
  };
  
  for (const schema of schemas) {
    let matchCount = 0;
    let requiredMatchCount = 0;
    const matchedFields: string[] = [];
    
    for (const field of schema.fields) {
      const allNames = [field.name, ...field.aliases].map(n => 
        n.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      
      const hasMatch = normalizedHeaders.some(h => allNames.includes(h));
      if (hasMatch) {
        matchCount++;
        matchedFields.push(field.label);
        if (field.required) requiredMatchCount++;
      }
    }
    
    // Calculate confidence based on matches
    const requiredFields = schema.fields.filter(f => f.required).length;
    const requiredMatchRatio = requiredFields > 0 ? requiredMatchCount / requiredFields : 0;
    const totalMatchRatio = matchCount / schema.fields.length;
    
    // Weight required matches more heavily
    const confidence = (requiredMatchRatio * 0.7 + totalMatchRatio * 0.3) * 100;
    
    if (confidence > bestMatch.confidence) {
      bestMatch = {
        entityType: schema.entityType,
        confidence: Math.round(confidence),
        reasoning: `Matched ${matchCount} fields: ${matchedFields.slice(0, 5).join(', ')}${matchedFields.length > 5 ? '...' : ''}`
      };
    }
  }
  
  return bestMatch;
}

// Calculate string similarity (Levenshtein-based)
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }
  
  // Simple Levenshtein distance
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - matrix[s1.length][s2.length] / maxLen;
}

// Suggest column mappings
export function suggestColumnMappings(
  headers: string[], 
  entityType: ImportEntityType,
  rows: Record<string, unknown>[]
): ColumnMapping[] {
  const schema = getImportSchema(entityType);
  const mappings: ColumnMapping[] = [];
  const usedHeaders = new Set<string>();
  
  // For each target field, find the best matching source column
  for (const field of schema.fields) {
    let bestMatch: ColumnMapping | null = null;
    let bestScore = 0;
    
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      // Check exact match with field name
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedFieldName = field.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (normalizedHeader === normalizedFieldName) {
        bestMatch = {
          sourceColumn: header,
          targetField: field.name,
          confidence: 100,
          sampleValues: getSampleValues(rows, header)
        };
        bestScore = 100;
        break;
      }
      
      // Check aliases
      for (const alias of field.aliases) {
        const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedHeader === normalizedAlias) {
          bestMatch = {
            sourceColumn: header,
            targetField: field.name,
            confidence: 95,
            sampleValues: getSampleValues(rows, header)
          };
          bestScore = 95;
          break;
        }
      }
      
      if (bestScore >= 95) break;
      
      // Calculate similarity score
      const allNames = [field.name, field.label, ...field.aliases];
      let maxSimilarity = 0;
      
      for (const name of allNames) {
        const similarity = stringSimilarity(header, name);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      
      const score = Math.round(maxSimilarity * 100);
      if (score > bestScore && score >= 50) {
        bestMatch = {
          sourceColumn: header,
          targetField: field.name,
          confidence: score,
          sampleValues: getSampleValues(rows, header)
        };
        bestScore = score;
      }
    }
    
    if (bestMatch) {
      mappings.push(bestMatch);
      usedHeaders.add(bestMatch.sourceColumn);
    } else {
      // No match found - add empty mapping
      mappings.push({
        sourceColumn: '',
        targetField: field.name,
        confidence: 0,
        sampleValues: []
      });
    }
  }
  
  return mappings;
}

// Get sample values from rows
function getSampleValues(rows: Record<string, unknown>[], column: string, count: number = 3): string[] {
  const values: string[] = [];
  
  for (const row of rows) {
    if (values.length >= count) break;
    const value = row[column];
    if (value !== null && value !== undefined && value !== '') {
      const strValue = String(value).trim();
      if (strValue && !values.includes(strValue)) {
        values.push(strValue);
      }
    }
  }
  
  return values;
}

// Transform rows based on column mappings
export function transformRows(
  rows: Record<string, unknown>[],
  mappings: ColumnMapping[]
): Record<string, unknown>[] {
  return rows.map(row => {
    const transformed: Record<string, unknown> = {};
    
    for (const mapping of mappings) {
      if (mapping.sourceColumn) {
        let value = row[mapping.sourceColumn];
        
        // Clean up value
        if (typeof value === 'string') {
          value = value.trim();
          if (value === '') value = null;
        }
        
        transformed[mapping.targetField] = value;
      } else {
        transformed[mapping.targetField] = null;
      }
    }
    
    return transformed;
  });
}

// Validate rows against schema
export function validateRows(
  rows: Record<string, unknown>[],
  entityType: ImportEntityType
): ValidationResult {
  const schema = getValidationSchema(entityType);
  const importSchema = getImportSchema(entityType);
  
  const errors: ValidationError[] = [];
  const validRows: Record<string, unknown>[] = [];
  const invalidRows: { row: number; data: Record<string, unknown>; errors: ValidationError[] }[] = [];
  
  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 for 1-indexed and header row
    const result = schema.safeParse(row);
    
    if (result.success) {
      validRows.push(result.data);
    } else {
      const rowErrors: ValidationError[] = result.error.errors.map(err => {
        const fieldName = err.path.join('.');
        const fieldDef = importSchema.fields.find(f => f.name === fieldName);
        
        return {
          row: rowNumber,
          field: fieldDef?.label || fieldName,
          value: row[fieldName],
          message: err.message,
          suggestion: getSuggestion(fieldName, row[fieldName], err.message)
        };
      });
      
      errors.push(...rowErrors);
      invalidRows.push({ row: rowNumber, data: row, errors: rowErrors });
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    validRows,
    invalidRows
  };
}

// Get suggestion for fixing validation error
function getSuggestion(field: string, value: unknown, message: string): string | undefined {
  if (message.includes('email')) {
    return 'Enter a valid email address (e.g., name@example.com)';
  }
  if (field === 'year') {
    return 'Enter a year between 1900 and 2027';
  }
  if (field === 'vin' && value) {
    const strValue = String(value);
    if (strValue.length !== 17) {
      return `VIN must be exactly 17 characters (current: ${strValue.length})`;
    }
  }
  if (message.includes('required')) {
    return 'This field cannot be empty';
  }
  return undefined;
}

// Parse date in various formats
export function parseDate(value: unknown): string | null {
  if (!value) return null;
  
  const strValue = String(value).trim();
  if (!strValue) return null;
  
  // Try common date formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // MM-DD-YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // M/D/YYYY
  ];
  
  for (const format of formats) {
    const match = strValue.match(format);
    if (match) {
      try {
        const date = new Date(strValue);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch {
        continue;
      }
    }
  }
  
  // Try native Date parsing as fallback
  try {
    const date = new Date(strValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    return null;
  }
  
  return null;
}

// Normalize phone number
export function normalizePhone(value: unknown): string | null {
  if (!value) return null;
  
  const strValue = String(value).trim();
  if (!strValue) return null;
  
  // Remove all non-digit characters except + at the start
  const cleaned = strValue.replace(/[^\d+]/g, '');
  
  if (cleaned.length < 7) return null;
  
  return cleaned;
}

// Get field definition by name
export function getFieldDefinition(
  entityType: ImportEntityType, 
  fieldName: string
): ImportFieldDefinition | undefined {
  const schema = getImportSchema(entityType);
  return schema.fields.find(f => f.name === fieldName);
}

// Check if a mapping has all required fields
export function checkRequiredFields(
  mappings: ColumnMapping[],
  entityType: ImportEntityType
): { valid: boolean; missingFields: string[] } {
  const schema = getImportSchema(entityType);
  const requiredFields = schema.fields.filter(f => f.required);
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    const mapping = mappings.find(m => m.targetField === field.name);
    if (!mapping || !mapping.sourceColumn) {
      missingFields.push(field.label);
    }
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

// Generate import summary statistics
export function generateImportSummary(validationResult: ValidationResult) {
  return {
    totalRows: validationResult.validRows.length + validationResult.invalidRows.length,
    validRows: validationResult.validRows.length,
    invalidRows: validationResult.invalidRows.length,
    errorCount: validationResult.errors.length,
    successRate: Math.round(
      (validationResult.validRows.length / 
        (validationResult.validRows.length + validationResult.invalidRows.length)) * 100
    )
  };
}
