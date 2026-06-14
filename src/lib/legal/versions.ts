// Single source of truth for currently published legal documents.
// To bump a version: update here, then run scripts/legal/hash-docs.ts and
// insert a new legal_document_versions row via migration.

export type LegalDocType = "terms" | "privacy" | "aup" | "dpa";

export interface LegalDocMeta {
  version: string;        // ISO date string identifier, e.g. "2026-03-01"
  effectiveDate: string;  // human-printable effective date
  url: string;            // canonical in-app URL
  label: string;          // display name in consent statement
}

export const LEGAL_DOCS: Record<LegalDocType, LegalDocMeta> = {
  terms: {
    version: "2026-03-01",
    effectiveDate: "March 1, 2026",
    url: "/terms",
    label: "Terms and Conditions",
  },
  privacy: {
    version: "2026-03-01",
    effectiveDate: "March 1, 2026",
    url: "/privacy",
    label: "Privacy Policy",
  },
  aup: {
    version: "2026-03-01",
    effectiveDate: "March 1, 2026",
    url: "/acceptable-use",
    label: "Acceptable Use Policy",
  },
  dpa: {
    version: "2026-03-01",
    effectiveDate: "March 1, 2026",
    url: "/data-processing",
    label: "Data Processing Addendum",
  },
};

// Documents required for general signup / re-acceptance. DPA is offered
// separately to enterprise customers and is not part of standard signup.
export const REQUIRED_AT_SIGNUP: LegalDocType[] = ["terms", "privacy", "aup"];

export const CURRENT_CONSENT_STATEMENT =
  "I have read and agree to the Exotiq Terms and Conditions, Privacy Policy, and Acceptable Use Policy. I represent that I am authorized to bind my organization to these terms.";

export function buildDocumentsPayload(types: LegalDocType[]) {
  return types.map((t) => ({
    document_type: t,
    version: LEGAL_DOCS[t].version,
  }));
}
