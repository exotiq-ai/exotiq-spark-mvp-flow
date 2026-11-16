import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MILEAGE_RATE_TIERS } from "@/lib/pricingUtils";
import { parseMileageRate } from "@/lib/mileage";

interface MileageRateInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** ISO currency code, e.g. "USD". */
  currency?: string;
  className?: string;
}

const symbolFor = (currency: string): string => {
  try {
    return (
      new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
};

/** Overage rate per mile: any amount to the cent, with the common tiers as quick picks. */
export const MileageRateInput = ({ id, value, onChange, currency = "USD", className }: MileageRateInputProps) => {
  const currencySymbol = symbolFor(currency);
  const invalid = parseMileageRate(value) === undefined;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {currencySymbol}
        </span>
        <Input
          id={id}
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className={cn("pl-7 pr-12", invalid && "border-destructive")}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          /mi
        </span>
      </div>
      {invalid && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          Enter an amount like 2.25
        </p>
      )}
      <div className="flex flex-wrap gap-1.5" aria-label="Common rates">
        {MILEAGE_RATE_TIERS.map((tier) => (
          <button
            key={tier.value}
            type="button"
            onClick={() => onChange(tier.value)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors min-h-[32px]",
              value === tier.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {currencySymbol}{tier.value}
          </button>
        ))}
      </div>
    </div>
  );
};
