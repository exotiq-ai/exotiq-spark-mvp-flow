import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LEGAL_DOCS } from "@/lib/legal/versions";

interface Props {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
}

/**
 * Optional, never pre-checked SMS opt-in for signup (TCPA/CTIA compliant).
 * Captures phone number only when the user checks the box. Consent is
 * recorded as a separate terms_acceptances row pointing at the SMS Policy.
 */
export const SmsOptInCheckbox = ({
  id,
  checked,
  onCheckedChange,
  phone,
  onPhoneChange,
}: Props) => (
  <div className="space-y-2">
    <label htmlFor={id} className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5"
      />
      <span>
        (Optional) I consent to receive transactional text messages from Exotiq
        at the phone number provided — e.g. booking alerts, payment receipts,
        and security notifications. Message frequency may vary. Message and data
        rates may apply. Reply HELP for help or STOP to opt out. See our{" "}
        <a
          href={LEGAL_DOCS.sms.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          SMS Policy
        </a>
        . Consent is not required to create an account.
      </span>
    </label>
    {checked && (
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="Mobile number (e.g. +1 555 123 4567)"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        aria-label="Mobile phone number for SMS opt-in"
      />
    )}
  </div>
);
