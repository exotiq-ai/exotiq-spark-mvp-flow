/**
 * Form Validation Utilities
 * Provides reusable validation functions for forms throughout the application
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validators = {
  email: (value: string): ValidationResult => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) {
      return { isValid: false, error: "Email is required" };
    }
    if (!emailRegex.test(value)) {
      return { isValid: false, error: "Please enter a valid email address" };
    }
    return { isValid: true };
  },

  password: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: false, error: "Password is required" };
    }
    if (value.length < 6) {
      return { isValid: false, error: "Password must be at least 6 characters" };
    }
    return { isValid: true };
  },

  phone: (value: string): ValidationResult => {
    if (!value) return { isValid: true }; // Optional field
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(value)) {
      return { isValid: false, error: "Please enter a valid phone number" };
    }
    return { isValid: true };
  },

  required: (value: string, fieldName: string): ValidationResult => {
    if (!value || value.trim() === "") {
      return { isValid: false, error: `${fieldName} is required` };
    }
    return { isValid: true };
  },

  year: (value: string): ValidationResult => {
    const year = parseInt(value);
    const currentYear = new Date().getFullYear();
    if (isNaN(year)) {
      return { isValid: false, error: "Please enter a valid year" };
    }
    if (year < 1900 || year > currentYear + 1) {
      return { isValid: false, error: `Year must be between 1900 and ${currentYear + 1}` };
    }
    return { isValid: true };
  },

  positiveNumber: (value: string, fieldName: string): ValidationResult => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return { isValid: false, error: `${fieldName} must be a number` };
    }
    if (num < 0) {
      return { isValid: false, error: `${fieldName} must be positive` };
    }
    return { isValid: true };
  },

  dateRange: (startDate: string, endDate: string): ValidationResult => {
    if (!startDate || !endDate) {
      return { isValid: false, error: "Both start and end dates are required" };
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return { isValid: false, error: "End date must be after start date" };
    }
    return { isValid: true };
  },
};

/**
 * Validate multiple fields at once
 */
export const validateForm = (
  validations: Array<() => ValidationResult>
): { isValid: boolean; errors: string[] } => {
  const results = validations.map(fn => fn());
  const errors = results
    .filter(r => !r.isValid)
    .map(r => r.error!)
    .filter(Boolean);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
