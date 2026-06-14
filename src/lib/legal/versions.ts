// Single source of truth for currently published legal documents.
// To bump a version: update here, then insert a new legal_document_versions
// row via migration so the edge function can resolve the new version.

export type LegalDocType = "terms" | "privacy" | "aup" | "dpa" | "sms" | "cookies" | "dmca";

export interface LegalDocMeta {
  version: string;        // ISO date string identifier, e.g. "2026-06-14"
  effectiveDate: string;  // human-printable effective date
  url: string;            // canonical in-app URL
  label: string;          // display name in consent statement
}

// All six core docs refreshed June 14, 2026. Effective date remains the
// document's original effective date (January 1, 2026); the version key
// reflects the last revision so we can force re-acceptance.
export const LEGAL_DOCS: Record<LegalDocType, LegalDocMeta> = {
  terms: {
    version: "2026-06-14",
    effectiveDate: "January 1, 2026",
    url: "/terms",
    label: "Terms and Conditions",
  },
  privacy: {
    version: "2026-06-14",
    effectiveDate: "January 1, 2026",
    url: "/privacy",
    label: "Privacy Policy",
  },
  aup: {
    version: "2026-06-14",
    effectiveDate: "January 1, 2026",
    url: "/acceptable-use",
    label: "Acceptable Use Policy",
  },
  dpa: {
    version: "2026-06-14",
    effectiveDate: "January 1, 2026",
    url: "/data-processing",
    label: "Data Processing Agreement",
  },
  sms: {
    version: "2026-06-14",
    effectiveDate: "January 1, 2026",
    url: "/sms",
    label: "SMS/Text Messaging Consent and Disclosure",
  },
  cookies: {
    version: "2026-06-14",
    effectiveDate: "January 1, 2026",
    url: "/cookies",
    label: "Cookie Policy",
  },
  dmca: {
    version: "2026-06-14",
    effectiveDate: "January 1, 2026",
    url: "/dmca",
    label: "DMCA and Copyright Policy",
  },
};

// Documents required for general signup / re-acceptance. DPA is offered
// separately to enterprise customers. SMS is an optional opt-in captured
// separately at signup (not required). Cookies and DMCA are informational.
export const REQUIRED_AT_SIGNUP: LegalDocType[] = ["terms", "privacy", "aup"];

export const CURRENT_CONSENT_STATEMENT =
  "I have read and agree to the Exotiq Terms and Conditions, Privacy Policy, and Acceptable Use Policy. I represent that I am authorized to bind my organization to these terms.";

export const SMS_CONSENT_STATEMENT =
  "I consent to receive transactional text messages from Exotiq at the phone number provided (e.g., booking confirmations, reminders, account alerts). Message frequency may vary. Message and data rates may apply. Reply HELP for help or STOP to opt out.";

export function buildDocumentsPayload(types: LegalDocType[]) {
  return types.map((t) => ({
    document_type: t,
    version: LEGAL_DOCS[t].version,
  }));
}
