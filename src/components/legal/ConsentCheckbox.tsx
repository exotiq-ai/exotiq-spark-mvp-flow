import { Checkbox } from "@/components/ui/checkbox";
import { LEGAL_DOCS } from "@/lib/legal/versions";

interface Props {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

export const ConsentCheckbox = ({ id, checked, onCheckedChange }: Props) => (
  <label htmlFor={id} className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
    <Checkbox
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      className="mt-0.5"
    />
    <span>
      I have read and agree to the Exotiq{" "}
      <a href={LEGAL_DOCS.terms.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Terms and Conditions</a>,{" "}
      <a href={LEGAL_DOCS.privacy.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Privacy Policy</a>, and{" "}
      <a href={LEGAL_DOCS.aup.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Acceptable Use Policy</a>.
      I represent that I am authorized to bind my organization to these terms.
    </span>
  </label>
);
