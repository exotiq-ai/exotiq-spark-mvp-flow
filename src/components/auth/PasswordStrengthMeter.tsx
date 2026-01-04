import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
}

interface Requirement {
  label: string;
  test: (pw: string) => boolean;
}

const requirements: Requirement[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'Contains uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Contains lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Contains a number', test: (pw) => /\d/.test(pw) },
  { label: 'Contains special character', test: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
];

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { strength, strengthLabel, strengthColor, metRequirements } = useMemo(() => {
    const metReqs = requirements.filter((r) => r.test(password));
    const score = metReqs.length;
    
    let label = 'Too weak';
    let color = 'bg-destructive';
    
    if (score >= 5) {
      label = 'Strong';
      color = 'bg-green-500';
    } else if (score >= 4) {
      label = 'Good';
      color = 'bg-primary';
    } else if (score >= 3) {
      label = 'Fair';
      color = 'bg-yellow-500';
    } else if (score >= 2) {
      label = 'Weak';
      color = 'bg-orange-500';
    }
    
    return {
      strength: score,
      strengthLabel: label,
      strengthColor: color,
      metRequirements: metReqs,
    };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Password strength</span>
          <span className={cn(
            'font-medium',
            strength >= 4 ? 'text-green-500' : strength >= 3 ? 'text-yellow-600' : 'text-destructive'
          )}>
            {strengthLabel}
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className={cn('h-full transition-all duration-300', strengthColor)}
            style={{ width: `${(strength / requirements.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Requirements list */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
        {requirements.map((req) => {
          const isMet = req.test(password);
          return (
            <li 
              key={req.label}
              className={cn(
                'flex items-center gap-1.5 transition-colors',
                isMet ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
              )}
            >
              {isMet ? (
                <Check className="w-3 h-3 flex-shrink-0" />
              ) : (
                <X className="w-3 h-3 flex-shrink-0 opacity-50" />
              )}
              <span>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
