import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormFieldErrorProps {
  error?: string;
  className?: string;
}

/**
 * FormFieldError - Reusable field-level error display
 * Shows validation errors inline below form fields
 * 
 * @example
 * <FormFieldError error={errors.email} />
 */
export const FormFieldError = ({ error, className }: FormFieldErrorProps) => {
  if (!error) return null;

  return (
    <div 
      className={cn(
        "flex items-start gap-1.5 text-sm text-destructive mt-1.5",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <span>{error}</span>
    </div>
  );
};

/**
 * FormFieldWarning - Warning message for form fields
 * Shows warnings that don't block submission
 */
interface FormFieldWarningProps {
  warning?: string;
  className?: string;
}

export const FormFieldWarning = ({ warning, className }: FormFieldWarningProps) => {
  if (!warning) return null;

  return (
    <div 
      className={cn(
        "flex items-start gap-1.5 text-sm text-warning mt-1.5",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <span>{warning}</span>
    </div>
  );
};

/**
 * FormFieldHint - Helper text for form fields
 * Shows guidance that appears on focus
 */
interface FormFieldHintProps {
  hint?: string;
  className?: string;
}

export const FormFieldHint = ({ hint, className }: FormFieldHintProps) => {
  if (!hint) return null;

  return (
    <p 
      className={cn(
        "text-xs text-muted-foreground mt-1",
        className
      )}
    >
      {hint}
    </p>
  );
};
